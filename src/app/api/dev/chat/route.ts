import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { createAgentJob } from '@/lib/dev-agent-job';
import { runAgentJob } from '@/lib/dev-agent-runner';

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId, message } = await req.json();
    if (!workspaceId || !message) {
      return NextResponse.json({ error: 'Workspace ID and message prompt are required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // 1. Check if there is already an active job for this workspace to prevent race conditions
    const activeJob = await db.collection('dev_agent_jobs').findOne({
      workspaceId,
      state: { $in: ['queued', 'analyzing', 'planning', 'editing', 'building', 'testing', 'reviewing', 'pushing'] }
    });

    if (activeJob) {
      return NextResponse.json({
        error: 'An active agent job is already executing in this workspace. Please wait or cancel the active job.'
      }, { status: 409 });
    }

    // 2. Insert User message
    const userMsg = {
      userId: session.userId,
      workspaceId,
      role: 'user',
      content: message,
      createdAt: new Date()
    };
    await db.collection('dev_conversations').insertOne(userMsg);

    // 3. Create Agent Job (state machine initialized to 'queued')
    const jobId = await createAgentJob(session.userId, workspaceId, message);

    // 4. Trigger Agent Runner in the background asynchronously
    runAgentJob(jobId).catch(err => {
      console.error('Background agent error:', err);
    });

    return NextResponse.json({
      success: true,
      message: 'Message sent and agent runner spawned.',
      jobId,
      userMessage: userMsg
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

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // 1. Fetch conversation history
    const messages = await db.collection('dev_conversations')
      .find({ userId: session.userId, workspaceId })
      .sort({ createdAt: 1 })
      .toArray();

    const formattedMessages = messages.map(m => ({
      id: m._id.toString(),
      role: m.role,
      content: m.content,
      createdAt: m.createdAt
    }));

    // 2. Fetch any active agent job
    const activeJob = await db.collection('dev_agent_jobs')
      .find({
        userId: session.userId,
        workspaceId,
        state: { $in: ['queued', 'analyzing', 'planning', 'editing', 'building', 'testing', 'reviewing', 'pushing'] }
      })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();

    let jobDetails = null;
    if (activeJob.length > 0) {
      const job = activeJob[0];
      jobDetails = {
        id: job._id.toString(),
        state: job.state,
        events: job.events,
        diffs: job.diffs,
        buildStatus: job.buildStatus,
        testStatus: job.testStatus,
        commitMessage: job.commitMessage
      };
    }

    return NextResponse.json({
      success: true,
      messages: formattedMessages,
      activeJob: jobDetails
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
