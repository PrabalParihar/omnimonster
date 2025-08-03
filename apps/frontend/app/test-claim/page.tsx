'use client'

import { ethers } from 'ethers'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

export default function TestClaimPage() {
  const [status, setStatus] = useState('')
  
  const testClaim = async () => {
    try {
      setStatus('Connecting to wallet...')
      
      if (!window.ethereum) {
        throw new Error('No wallet found')
      }
      
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      
      // Switch to Sepolia
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xaa36a7' }],
      })
      
      const htlcAddress = '0x5d981ca300DDAAb10D2bD98E3115264C1A2c168D'
      const contractId = '0x83277009fdf54e2dbcb3778c4089343dde724aa0e3dba7dab36a9511d12107b6'
      const preimage = '0x68d976a8a6b4b40f59aa878f756c4824b10a3bb41bda67102e1fdf4d94383c68'
      
      setStatus('Reading HTLC state...')
      
      const htlc = new ethers.Contract(
        htlcAddress,
        [
          'function getDetails(bytes32) view returns (address,address,address,bytes32,uint256,uint256,uint8)',
          'function claim(bytes32,bytes32) external'
        ],
        signer
      )
      
      const details = await htlc.getDetails(contractId)
      setStatus(`HTLC State: ${details[6]} (0=INVALID, 1=FUNDED, 2=CLAIMED, 3=REFUNDED)`)
      
      if (details[6].toString() === '1') {
        setStatus('HTLC is FUNDED! Claiming...')
        
        const tx = await htlc.claim(contractId, preimage)
        setStatus(`Transaction sent: ${tx.hash}`)
        
        const receipt = await tx.wait()
        setStatus(`Success! Block: ${receipt.blockNumber}`)
      }
      
    } catch (error: any) {
      setStatus(`Error: ${error.message}`)
      console.error(error)
    }
  }
  
  return (
    <div className="p-8">
      <h1 className="text-2xl mb-4">Test HTLC Claim</h1>
      
      <div className="space-y-4 mb-4">
        <p>HTLC: 0x5d981ca300DDAAb10D2bD98E3115264C1A2c168D</p>
        <p>Contract ID: 0x83277009fdf54e2dbcb3778c4089343dde724aa0e3dba7dab36a9511d12107b6</p>
        <p>Preimage: 0x68d976a8a6b4b40f59aa878f756c4824b10a3bb41bda67102e1fdf4d94383c68</p>
      </div>
      
      <Button onClick={testClaim}>Test Claim</Button>
      
      <div className="mt-4 p-4 bg-gray-100 rounded">
        <pre>{status}</pre>
      </div>
    </div>
  )
}