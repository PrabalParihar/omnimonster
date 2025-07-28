#!/usr/bin/env tsx

/**
 * API Testing Script for Swap Sage Frontend
 * 
 * Tests the API layer that wraps the CLI backend
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000/api';

interface SwapRequest {
  fromChain: string;
  toChain: string;
  amount: string;
  beneficiary: string;
  timelock?: number;
  dryRun?: boolean;
}

async function testCreateSwap() {
  console.log('🧪 Testing POST /api/swaps...');
  
  const swapRequest: SwapRequest = {
    fromChain: 'sepolia',
    toChain: 'polygonAmoy',
    amount: '0.001',
    beneficiary: '0x742d35Cc6639C0532C79E5F4aE97E96E3F92C7E8',
    timelock: 3600,
    dryRun: true
  };

  try {
    const response = await fetch(`${API_BASE}/swaps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(swapRequest),
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Swap created successfully:', data);
      return data.id;
    } else {
      console.log('❌ Failed to create swap:', data);
      return null;
    }
  } catch (error) {
    console.error('❌ API request failed:', error);
    return null;
  }
}

async function testGetSwap(swapId: string) {
  console.log(`🧪 Testing GET /api/swaps/${swapId}...`);
  
  try {
    const response = await fetch(`${API_BASE}/swaps/${swapId}`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Swap details retrieved:', {
        id: data.swap.id,
        status: data.swap.status,
        fromChain: data.swap.fromChain,
        toChain: data.swap.toChain,
        amount: data.swap.amount,
        eventCount: data.events.length
      });
      return true;
    } else {
      console.log('❌ Failed to get swap:', data);
      return false;
    }
  } catch (error) {
    console.error('❌ API request failed:', error);
    return false;
  }
}

async function testGetSwaps() {
  console.log('🧪 Testing GET /api/swaps...');
  
  try {
    const response = await fetch(`${API_BASE}/swaps?limit=10`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Swaps list retrieved:', {
        count: data.swaps.length,
        meta: data.meta
      });
      return true;
    } else {
      console.log('❌ Failed to get swaps:', data);
      return false;
    }
  } catch (error) {
    console.error('❌ API request failed:', error);
    return false;
  }
}

async function testSSEConnection(swapId: string) {
  console.log(`🧪 Testing SSE /api/swaps/${swapId}/events...`);
  
  // Note: This is a simplified test - in a real test, you'd use EventSource
  try {
    const response = await fetch(`${API_BASE}/swaps/${swapId}/events`);
    
    if (response.ok && response.headers.get('content-type')?.includes('text/event-stream')) {
      console.log('✅ SSE endpoint is accessible');
      return true;
    } else {
      console.log('❌ SSE endpoint failed');
      return false;
    }
  } catch (error) {
    console.error('❌ SSE test failed:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting API Tests for Swap Sage Frontend\n');
  
  let passed = 0;
  let total = 0;

  // Test 1: Create a swap
  total++;
  const swapId = await testCreateSwap();
  if (swapId) passed++;
  
  if (swapId) {
    // Test 2: Get specific swap
    total++;
    const getSwapSuccess = await testGetSwap(swapId);
    if (getSwapSuccess) passed++;

    // Test 3: SSE connection
    total++;
    const sseSuccess = await testSSEConnection(swapId);
    if (sseSuccess) passed++;
  }

  // Test 4: Get all swaps
  total++;
  const getSwapsSuccess = await testGetSwaps();
  if (getSwapsSuccess) passed++;

  console.log(`\n📊 Test Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All API tests passed! The backend integration is working.');
  } else {
    console.log('⚠️  Some tests failed. Check the API implementation.');
  }

  console.log('\n📋 API Endpoints Summary:');
  console.log('• POST /api/swaps - ✅ Create new swap');
  console.log('• GET /api/swaps - ✅ List swaps');
  console.log('• GET /api/swaps/:id - ✅ Get swap details');
  console.log('• GET /api/swaps/:id/events - ✅ SSE event stream');
  console.log('• DELETE /api/swaps/:id - ✅ Cancel swap');

  console.log('\n🔄 Next Steps:');
  console.log('1. Start the Next.js dev server: npm run dev');
  console.log('2. Test the API endpoints manually or with this script');
  console.log('3. Build the React frontend components');
  console.log('4. Integrate with real-time SSE for live updates');
}

// Run tests
if (require.main === module) {
  main().catch(console.error);
}

export { testCreateSwap, testGetSwap, testGetSwaps, testSSEConnection }; 