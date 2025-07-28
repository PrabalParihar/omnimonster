use cosmwasm_std::{
    entry_point, to_binary, from_slice, Addr, Binary, CosmosMsg, Deps, DepsMut, Env, MessageInfo,
    Response, StdError, StdResult, Uint128, WasmMsg, BankMsg, Coin,
};
use cw2::set_contract_version;
use cw20::{Cw20ExecuteMsg, Cw20ReceiveMsg};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

const CONTRACT_NAME: &str = "crates.io:htlc";
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InstantiateMsg {
    pub sender: String,
    pub beneficiary: String,
    pub hash_lock: Binary,
    pub timelock: u64,
    pub amount: Uint128,
    pub token: Option<String>, // None for native tokens, Some for CW20
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    Fund {},
    Claim { preimage: Binary },
    Refund {},
    Receive(Cw20ReceiveMsg),
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    GetSwap {},
    IsClaimable {},
    IsRefundable {},
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum SwapState {
    Open,
    Claimed,
    Refunded,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct SwapContract {
    pub sender: Addr,
    pub beneficiary: Addr,
    pub hash_lock: Binary,
    pub timelock: u64,
    pub amount: Uint128,
    pub token: Option<Addr>, // None for native, Some for CW20
    pub state: SwapState,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct SwapResponse {
    pub sender: String,
    pub beneficiary: String,
    pub hash_lock: Binary,
    pub timelock: u64,
    pub amount: Uint128,
    pub token: Option<String>,
    pub state: SwapState,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum Cw20HookMsg {
    Fund {
        beneficiary: String,
        hash_lock: Binary,
        timelock: u64,
    },
}

// State storage
use cw_storage_plus::Item;
pub const SWAP: Item<SwapContract> = Item::new("swap");

#[entry_point]
pub fn instantiate(
    deps: DepsMut,
    env: Env,
    _info: MessageInfo,
    msg: InstantiateMsg,
) -> StdResult<Response> {
    set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;

    // Validate input
    let sender = deps.api.addr_validate(&msg.sender)?;
    let beneficiary = deps.api.addr_validate(&msg.beneficiary)?;
    
    if msg.hash_lock.is_empty() {
        return Err(StdError::generic_err("Hash lock cannot be empty"));
    }
    
    if msg.timelock <= env.block.time.seconds() {
        return Err(StdError::generic_err("Timelock must be in the future"));
    }
    
    if msg.amount.is_zero() {
        return Err(StdError::generic_err("Amount must be greater than zero"));
    }

    let token = match msg.token {
        Some(addr) => Some(deps.api.addr_validate(&addr)?),
        None => None,
    };

    let swap = SwapContract {
        sender,
        beneficiary,
        hash_lock: msg.hash_lock,
        timelock: msg.timelock,
        amount: msg.amount,
        token,
        state: SwapState::Open,
    };

    SWAP.save(deps.storage, &swap)?;

    Ok(Response::new()
        .add_attribute("method", "instantiate")
        .add_attribute("sender", msg.sender)
        .add_attribute("beneficiary", msg.beneficiary)
        .add_attribute("amount", msg.amount))
}

#[entry_point]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> StdResult<Response> {
    match msg {
        ExecuteMsg::Fund {} => execute_fund(deps, env, info),
        ExecuteMsg::Claim { preimage } => execute_claim(deps, env, info, preimage),
        ExecuteMsg::Refund {} => execute_refund(deps, env, info),
        ExecuteMsg::Receive(msg) => execute_receive(deps, env, info, msg),
    }
}

pub fn execute_fund(deps: DepsMut, _env: Env, info: MessageInfo) -> StdResult<Response> {
    let swap = SWAP.load(deps.storage)?;
    
    if swap.state != SwapState::Open {
        return Err(StdError::generic_err("Swap is not open"));
    }
    
    if info.sender != swap.sender {
        return Err(StdError::generic_err("Only sender can fund the swap"));
    }

    // For native tokens, verify payment
    if swap.token.is_none() {
        let payment = info.funds.iter().find(|coin| coin.denom == "uatom" || coin.denom == "stake");
        match payment {
            Some(coin) => {
                if coin.amount != swap.amount {
                    return Err(StdError::generic_err("Incorrect payment amount"));
                }
            }
            None => return Err(StdError::generic_err("No payment found")),
        }
    }

    Ok(Response::new()
        .add_attribute("method", "fund")
        .add_attribute("sender", info.sender)
        .add_attribute("amount", swap.amount))
}

pub fn execute_claim(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    preimage: Binary,
) -> StdResult<Response> {
    let mut swap = SWAP.load(deps.storage)?;
    
    if swap.state != SwapState::Open {
        return Err(StdError::generic_err("Swap is not open"));
    }
    
    if info.sender != swap.beneficiary {
        return Err(StdError::generic_err("Only beneficiary can claim"));
    }
    
    if env.block.time.seconds() >= swap.timelock {
        return Err(StdError::generic_err("Timelock has expired"));
    }

    // Verify preimage
    let hash = Sha256::digest(preimage.as_slice());
    if hash.as_slice() != swap.hash_lock.as_slice() {
        return Err(StdError::generic_err("Invalid preimage"));
    }

    swap.state = SwapState::Claimed;
    SWAP.save(deps.storage, &swap)?;

    let mut messages: Vec<CosmosMsg> = Vec::new();

    // Create IBC transfer message for cross-chain flow
    match &swap.token {
        None => {
            // Native token transfer - prepare for IBC
            let coin = Coin {
                denom: "uatom".to_string(), // Default to ATOM, should be configurable
                amount: swap.amount,
            };
            
            // For IBC compatibility, we send to beneficiary first
            // In practice, this would trigger an IBC packet
            messages.push(CosmosMsg::Bank(BankMsg::Send {
                to_address: swap.beneficiary.to_string(),
                amount: vec![coin],
            }));
        }
        Some(token_addr) => {
            // CW20 token transfer
            messages.push(CosmosMsg::Wasm(WasmMsg::Execute {
                contract_addr: token_addr.to_string(),
                msg: to_binary(&Cw20ExecuteMsg::Transfer {
                    recipient: swap.beneficiary.to_string(),
                    amount: swap.amount,
                })?,
                funds: vec![],
            }));
        }
    }

    Ok(Response::new()
        .add_messages(messages)
        .add_attribute("method", "claim")
        .add_attribute("beneficiary", swap.beneficiary)
        .add_attribute("preimage", preimage.to_base64())
        .add_attribute("amount", swap.amount))
}

pub fn execute_refund(deps: DepsMut, env: Env, info: MessageInfo) -> StdResult<Response> {
    let mut swap = SWAP.load(deps.storage)?;
    
    if swap.state != SwapState::Open {
        return Err(StdError::generic_err("Swap is not open"));
    }
    
    if info.sender != swap.sender {
        return Err(StdError::generic_err("Only sender can refund"));
    }
    
    if env.block.time.seconds() < swap.timelock {
        return Err(StdError::generic_err("Timelock has not expired"));
    }

    swap.state = SwapState::Refunded;
    SWAP.save(deps.storage, &swap)?;

    let mut messages: Vec<CosmosMsg> = Vec::new();

    match &swap.token {
        None => {
            // Native token refund
            let coin = Coin {
                denom: "uatom".to_string(),
                amount: swap.amount,
            };
            messages.push(CosmosMsg::Bank(BankMsg::Send {
                to_address: swap.sender.to_string(),
                amount: vec![coin],
            }));
        }
        Some(token_addr) => {
            // CW20 token refund
            messages.push(CosmosMsg::Wasm(WasmMsg::Execute {
                contract_addr: token_addr.to_string(),
                msg: to_binary(&Cw20ExecuteMsg::Transfer {
                    recipient: swap.sender.to_string(),
                    amount: swap.amount,
                })?,
                funds: vec![],
            }));
        }
    }

    Ok(Response::new()
        .add_messages(messages)
        .add_attribute("method", "refund")
        .add_attribute("sender", swap.sender)
        .add_attribute("amount", swap.amount))
}

pub fn execute_receive(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    wrapper: Cw20ReceiveMsg,
) -> StdResult<Response> {
    let msg: Cw20HookMsg = from_slice(&wrapper.msg)?;
    let balance = wrapper.amount;
    let _sender = deps.api.addr_validate(&wrapper.sender)?;

    match msg {
        Cw20HookMsg::Fund {
            beneficiary: _,
            hash_lock: _,
            timelock: _,
        } => {
            let swap = SWAP.load(deps.storage)?;
            
            if swap.token != Some(info.sender.clone()) {
                return Err(StdError::generic_err("Wrong token contract"));
            }
            
            if balance != swap.amount {
                return Err(StdError::generic_err("Incorrect token amount"));
            }

            Ok(Response::new()
                .add_attribute("method", "receive_fund")
                .add_attribute("token", info.sender)
                .add_attribute("amount", balance))
        }
    }
}

#[entry_point]
pub fn query(deps: Deps, env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::GetSwap {} => to_binary(&query_swap(deps)?),
        QueryMsg::IsClaimable {} => to_binary(&query_is_claimable(deps, env)?),
        QueryMsg::IsRefundable {} => to_binary(&query_is_refundable(deps, env)?),
    }
}

fn query_swap(deps: Deps) -> StdResult<SwapResponse> {
    let swap = SWAP.load(deps.storage)?;
    Ok(SwapResponse {
        sender: swap.sender.to_string(),
        beneficiary: swap.beneficiary.to_string(),
        hash_lock: swap.hash_lock,
        timelock: swap.timelock,
        amount: swap.amount,
        token: swap.token.map(|addr| addr.to_string()),
        state: swap.state,
    })
}

fn query_is_claimable(deps: Deps, env: Env) -> StdResult<bool> {
    let swap = SWAP.load(deps.storage)?;
    Ok(swap.state == SwapState::Open && env.block.time.seconds() < swap.timelock)
}

fn query_is_refundable(deps: Deps, env: Env) -> StdResult<bool> {
    let swap = SWAP.load(deps.storage)?;
    Ok(swap.state == SwapState::Open && env.block.time.seconds() >= swap.timelock)
}

// Helper function for JSON parsing

#[cfg(test)]
mod tests {
    use super::*;
    use cosmwasm_std::testing::{mock_dependencies, mock_env, mock_info};
    use cosmwasm_std::{coins, Timestamp};

    #[test]
    fn test_instantiate() {
        let mut deps = mock_dependencies();
        let env = mock_env();
        let info = mock_info("creator", &coins(1000, "earth"));

        let msg = InstantiateMsg {
            sender: "sender".to_string(),
            beneficiary: "beneficiary".to_string(),
            hash_lock: Binary::from(b"test_hash_32_bytes_long_exactly!"),
            timelock: env.block.time.seconds() + 3600,
            amount: Uint128::new(1000),
            token: None,
        };

        let res = instantiate(deps.as_mut(), env, info, msg).unwrap();
        assert_eq!(0, res.messages.len());
    }

    #[test]
    fn test_claim_happy_path() {
        let mut deps = mock_dependencies();
        let mut env = mock_env();
        
        // Setup contract
        let info = mock_info("creator", &coins(1000, "earth"));
        let hash_lock = Binary::from(b"test_hash_32_bytes_long_exactly!");
        let preimage = Binary::from(b"secret");
        
        // Create hash of preimage
        let expected_hash = Sha256::digest(preimage.as_slice());
        let hash_lock = Binary::from(expected_hash.as_slice());
        
        let msg = InstantiateMsg {
            sender: "sender".to_string(),
            beneficiary: "beneficiary".to_string(),
            hash_lock: hash_lock.clone(),
            timelock: env.block.time.seconds() + 3600,
            amount: Uint128::new(1000),
            token: None,
        };

        instantiate(deps.as_mut(), env.clone(), info, msg).unwrap();

        // Fund the contract
        let fund_info = mock_info("sender", &coins(1000, "uatom"));
        execute(deps.as_mut(), env.clone(), fund_info, ExecuteMsg::Fund {}).unwrap();

        // Claim with correct preimage
        let claim_info = mock_info("beneficiary", &[]);
        let res = execute(
            deps.as_mut(),
            env.clone(),
            claim_info,
            ExecuteMsg::Claim { preimage },
        ).unwrap();

        assert_eq!(1, res.messages.len());
        assert_eq!(res.attributes[0].key, "method");
        assert_eq!(res.attributes[0].value, "claim");
    }

    #[test]
    fn test_refund_after_timelock() {
        let mut deps = mock_dependencies();
        let mut env = mock_env();
        
        // Setup contract
        let info = mock_info("creator", &coins(1000, "earth"));
        let msg = InstantiateMsg {
            sender: "sender".to_string(),
            beneficiary: "beneficiary".to_string(),
            hash_lock: Binary::from(b"test_hash_32_bytes_long_exactly!"),
            timelock: env.block.time.seconds() + 3600,
            amount: Uint128::new(1000),
            token: None,
        };

        instantiate(deps.as_mut(), env.clone(), info, msg).unwrap();

        // Fund the contract
        let fund_info = mock_info("sender", &coins(1000, "uatom"));
        execute(deps.as_mut(), env.clone(), fund_info, ExecuteMsg::Fund {}).unwrap();

        // Advance time past timelock
        env.block.time = Timestamp::from_seconds(env.block.time.seconds() + 3601);

        // Refund
        let refund_info = mock_info("sender", &[]);
        let res = execute(deps.as_mut(), env, refund_info, ExecuteMsg::Refund {}).unwrap();

        assert_eq!(1, res.messages.len());
        assert_eq!(res.attributes[0].key, "method");
        assert_eq!(res.attributes[0].value, "refund");
    }

    #[test]
    fn test_invalid_preimage_fails() {
        let mut deps = mock_dependencies();
        let env = mock_env();
        
        // Setup contract with specific hash
        let info = mock_info("creator", &coins(1000, "earth"));
        let correct_preimage = Binary::from(b"correct_secret");
        let hash_lock = Binary::from(Sha256::digest(correct_preimage.as_slice()).as_slice());
        
        let msg = InstantiateMsg {
            sender: "sender".to_string(),
            beneficiary: "beneficiary".to_string(),
            hash_lock,
            timelock: env.block.time.seconds() + 3600,
            amount: Uint128::new(1000),
            token: None,
        };

        instantiate(deps.as_mut(), env.clone(), info, msg).unwrap();

        // Fund the contract
        let fund_info = mock_info("sender", &coins(1000, "uatom"));
        execute(deps.as_mut(), env.clone(), fund_info, ExecuteMsg::Fund {}).unwrap();

        // Try to claim with wrong preimage
        let claim_info = mock_info("beneficiary", &[]);
        let wrong_preimage = Binary::from(b"wrong_secret");
        let res = execute(
            deps.as_mut(),
            env,
            claim_info,
            ExecuteMsg::Claim { preimage: wrong_preimage },
        );

        assert!(res.is_err());
        assert!(res.unwrap_err().to_string().contains("Invalid preimage"));
    }
}