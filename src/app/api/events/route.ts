import { NextRequest, NextResponse } from 'next/server';
import { eventBus } from '@/lib/eventBus';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial headers/ping to keep connection alive
      controller.enqueue(encoder.encode(': connected\n\n'));

      // The listener function
      const onRefresh = () => {
        try {
          // SSE format requires "data: {payload}\n\n"
          const message = `data: {"event": "REFRESH_OPD", "time": "${new Date().toISOString()}"}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (err) {
          console.error('[SSE_ERROR]', err);
        }
      };

      // Add listener to global event bus
      eventBus.on('REFRESH_OPD', onRefresh);

      // Ping every 30 seconds to keep connection alive
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch (e) {
          clearInterval(pingInterval);
        }
      }, 30000);

      // Clean up when client disconnects
      req.signal.addEventListener('abort', () => {
        eventBus.off('REFRESH_OPD', onRefresh);
        clearInterval(pingInterval);
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // For Nginx if used
    },
  });
}
