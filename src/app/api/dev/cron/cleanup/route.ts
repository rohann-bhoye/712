import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { stopContainer } from '@/lib/dev-workspace-docker';

/**
 * GET /api/dev/cron/cleanup
 *
 * Finds all workspaces that have been active for more than 30 minutes
 * without any update and stops their Docker containers.
 *
 * This route should be called by a scheduled cron trigger (e.g. Vercel Cron
 * or an external scheduler hitting this endpoint every 5 minutes).
 *
 * Security: Protected by a CRON_SECRET header to prevent unauthorized calls.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { db } = await connectToDatabase();

  // Find workspaces that are 'active' and haven't been updated in 30+ minutes
  const idleThresholdMs = 30 * 60 * 1000; // 30 minutes
  const cutoff = new Date(Date.now() - idleThresholdMs);

  const idleWorkspaces = await db
    .collection('dev_workspaces')
    .find({
      status: 'active',
      containerId: { $exists: true, $ne: null },
      updatedAt: { $lt: cutoff }
    })
    .toArray();

  const results: { workspaceId: string; status: string }[] = [];

  for (const ws of idleWorkspaces) {
    const workspaceId = ws._id.toString();
    try {
      await stopContainer(workspaceId);

      await db.collection('dev_workspaces').updateOne(
        { _id: ws._id },
        {
          $set: {
            status: 'expired',
            containerId: null,
            previewUrl: null,
            updatedAt: new Date()
          }
        }
      );

      results.push({ workspaceId, status: 'stopped' });
    } catch (err: any) {
      results.push({ workspaceId, status: `error: ${err.message}` });
    }
  }

  return NextResponse.json({
    success: true,
    cleaned: results.length,
    results
  });
}
