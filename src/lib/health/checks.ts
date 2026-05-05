/**
 * LINA-159 — General health check library
 *
 * Composable health checks for the general-health cron endpoint.
 * Each check returns a result with status, message, and optional recovery action.
 */

import { prisma } from '@/lib/prisma';
import { getSupabaseClient } from '@/lib/supabase/client';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheckResult {
  checkType: string;
  status: HealthStatus;
  message: string;
  responseTimeMs: number;
  recoveryAction?: string;
}

const DB_TIMEOUT_MS = 5000;         // 5s threshold for degraded DB
const SYNC_STUCK_MS = 15 * 60 * 1000;  // 15 min stuck threshold
const SYNC_STALE_MS = 10 * 60 * 1000;  // 10 min stale threshold

/**
 * Check Supabase database connectivity.
 * healthy < 5s, degraded if slow but working, unhealthy on failure.
 */
export async function checkDatabase(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const sb = getSupabaseClient();
    if (!sb) {
      return {
        checkType: 'database',
        status: 'unhealthy',
        message: 'Supabase client not configured',
        responseTimeMs: Date.now() - start,
      };
    }

    // Simple connectivity check — query products with limit 1
    const { error } = await sb.from('products_1688').select('id').limit(1);
    const elapsed = Date.now() - start;

    if (error) {
      return {
        checkType: 'database',
        status: 'unhealthy',
        message: `DB query failed: ${error.message}`,
        responseTimeMs: elapsed,
      };
    }

    return {
      checkType: 'database',
      status: elapsed > DB_TIMEOUT_MS ? 'degraded' : 'healthy',
      message: elapsed > DB_TIMEOUT_MS
        ? `DB slow (${elapsed}ms > ${DB_TIMEOUT_MS}ms threshold)`
        : `DB responsive (${elapsed}ms)`,
      responseTimeMs: elapsed,
    };
  } catch (err) {
    return {
      checkType: 'database',
      status: 'unhealthy',
      message: err instanceof Error ? err.message : String(err),
      responseTimeMs: Date.now() - start,
    };
  }
}

/**
 * Check sync pipeline status using Prisma SyncState.
 * Detects stuck jobs (>15 min) and kills them, triggers recovery for stale syncs.
 */
export async function checkSyncPipeline(): Promise<HealthCheckResult> {
  const start = Date.now();
  let recoveryAction: string | undefined;

  try {
    const state = await prisma.syncState.findUnique({
      where: { id: 'sync_state' },
    });

    if (!state) {
      // No state — trigger first sync
      await triggerSync();
      return {
        checkType: 'sync_pipeline',
        status: 'healthy',
        message: 'No SyncState found — triggered first sync',
        responseTimeMs: Date.now() - start,
        recoveryAction: 'triggered_first_sync',
      };
    }

    // Check for stuck job
    if (state.runningSince) {
      const elapsedMs = Date.now() - state.runningSince.getTime();
      if (elapsedMs > SYNC_STUCK_MS) {
        const elapsedMin = Math.round(elapsedMs / 60000);
        // Kill stuck job
        await prisma.syncState.update({
          where: { id: 'sync_state' },
          data: {
            runningSince: null,
            lastError: `Killed by general-health — stuck for ${elapsedMin} min`,
            lastErrorAt: new Date(),
          },
        });
        // Mark stuck in Supabase
        await markStuckJobs();
        // Trigger recovery
        await triggerSync();
        recoveryAction = `killed_stuck_job_and_recovered (${elapsedMin} min stuck)`;
      }
    }

    // Check staleness (no running job)
    if (!state.runningSince && state.lastSuccessAt) {
      const staleMs = Date.now() - state.lastSuccessAt.getTime();
      if (staleMs > SYNC_STALE_MS) {
        const staleMin = Math.round(staleMs / 60000);
        await triggerSync();
        recoveryAction = recoveryAction ?? `triggered_stale_sync (${staleMin} min since last success)`;
      }
    }

    const message = recoveryAction
      ? `Sync pipeline recovered: ${recoveryAction}`
      : state.runningSince
        ? `Sync running (${Math.round((Date.now() - state.runningSince.getTime()) / 60000)} min)`
        : `Sync healthy (last success ${Math.round((Date.now() - (state.lastSuccessAt?.getTime() ?? Date.now())) / 60000)} min ago)`;

    return {
      checkType: 'sync_pipeline',
      status: 'healthy',
      message,
      responseTimeMs: Date.now() - start,
      recoveryAction,
    };
  } catch (err) {
    return {
      checkType: 'sync_pipeline',
      status: 'unhealthy',
      message: err instanceof Error ? err.message : String(err),
      responseTimeMs: Date.now() - start,
    };
  }
}

