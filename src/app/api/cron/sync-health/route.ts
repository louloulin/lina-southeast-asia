/**
 * LINA-128 — Health Check Cron Endpoint (Prisma-primary)
 *
 * Vercel Cron hits GET /api/cron/sync-health every 10 minutes.
 *
 * Primary source: Prisma SyncState table (always available).
 * Optional: Supabase sync_jobs table for enhanced job history (graceful fallback).
 *
 * Logic:
 * - If runningSince is set and > 15 min old → stuck job, clear it and trigger recovery
 * - If runningSince is set and < 15 min old → healthy, job is running
 * - If lastSuccessAt > 10 min ago (or never) → trigger new sync
 * - Otherwise → healthy, sync ran recently
 *
 * Auth: Bearer token in Authorization header must match CRON_SECRET env var.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSupabaseClient } from '@/lib/supabase/client';

// Allow up to 60s for sync triggered by this health check
export const maxDuration = 60;

const RUNNING_TIMEOUT_MS = 15 * 60 * 1000;  // 15 minutes
const STALE_THRESHOLD_MS = 10 * 60 * 1000;  // 10 minutes

export async function GET(request: NextRequest) {
  // 1. Authenticate
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const expectedToken = process.env.CRON_SECRET ?? '';

  if (expectedToken && token !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  console.log(`[sync-health] Starting check at ${new Date(now).toISOString()}`);

  try {
    // 2. Read sync state from Prisma (always available)
    const state = await prisma.syncState.findUnique({
      where: { id: 'sync_state' },
    });

    // 2a. No state at all — first run ever
    if (!state) {
      console.log('[sync-health] No SyncState found — triggering first sync');
      const syncResult = await safeSync();
      return NextResponse.json({
        ok: true,
        status: 'triggered',
        triggerReason: 'No previous sync state found — first run',
        sync: syncResult,
      });
    }

    // 3. Check for stuck job (runningSince set and > 15 min old)
    if (state.runningSince) {
      const elapsedMs = now - state.runningSince.getTime();
      const elapsedMin = Math.round(elapsedMs / 60000);

      if (elapsedMs > RUNNING_TIMEOUT_MS) {
        console.warn(
          `[sync-health] Stuck job detected — running for ${elapsedMin} min (> 15 min threshold). Clearing and triggering recovery.`
        );

        // Clear the stuck runningSince so the next sync can start
        await prisma.syncState.update({
          where: { id: 'sync_state' },
          data: {
            runningSince: null,
            lastError: `Auto-killed by health check — stuck for ${elapsedMin} min`,
            lastErrorAt: new Date(),
          },
        });

        // Optionally mark in Supabase sync_jobs (best-effort)
        await markStuckJobsInSupabase();

        // Trigger recovery sync
        const syncResult = await safeSync();
        return NextResponse.json({
          ok: true,
          status: 'recovered',
          ageMinutes: elapsedMin,
          message: `Stuck job cleared — new sync triggered`,
          sync: syncResult,
        });
      }

      // Job is running and hasn't timed out yet — healthy
      return NextResponse.json({
        ok: true,
        status: 'healthy',
        runningSince: state.runningSince.toISOString(),
        elapsedMinutes: elapsedMin,
        lastSuccess: state.lastSuccessAt?.toISOString() ?? null,
        message: `Sync is running (${elapsedMin} min elapsed)`,
      });
    }

    // 4. No running job — check staleness
    const lastSuccess = state.lastSuccessAt;

    if (!lastSuccess) {
      // Never completed a sync — trigger one
      console.log('[sync-health] No last success recorded — triggering sync');
      const syncResult = await safeSync();
      return NextResponse.json({
        ok: true,
        status: 'triggered',
        triggerReason: 'No previous successful sync found',
        sync: syncResult,
      });
    }

    const staleMs = now - lastSuccess.getTime();
    const staleMin = Math.round(staleMs / 60000);

    if (staleMs > STALE_THRESHOLD_MS) {
      console.log(
        `[sync-health] Last sync finished ${staleMin} min ago (> 10 min threshold) — triggering new sync`
      );
      const syncResult = await safeSync();
      return NextResponse.json({
        ok: true,
        status: 'triggered',
        triggerReason: `Last sync finished ${staleMin} min ago`,
        lastSuccess: lastSuccess.toISOString(),
        sync: syncResult,
      });
    }

    // 5. Everything healthy — sync ran recently
    return NextResponse.json({
      ok: true,
      status: 'healthy',
      lastSuccess: lastSuccess.toISOString(),
      minutesSinceLastSuccess: staleMin,
      lastError: state.lastError,
      message: 'Sync ran recently — no action needed',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sync-health] Unexpected error:', msg);
    // Return 200 so Vercel Cron doesn't alert on transient errors
    return NextResponse.json({ ok: false, status: 'error', error: msg });
  }
}

/**
 * Trigger sync with error handling — returns result or error info without throwing.
 */
async function safeSync(): Promise<{
  success: boolean;
  data?: unknown;
  error?: string;
}> {
  try {
    const { sync1688Products } = await import('@/lib/sync/pipeline');
    const result = await sync1688Products({ limit: 50 });
    return { success: true, data: result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sync-health] Sync triggered but failed:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Best-effort: mark any stuck running jobs in Supabase sync_jobs table as failed.
 * Silently ignores errors if Supabase is unavailable or table doesn't exist yet.
 */
async function markStuckJobsInSupabase(): Promise<void> {
  try {
    const sb = getSupabaseClient();
    if (!sb) return;

    const cutoff = new Date(Date.now() - RUNNING_TIMEOUT_MS).toISOString();
    await sb
      .from('sync_jobs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_message: `Auto-killed by health check after ${RUNNING_TIMEOUT_MS / 60000} min`,
      })
      .eq('job_type', '1688_sync')
      .eq('status', 'running')
      .lt('started_at', cutoff);
  } catch {
    // Supabase optional — ignore errors
  }
}
