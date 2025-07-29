"use client"

import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { keplrWallet } from './keplr'

export type WalletType = 'evm' | 'cosmos'
export type ChainType = 'sepolia' | 'polygonAmoy' | 'cosmosTestnet'

interface WalletState {
  // EVM wallet state
  evmAddress: string | null
  evmChainId: number | null
  evmConnected: boolean
  
  // Cosmos wallet state  
  cosmosAddress: string | null
  cosmosConnected: boolean
  
  // UI state
  isConnecting: boolean
  error: string | null
  activeWallet: WalletType | null
}

type WalletAction =
  | { type: 'SET_EVM_ACCOUNT'; payload: { address: string | null; chainId: number | null; connected: boolean } }
  | { type: 'SET_COSMOS_ACCOUNT'; payload: { address: string | null; connected: boolean } }
  | { type: 'SET_CONNECTING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_ACTIVE_WALLET'; payload: WalletType | null }
  | { type: 'RESET_WALLETS' }

const initialState: WalletState = {
  evmAddress: null,
  evmChainId: null,
  evmConnected: false,
  cosmosAddress: null,
  cosmosConnected: false,
  isConnecting: false,
  error: null,
  activeWallet: null,
}

function walletReducer(state: WalletState, action: WalletAction): WalletState {
  switch (action.type) {
    case 'SET_EVM_ACCOUNT':
      return {
        ...state,
        evmAddress: action.payload.address,
        evmChainId: action.payload.chainId,
        evmConnected: action.payload.connected,
        activeWallet: action.payload.connected ? 'evm' : state.activeWallet,
      }
    case 'SET_COSMOS_ACCOUNT':
      return {
        ...state,
        cosmosAddress: action.payload.address,
        cosmosConnected: action.payload.connected,
        activeWallet: action.payload.connected ? 'cosmos' : state.activeWallet,
      }
    case 'SET_CONNECTING':
      return { ...state, isConnecting: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    case 'SET_ACTIVE_WALLET':
      return { ...state, activeWallet: action.payload }
    case 'RESET_WALLETS':
      return initialState
    default:
      return state
  }
}

interface WalletContextType extends WalletState {
  connectEvm: () => Promise<void>
  connectCosmos: () => Promise<void>
  disconnectAll: () => Promise<void>
  switchEvmChain: (chainId: number) => Promise<void>
  getAddressForChain: (chain: ChainType) => string | null
  isChainSupported: (chain: ChainType) => boolean
}

const WalletContext = createContext<WalletContextType | null>(null)

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(walletReducer, initialState)
  
  // Wagmi hooks for EVM wallet
  const { address: evmAddress, isConnected: evmConnected } = useAccount()
  const evmChainId = useChainId()
  const { switchChain } = useSwitchChain()

  // Update EVM state when wagmi state changes
  useEffect(() => {
    dispatch({
      type: 'SET_EVM_ACCOUNT',
      payload: {
        address: evmAddress || null,
        chainId: evmChainId || null,
        connected: evmConnected,
      }
    })
  }, [evmAddress, evmChainId, evmConnected])

  // Check for existing Cosmos connection on mount
  useEffect(() => {
    const checkCosmosConnection = async () => {
      try {
        const address = await keplrWallet.getAddress()
        if (address) {
          dispatch({
            type: 'SET_COSMOS_ACCOUNT',
            payload: { address, connected: true }
          })
        }
      } catch (error) {
        console.error('Failed to check Cosmos connection:', error)
      }
    }

    checkCosmosConnection()
  }, [])

  const connectEvm = async () => {
    // EVM connection is handled by RainbowKit
    // This function is mainly for UI state management
    dispatch({ type: 'SET_CONNECTING', payload: true })
    dispatch({ type: 'SET_ERROR', payload: null })
    
    try {
      // RainbowKit will handle the actual connection
      // The useAccount hook will update our state
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to connect EVM wallet' })
    } finally {
      dispatch({ type: 'SET_CONNECTING', payload: false })
    }
  }

  const connectCosmos = async () => {
    dispatch({ type: 'SET_CONNECTING', payload: true })
    dispatch({ type: 'SET_ERROR', payload: null })
    
    try {
      const result = await keplrWallet.connect()
      dispatch({
        type: 'SET_COSMOS_ACCOUNT',
        payload: { address: result.address, connected: result.isConnected }
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect Cosmos wallet'
      dispatch({ type: 'SET_ERROR', payload: errorMessage })
    } finally {
      dispatch({ type: 'SET_CONNECTING', payload: false })
    }
  }

  const disconnectAll = async () => {
    try {
      // Disconnect Cosmos
      await keplrWallet.disconnect()
      
      // Reset state
      dispatch({ type: 'RESET_WALLETS' })
    } catch (error) {
      console.error('Failed to disconnect wallets:', error)
    }
  }

  const switchEvmChain = async (chainId: number) => {
    try {
      await switchChain({ chainId })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to switch chain'
      dispatch({ type: 'SET_ERROR', payload: errorMessage })
    }
  }

  const getAddressForChain = (chain: ChainType): string | null => {
    switch (chain) {
      case 'sepolia':
      case 'polygonAmoy':
        return state.evmAddress
      case 'cosmosTestnet':
        return state.cosmosAddress
      default:
        return null
    }
  }

  const isChainSupported = (chain: ChainType): boolean => {
    switch (chain) {
      case 'sepolia':
      case 'polygonAmoy':
        return true
      case 'cosmosTestnet':
        return true
      default:
        return false
    }
  }

  const contextValue: WalletContextType = {
    ...state,
    connectEvm,
    connectCosmos,
    disconnectAll,
    switchEvmChain,
    getAddressForChain,
    isChainSupported,
  }

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
} 