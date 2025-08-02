-- Fusion Swap Database Schema
-- Based on PRD specifications for complete pool-based atomic swap system

-- Create ENUM types first
CREATE TYPE auth_provider AS ENUM (
    'GOOGLE',
    'TWITTER', 
    'DISCORD',
    'GITHUB',
    'EMAIL_PASSWORDLESS',
    'METAMASK',
    'WALLETCONNECT',
    'LEDGER',
    'TREZOR'
);

-- User Authentication Table (Web3Auth)
CREATE TABLE user_auth (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    web3auth_user_id VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255),
    name VARCHAR(255),
    profile_image TEXT,
    login_provider auth_provider NOT NULL,
    wallet_address VARCHAR(42) NOT NULL,
    is_social_login BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP DEFAULT NOW(),
    UNIQUE(wallet_address)
);

-- User Preferences and Settings
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_auth(id) ON DELETE CASCADE,
    default_slippage DECIMAL(5,4) DEFAULT 0.0050,
    favorite_tokens TEXT[], -- Array of token addresses
    notifications_enabled BOOLEAN DEFAULT TRUE,
    theme_preference VARCHAR(20) DEFAULT 'system',
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Swap Status Enum
CREATE TYPE swap_status AS ENUM (
    'PENDING',        -- User HTLC created, waiting for pool
    'POOL_FULFILLED', -- Pool HTLC created and claimed user tokens
    'USER_CLAIMED',   -- User claimed pool tokens (completed)
    'EXPIRED',        -- Swap expired
    'CANCELLED'       -- Swap cancelled by user
);

-- Main Swap Requests Table
CREATE TABLE swap_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_address VARCHAR(42) NOT NULL,
    source_token VARCHAR(42) NOT NULL,
    source_amount DECIMAL(78,0) NOT NULL,
    target_token VARCHAR(42) NOT NULL,
    expected_amount DECIMAL(78,0) NOT NULL,
    slippage_tolerance DECIMAL(5,4) NOT NULL, -- e.g., 0.0050 for 0.5%
    user_htlc_contract VARCHAR(66),
    pool_htlc_contract VARCHAR(66),
    hash_lock VARCHAR(66) NOT NULL,
    preimage_hash VARCHAR(66) NOT NULL,
    expiration_time BIGINT NOT NULL,
    status swap_status DEFAULT 'PENDING',
    pool_claimed_at TIMESTAMP,
    user_claimed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Pool Liquidity Management
CREATE TABLE pool_liquidity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_address VARCHAR(42) NOT NULL,
    total_balance DECIMAL(78,0) NOT NULL,
    available_balance DECIMAL(78,0) NOT NULL,
    reserved_balance DECIMAL(78,0) NOT NULL, -- For pending swaps
    min_threshold DECIMAL(78,0) NOT NULL,
    last_rebalance TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(token_address)
);

-- Pool Operation Types
CREATE TYPE operation_type AS ENUM (
    'RESERVE',        -- Reserved tokens for swap
    'CLAIM',          -- Claimed user tokens
    'RELEASE'         -- Released reserved tokens
);

-- Track Individual Pool Operations
CREATE TABLE pool_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    swap_request_id UUID REFERENCES swap_requests(id) ON DELETE CASCADE,
    operation_type operation_type NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    amount DECIMAL(78,0) NOT NULL,
    tx_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Resolver Operation Types
CREATE TYPE resolver_operation_type AS ENUM (
    'DETECT_SWAP',    -- Detected new swap request
    'VALIDATE_POOL',  -- Validated pool liquidity
    'MATCH_SWAP',     -- Matched swap with pool
    'DEPLOY_HTLC',    -- Deployed pool HTLC
    'CLAIM_TOKENS',   -- Claimed user tokens
    'FINALIZE'        -- Finalized swap
);

-- Operation Status
CREATE TYPE operation_status AS ENUM (
    'PENDING',        -- Operation queued
    'IN_PROGRESS',    -- Operation executing
    'COMPLETED',      -- Operation successful
    'FAILED',         -- Operation failed
    'RETRYING'        -- Operation retrying
);

-- Resolver Operations Tracking
CREATE TABLE resolver_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    swap_request_id UUID REFERENCES swap_requests(id) ON DELETE CASCADE,
    operation_type resolver_operation_type NOT NULL,
    status operation_status DEFAULT 'PENDING',
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    metadata JSONB -- Additional operation data
);

