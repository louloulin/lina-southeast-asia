/**
 * LINA-159 — General Health Check Cron Endpoint
 *
 * Vercel Cron hits GET /api/cron/general-health every 10 minutes.
 * Checks all critical services (DB, sync pipeline, API self) and
 * auto-recovers stopped processes.
 *
 * Auth: Bearer token must match CRON_SECRET env var.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runAllHealthChecks } from '@/lib/health/checks';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Authenticate
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const expectedToken = process.env.CRON_SECRET ?? '';

  if (expectedToken && token !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log(`[general-health] Starting check at ${new Date().toISOString()}`);

  try {
    const { results, overallStatus, unhealthyCount, degradedCount } =
      await runAllHealthChecks();

    const isUnhealthy = overallStatus === 'unhealthy';

    console.log(
      `[general-health] ${overallStatus.toUpperCase()} — ` +
      `${unhealthyCount} unhealthy, ${degradedCount} degraded`
    );

    return NextResponse.json(
      {
        ok: !isUnhealthy,
        status: overallStatus,
        checks: results.map(r => ({
          type: r.checkType,
          status: r.status,
          message: r.message,
          responseTimeMs: r.responseTimeMs,
          recoveryAction: r.recoveryAction ?? null,
        })),
        timestamp: new Date().toISOString(),
      },
      { status: isUnhealthy ? 503 : 200 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[general-health] Unexpected error:', msg);
    // Return 200 so Vercel Cron doesn't alert on transient errors
    return NextResponse.json({ ok: false, status: 'error', error: msg });
  }
}
