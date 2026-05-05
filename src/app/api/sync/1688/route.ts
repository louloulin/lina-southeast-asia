import { NextRequest, NextResponse } from 'next/server';
import { sync1688Products } from '@/lib/sync';
import { prisma } from '@/lib/prisma';
import { isSupabaseConfigured } from '@/lib/supabase/client';

export const maxDuration = 60; // Allow up to 60s for sync

export async function POST(request: NextRequest) {
  try {
    // Graceful concurrency: skip if a previous run is still in progress
    // (covers both cron-triggered and manual POST calls)
    const state = await prisma.syncState.findUnique({
      where: { id: 'sync_state' },
    });
    if (state?.runningSince) {
      const elapsedMin = Math.round(
        (Date.now() - state.runningSince.getTime()) / 60000
      );
      return NextResponse.json({
        success: true,
        status: 'skipped',
        runningSince: state.runningSince.toISOString(),
        elapsedMinutes: elapsedMin,
        message: `Sync already in progress for ${elapsedMin} min — skipped to prevent overlap`,
      });
    }

    const body = await request.json().catch(() => ({}));
    const { limit, itemId } = body as { limit?: number; itemId?: string };

    const result = await sync1688Products({ limit: limit ?? 50, itemId });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Sync pipeline error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Vercel Cron triggers GET every 10 min — run sync and return status
// Manual GET returns current sync pipeline status
//
// Vercel Cron alerts: alert config in vercel.json fires when cron misses its
// 12-minute window. To configure alert recipients, add notification hooks:
//   https://vercel.com/docs/cron-jobs/manage-cron-jobs#configure-notifications
export async function GET(request: NextRequest) {
  try {
    // Vercel Cron injects this header; if present, treat as scheduled run
    const isCron = request.headers.get('x-vercel-cron') !== null;

    if (isCron) {
      // Graceful concurrency: skip if previous run still in progress
      const cronState = await prisma.syncState.findUnique({
        where: { id: 'sync_state' },
      });
      if (cronState?.runningSince) {
        const elapsedMin = Math.round(
          (Date.now() - cronState.runningSince.getTime()) / 60000
        );
        return NextResponse.json({
          success: true,
          status: 'skipped',
          triggeredBy: 'cron',
          runningSince: cronState.runningSince.toISOString(),
          elapsedMinutes: elapsedMin,
          message: `Previous cron run still in progress for ${elapsedMin} min — skipped`,
        });
      }

      const result = await sync1688Products({ limit: 50 });
      return NextResponse.json({
        success: true,
        triggeredBy: 'cron',
        sync: result,
      });
    }

    // Manual / status request
    const localProductCount = await prisma.product.count({
      where: { sourcePlatform: 'ALI_1688' },
    });

    return NextResponse.json({
      message: '1688 Product Sync Pipeline',
      supabaseConfigured: isSupabaseConfigured(),
      localStorefront: {
        platform: 'Prisma SQLite',
        ali1688Products: localProductCount,
      },
      usage: {
        POST: {
          url: '/api/sync/1688',
          body: {
            limit: 'number (optional, default 50)',
            itemId: 'string (optional, sync single product by 1688 item ID)',
          },
        },
        GET: 'Returns sync status; x-vercel-cron header triggers automated sync',
      },
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}