import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(req: NextRequest, { params }: { params: Promise<{ workspaceId: string }> | { workspaceId: string } }) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const { workspaceId } = resolvedParams;

    const { db } = await connectToDatabase();

    const result = await db.collection('dev_workspaces').updateOne(
      { _id: new ObjectId(workspaceId), userId: session.userId },
      { $set: { status: 'stopped', updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Workspace stopped successfully.'
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
