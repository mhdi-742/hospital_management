import { NextRequest, NextResponse } from 'next/server';
import { eventBus } from '@/lib/eventBus';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial headers and retry timing (3 seconds) to keep connection alive
      controller.enqueue(encoder.encode('retry: 3000\n\n: connected\n\n'));

      let isClosed = false;

      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        
        eventBus.off('REFRESH_OPD', onRefreshOpd);
        eventBus.off('REFRESH_IPD', onRefreshIpd);
        eventBus.off('REFRESH_OT', onRefreshOt);
        clearInterval(pingInterval);
        
        try {
          controller.close();
        } catch {
          // Stream might already be closed
        }
      };

      const onRefreshOpd = () => {
        if (isClosed) return;
        try {
          const message = `data: {"event": "REFRESH_OPD", "time": "${new Date().toISOString()}"}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (err) {
          console.error('[SSE_ERROR] OPD enqueue failed, cleaning up:', err);
          cleanup();
        }
      };

      const onRefreshIpd = () => {
        if (isClosed) return;
        try {
          const message = `data: {"event": "REFRESH_IPD", "time": "${new Date().toISOString()}"}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (err) {
          console.error('[SSE_ERROR] IPD enqueue failed, cleaning up:', err);
          cleanup();
        }
      };

      const onRefreshOt = () => {
        if (isClosed) return;
        try {
          const message = `data: {"event": "REFRESH_OT", "time": "${new Date().toISOString()}"}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (err) {
          console.error('[SSE_ERROR] OT enqueue failed, cleaning up:', err);
          cleanup();
        }
      };

      // Add listeners to global event bus
      eventBus.on('REFRESH_OPD', onRefreshOpd);
      eventBus.on('REFRESH_IPD', onRefreshIpd);
      eventBus.on('REFRESH_OT', onRefreshOt);

      // Ping every 20 seconds to prevent connection timeouts
      const pingInterval = setInterval(() => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch (e) {
          console.error('[SSE_ERROR] Ping failed, cleaning up:');
          cleanup();
        }
      }, 20000);

      // Clean up when client disconnects
      req.signal.addEventListener('abort', () => {
        cleanup();
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
