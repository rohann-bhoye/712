import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

const startTime = Date.now();

/**
 * GET /api/health
 *
 * Returns the operational status of the BucketDev API.
 * Used by Vercel, Render, and uptime monitors (e.g. UptimeRobot).
 *
 * Response shape:
 * {
 *   status: 'ok' | 'degraded',
 *   uptime: number,          // seconds since server start
 *   timestamp: string,       // ISO date
 *   version: string,
 *   services: {
 *     database: 'ok' | 'error'
 *   }
 * }
 */
export async function GET() {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  let dbStatus: 'ok' | 'error' = 'error';
  try {
    const { db } = await connectToDatabase();
    // Lightweight ping to verify connection is alive
    await db.command({ ping: 1 });
    dbStatus = 'ok';
  } catch {
    dbStatus = 'error';
  }

  const allHealthy = dbStatus === 'ok';

  return NextResponse.json(
    {
      status: allHealthy ? 'ok' : 'degraded',
      uptime: uptimeSeconds,
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0',
      services: {
        database: dbStatus
      }
    },
    { status: allHealthy ? 200 : 503 }
  );
}