/**
 * API self-test — checks that the app can reach its own /api/health endpoint.
 */
export async function checkApiSelf(baseUrl?: string): Promise<HealthCheckResult> {
  const start = Date.now();
  const url = baseUrl ?? process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}/api/sync/health`
    : `http://localhost:3000/api/sync/health`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const elapsed = Date.now() - start;

    if (!res.ok) {
      return {
        checkType: 'api_self',
        status: 'degraded',
        message: `API returned ${res.status}`,
        responseTimeMs: elapsed,
      };
    }

    return {
      checkType: 'api_self',
      status: elapsed > DB_TIMEOUT_MS ? 'degraded' : 'healthy',
      message: `API responsive (${elapsed}ms)`,
      responseTimeMs: elapsed,
    };
  } catch (err) {
    return {
      checkType: 'api_self',
      status: 'unhealthy',
      message: err instanceof Error ? err.message : String(err),
      responseTimeMs: Date.now() - start,
    };
  }
}

/**
 * Run all health checks in parallel and persist results to Supabase.
 */
export async function runAllHealthChecks(baseUrl?: string): Promise<{
  results: HealthCheckResult[];
  overallStatus: HealthStatus;
  unhealthyCount: number;
  degradedCount: number;
}> {
  const checks = [checkDatabase(), checkSyncPipeline(), checkApiSelf(baseUrl)];
  const settled = await Promise.allSettled(checks);

  const results: HealthCheckResult[] = settled.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    // Map the check index to its type for the error result
    const types = ['database', 'sync_pipeline', 'api_self'];
    return {
      checkType: types[i],
      status: 'unhealthy' as HealthStatus,
      message: r.reason instanceof Error ? r.reason.message : String(r.reason),
      responseTimeMs: 0,
    };
  });

  const unhealthyCount = results.filter(r => r.status === 'unhealthy').length;
  const degradedCount = results.filter(r => r.status === 'degraded').length;

  const overallStatus: HealthStatus = unhealthyCount > 0
    ? 'unhealthy'
    : degradedCount > 0
      ? 'degraded'
      : 'healthy';

  // Persist results (best-effort, don't block on failure)
  persistResults(results).catch(() => {});

  return { results, overallStatus, unhealthyCount, degradedCount };
}

/**
 * Best-effort persist health check results to service_health_logs.
 */
async function persistResults(results: HealthCheckResult[]): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;

  const rows = results.map(r => ({
    check_type: r.checkType,
    status: r.status,
    message: r.message,
    response_time_ms: r.responseTimeMs,
    recovery_action: r.recoveryAction ?? null,
  }));

  // TODO: remove 'as any' after applying migration 20260505000001 and regenerating types
  await (sb.from as any)('service_health_logs').insert(rows);
}

/**
 * Trigger a sync with error handling.
 */
async function triggerSync(): Promise<{ success: boolean; error?: string }> {
  try {
    const { sync1688Products } = await import('@/lib/sync/pipeline');
    await sync1688Products({ limit: 50 });
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[general-health] Sync trigger failed:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Mark stuck running jobs in Supabase sync_jobs as failed (best-effort).
 */
async function markStuckJobs(): Promise<void> {
  try {
    const sb = getSupabaseClient();
    if (!sb) return;

    const cutoff = new Date(Date.now() - SYNC_STUCK_MS).toISOString();
    await sb
      .from('sync_jobs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_message: `Auto-killed by general-health after ${SYNC_STUCK_MS / 60000} min`,
      })
      .eq('job_type', '1688_sync')
      .eq('status', 'running')
      .lt('started_at', cutoff);
  } catch {
    // Best-effort
  }
}
