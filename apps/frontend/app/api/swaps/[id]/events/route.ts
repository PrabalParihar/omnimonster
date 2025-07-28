import { NextRequest } from 'next/server';
import { getOrchestrator } from '../../../../../lib/orchestrator-service';

// GET /api/swaps/:id/events - Server-Sent Events stream
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const swapId = params.id;

  if (!swapId) {
    return new Response('Swap ID is required', { status: 400 });
  }

  const orchestrator = getOrchestrator();
  const swap = orchestrator.getSwap(swapId);

  if (!swap) {
    return new Response('Swap not found', { status: 404 });
  }

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const data = `data: ${JSON.stringify({ 
        type: 'connected', 
        swapId, 
        timestamp: Date.now() 
      })}\n\n`;
      controller.enqueue(new TextEncoder().encode(data));

      // Send existing events first
      const existingEvents = orchestrator.getSwapEvents(swapId);
      existingEvents.forEach(event => {
        const eventData = `data: ${JSON.stringify({
          type: 'event',
          event,
          timestamp: Date.now()
        })}\n\n`;
        controller.enqueue(new TextEncoder().encode(eventData));
      });

      // Listen for new events
      const handleEvent = (event: any) => {
        const eventData = `data: ${JSON.stringify({
          type: 'event',
          event,
          timestamp: Date.now()
        })}\n\n`;
        controller.enqueue(new TextEncoder().encode(eventData));
      };

      // Listen for events specific to this swap
      orchestrator.on(`swap-event-${swapId}`, handleEvent);

      // Cleanup function
      const cleanup = () => {
        orchestrator.off(`swap-event-${swapId}`, handleEvent);
      };

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        cleanup();
        controller.close();
      });

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          const heartbeatData = `data: ${JSON.stringify({ 
            type: 'heartbeat', 
            timestamp: Date.now() 
          })}\n\n`;
          controller.enqueue(new TextEncoder().encode(heartbeatData));
        } catch (error) {
          // Connection closed
          clearInterval(heartbeat);
          cleanup();
        }
      }, 30000); // Every 30 seconds

      // Auto-cleanup after swap completion or failure
      const checkSwapStatus = () => {
        const currentSwap = orchestrator.getSwap(swapId);
        if (currentSwap && ['completed', 'failed', 'refunded'].includes(currentSwap.status)) {
          // Send final status and close
          const finalData = `data: ${JSON.stringify({
            type: 'swap-final',
            status: currentSwap.status,
            timestamp: Date.now()
          })}\n\n`;
          controller.enqueue(new TextEncoder().encode(finalData));
          
          setTimeout(() => {
            clearInterval(heartbeat);
            cleanup();
            controller.close();
          }, 5000); // Close after 5 seconds
        }
      };

      // Check status periodically
      const statusCheck = setInterval(checkSwapStatus, 10000); // Every 10 seconds

      // Cleanup status checker when connection closes
      request.signal.addEventListener('abort', () => {
        clearInterval(statusCheck);
        clearInterval(heartbeat);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
} 