-- Gas Relayer Claims Table
CREATE TABLE gasless_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    swap_request_id UUID REFERENCES swap_requests(id) ON DELETE CASCADE,
    claimer_address VARCHAR(42) NOT NULL,
    htlc_contract VARCHAR(42) NOT NULL,
    contract_id VARCHAR(66) NOT NULL,
    preimage VARCHAR(66) NOT NULL,
    signature TEXT NOT NULL,
    status operation_status DEFAULT 'PENDING',
    tx_hash VARCHAR(66),
    gas_used BIGINT,
    gas_price BIGINT,
    relay_fee DECIMAL(78,0),
    created_at TIMESTAMP DEFAULT NOW(),
    executed_at TIMESTAMP
);

-- Token Whitelist for Pool Support
CREATE TABLE supported_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_address VARCHAR(42) NOT NULL UNIQUE,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    decimals INTEGER NOT NULL,
    chain_id INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    min_swap_amount DECIMAL(78,0) NOT NULL,
    max_swap_amount DECIMAL(78,0) NOT NULL,
    fee_percentage DECIMAL(5,4) DEFAULT 0.0030, -- 0.3% default fee
    oracle_price_feed VARCHAR(42), -- Price feed contract address
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Price Oracle Data Cache
CREATE TABLE price_feeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_address VARCHAR(42) NOT NULL,
    price_usd DECIMAL(18,8) NOT NULL,
    confidence DECIMAL(5,4) NOT NULL, -- Price confidence level
    last_updated TIMESTAMP NOT NULL,
    source VARCHAR(50) NOT NULL, -- Oracle source (Chainlink, etc.)
    created_at TIMESTAMP DEFAULT NOW()
);

-- System Configuration
CREATE TABLE system_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX idx_swap_requests_user ON swap_requests(user_address);
CREATE INDEX idx_swap_requests_status ON swap_requests(status);
CREATE INDEX idx_swap_requests_created ON swap_requests(created_at);
CREATE INDEX idx_pool_operations_swap ON pool_operations(swap_request_id);
CREATE INDEX idx_resolver_operations_swap ON resolver_operations(swap_request_id);
CREATE INDEX idx_resolver_operations_status ON resolver_operations(status);
CREATE INDEX idx_gasless_claims_status ON gasless_claims(status);
CREATE INDEX idx_user_auth_wallet ON user_auth(wallet_address);
CREATE INDEX idx_user_auth_web3auth ON user_auth(web3auth_user_id);
CREATE INDEX idx_token_price ON price_feeds(token_address, last_updated);

-- Insert Default System Configuration
INSERT INTO system_config (key, value, description) VALUES
('resolver.batch_size', '10', 'Maximum number of swaps to process in one batch'),
('resolver.processing_interval', '5000', 'Interval between processing batches (ms)'),
('pool.min_liquidity_threshold', '1000000000000000000', 'Minimum liquidity threshold (18 decimals)'),
('gasless.max_gas_price', '100000000000', 'Maximum gas price for gasless transactions (wei)'),
('gasless.max_claims_per_user_per_hour', '10', 'Rate limit for gasless claims per user'),
('swap.default_expiration_hours', '24', 'Default swap expiration time in hours'),
('swap.max_expiration_hours', '168', 'Maximum swap expiration time in hours (7 days)');

-- Insert Default Supported Tokens (Ethereum Mainnet examples)
INSERT INTO supported_tokens (token_address, symbol, name, decimals, chain_id, min_swap_amount, max_swap_amount) VALUES
('0x0000000000000000000000000000000000000000', 'ETH', 'Ethereum', 18, 1, '10000000000000000', '100000000000000000000'), -- 0.01 to 100 ETH
('0xA0b86a33E6411C475C23ccee5e3e68b99a13A646', 'USDC', 'USD Coin', 6, 1, '1000000', '1000000000000'), -- $1 to $1M USDC
('0xdAC17F958D2ee523a2206206994597C13D831ec7', 'USDT', 'Tether USD', 6, 1, '1000000', '1000000000000'), -- $1 to $1M USDT
('0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', 'WBTC', 'Wrapped Bitcoin', 8, 1, '1000', '10000000000'), -- 0.00001 to 100 WBTC
('0x6B175474E89094C44Da98b954EedeAC495271d0F', 'DAI', 'Dai Stablecoin', 18, 1, '1000000000000000000', '1000000000000000000000000'); -- $1 to $1M DAI

-- Functions for automated updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at columns
CREATE TRIGGER update_swap_requests_updated_at BEFORE UPDATE ON swap_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pool_liquidity_updated_at BEFORE UPDATE ON pool_liquidity
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supported_tokens_updated_at BEFORE UPDATE ON supported_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();