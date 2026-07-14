import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { startContainerApp, scanContainerPort } from '@/lib/dev-workspace-docker';
import { execSync } from 'child_process';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> | { workspaceId: string } }
) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = await params;
    const { db } = await connectToDatabase();

    const workspace = await db.collection('dev_workspaces').findOne({
      _id: new ObjectId(workspaceId),
      userId: session.userId
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // If we already have a stored preview URL, return it immediately
    if (workspace.previewUrl) {
      return NextResponse.json({
        success: true,
        previewUrl: workspace.previewUrl,
        ports: workspace.ports || []
      });
    }

    // No preview URL yet — try to start the app and scan for the port
    if (!workspace.containerId) {
      return NextResponse.json({
        success: false,
        error: 'No active container found for this workspace. Run an agent job first.'
      }, { status: 404 });
    }

    const containerName = workspace.containerId as string;

    // Start the app server and wait for it to bind a port
    await startContainerApp(containerName);
    const internalPort = await scanContainerPort(containerName, 30000);

    if (!internalPort) {
      return NextResponse.json({
        success: false,
        error: 'Preview server did not start within 30 seconds. The project may not have a start script.'
      }, { status: 408 });
    }

    const previewUrl = `http://localhost:${internalPort}`;

    // Persist preview URL and port for subsequent calls
    await db.collection('dev_workspaces').updateOne(
      { _id: new ObjectId(workspaceId) },
      { $set: { ports: [internalPort], previewUrl, updatedAt: new Date() } }
    );

    return NextResponse.json({
      success: true,
      previewUrl,
      ports: [internalPort]
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// Optional: GET preview logs from the running container
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> | { workspaceId: string } }
) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = await params;
    const { db } = await connectToDatabase();

    const workspace = await db.collection('dev_workspaces').findOne({
      _id: new ObjectId(workspaceId),
      userId: session.userId
    });

    if (!workspace?.containerId) {
      return NextResponse.json({ error: 'No active container' }, { status: 404 });
    }

    try {
      const logs = execSync(
        `docker exec ${workspace.containerId} sh -c "tail -n 50 /app/.preview.log 2>/dev/null || echo 'No preview logs yet'"`
      ).toString();
      return NextResponse.json({ success: true, logs });
    } catch {
      return NextResponse.json({ success: true, logs: 'No preview logs available.' });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
