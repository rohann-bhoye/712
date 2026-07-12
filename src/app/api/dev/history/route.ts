import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const history = await db.collection('dev_history')
      .find({ userId: session.userId })
      .sort({ createdAt: -1 })
      .toArray();

    const formattedHistory = history.map(h => ({
      id: h._id.toString(),
      workspaceId: h.workspaceId,
      repoFullName: h.repoFullName,
      branch: h.branch,
      prompt: h.prompt,
      commitMessage: h.commitMessage,
      commitSha: h.commitSha,
      status: h.status,
      durationMs: h.durationMs,
      createdAt: h.createdAt
    }));

    return NextResponse.json({
      success: true,
      history: formattedHistory
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
