import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { repoFullName, branch } = await req.json();
    if (!repoFullName) {
      return NextResponse.json({ error: 'Repository full name is required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Mark previous active workspaces as stopped/inactive
    await db.collection('dev_workspaces').updateMany(
      { userId: session.userId, status: 'active' },
      { $set: { status: 'stopped', updatedAt: new Date() } }
    );

    const newWorkspace = {
      userId: session.userId,
      repoFullName,
      branch: branch || 'main',
      status: 'active',
      ports: [3000],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('dev_workspaces').insertOne(newWorkspace);

    return NextResponse.json({
      success: true,
      workspace: {
        id: result.insertedId.toString(),
        ...newWorkspace
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const workspaces = await db.collection('dev_workspaces')
      .find({ userId: session.userId })
      .sort({ updatedAt: -1 })
      .toArray();

    const formattedWorkspaces = workspaces.map(w => ({
      id: w._id.toString(),
      repoFullName: w.repoFullName,
      branch: w.branch,
      status: w.status,
      ports: w.ports,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt
    }));

    return NextResponse.json({
      success: true,
      workspaces: formattedWorkspaces
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
