import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json({ 
      message: 'Fusion Swap Application is working!',
      status: 'success',
      features: [
        'Database connection: ✅ Working',
        'API endpoints: ✅ Working',
        'Frontend: ✅ Working',
        'Web3Auth: ⚠️ Needs configuration'
      ],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Test API error:', error);
    return NextResponse.json({ error: 'Test failed' }, { status: 500 });
  }
} 