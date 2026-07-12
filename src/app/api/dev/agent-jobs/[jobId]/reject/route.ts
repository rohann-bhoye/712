import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getJobById, transitionJobState } from '@/lib/dev-agent-job';
import { connectToDatabase } from '@/lib/mongodb';

export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> | { jobId: string } }) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { feedback } = await req.json();

    const resolvedParams = await params;
    const { jobId } = resolvedParams;

    const job = await getJobById(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.userId !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (job.state !== 'reviewing') {
      return NextResponse.json({ error: 'Job is not awaiting review' }, { status: 400 });
    }

    // 1. Transition state to 'failed'
    const message = feedback ? `Changes rejected by developer: "${feedback}"` : 'Changes rejected by developer.';
    await transitionJobState(jobId, 'failed', message);

    const { db } = await connectToDatabase();

    // 2. Insert summary message into conversations
    const assistantMsg = `The code changes were rejected.
Reason/Feedback: "${feedback || 'No feedback provided'}"
You can modify your prompt or write a new one to try again.`;

    await db.collection('dev_conversations').insertOne({
      userId: session.userId,
      workspaceId: job.workspaceId,
      role: 'assistant',
      content: assistantMsg,
      createdAt: new Date()
    });

    return NextResponse.json({
      success: true,
      message: 'Code modifications rejected successfully.'
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
