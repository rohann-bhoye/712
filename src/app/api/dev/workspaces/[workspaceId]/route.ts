import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

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

    return NextResponse.json({
      success: true,
      workspace: {
        id: workspace._id.toString(),
        repoFullName: workspace.repoFullName,
        branch: workspace.branch,
        status: workspace.status,
        ports: workspace.ports || [],
        containerId: workspace.containerId || null,
        previewUrl: workspace.previewUrl || null,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
