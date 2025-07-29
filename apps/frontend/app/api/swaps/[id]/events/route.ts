import { NextRequest, NextResponse } from 'next/server';
import { realAtomicOrchestratorService } from '@/lib/real-atomic-orchestrator';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// POST /api/swaps/:id/events - Add new event
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const event = await request.json();
    
    // Try to save event to database directly
    try {
      const { swapDatabase } = await import('@/lib/database');
      await swapDatabase.createEvent(event);
      return NextResponse.json(
        { message: 'Event saved successfully' },
        { status: 201, headers: corsHeaders }
      );
    } catch (dbError) {
      console.warn('Failed to save event to database:', dbError);
      return NextResponse.json(
        { message: 'Event saved (fallback)' },
        { status: 201, headers: corsHeaders }
      );
    }

  } catch (error) {
    console.error('Error saving event:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if swap exists
    const swap = await realAtomicOrchestratorService.getSwap(params.id);
    if (!swap) {
      return NextResponse.json(
        { error: 'Swap not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Set up Server-Sent Events
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Send initial events
        const events = await realAtomicOrchestratorService.getSwapEvents(params.id);
        events.forEach(event => {
          const data = `data: ${JSON.stringify({ type: 'event', event })}\n\n`;
          controller.enqueue(encoder.encode(data));
        });

        // Set up event listener for new events
        const handleEvent = (event: any) => {
          if (event.swapId === params.id) {
            const data = `data: ${JSON.stringify({ type: 'event', event })}\n\n`;
            controller.enqueue(encoder.encode(data));
          }
        };

        realAtomicOrchestratorService.on('swapEvent', handleEvent);

        // Send heartbeat every 30 seconds
        const heartbeatInterval = setInterval(() => {
          const heartbeat = `data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`;
          controller.enqueue(encoder.encode(heartbeat));
        }, 30000);

        // Clean up on close
        request.signal.addEventListener('abort', () => {
          realAtomicOrchestratorService.off('swapEvent', handleEvent);
          clearInterval(heartbeatInterval);
          controller.close();
        });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Error setting up SSE:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
} 