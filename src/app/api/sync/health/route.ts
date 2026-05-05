import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/sync/health
 *
 * Health check endpoint for the 1688 sync process.
 * Used by health monitors and Vercel cron alerts.
 *
 * Response logic:
 * - 200 + status:"ok"         — last success < 12 min ago
 * - 503 + status:"stale"      — last success >= 12 min ago
 * - 200 + status:"running"    — runningSince is set
 * - 200 + status:"skipped"    — runningSince set, skip overlap (graceful concurrency)
 */
export async function GET() {
  const state = await prisma.syncState.findUnique({
    where: { id: 'sync_state' },
  });

  if (!state) {
    return NextResponse.json(
      {
        status: 'stale',
        lastSuccess: null,
        minutesSinceLastSuccess: null,
        lastError: null,
        message: 'No sync state found — never run?',
      },
      { status: 503 }
    );
  }

  if (state.runningSince) {
    return NextResponse.json(
      {
        status: 'running',
        runningSince: state.runningSince.toISOString(),
        lastSuccess: state.lastSuccessAt?.toISOString() ?? null,
      },
      { status: 200 }
    );
  }

  if (!state.lastSuccessAt) {
    return NextResponse.json(
      {
        status: 'stale',
        lastSuccess: null,
        minutesSinceLastSuccess: null,
        lastError: state.lastError,
        lastErrorAt: state.lastErrorAt?.toISOString() ?? null,
      },
      { status: 503 }
    );
  }

  const minutesSinceLastSuccess = Math.floor(
    (Date.now() - state.lastSuccessAt.getTime()) / 60000
  );

  if (minutesSinceLastSuccess >= 12) {
    return NextResponse.json(
      {
        status: 'stale',
        lastSuccess: state.lastSuccessAt.toISOString(),
        minutesSinceLastSuccess,
        lastError: state.lastError,
        lastErrorAt: state.lastErrorAt?.toISOString() ?? null,
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    status: 'ok',
    lastSuccess: state.lastSuccessAt.toISOString(),
    minutesSinceLastSuccess,
    lastError: state.lastError,
  });
}
