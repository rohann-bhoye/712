import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getJobById } from '@/lib/dev-agent-job';

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> | { jobId: string } }) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const { jobId } = resolvedParams;

    const job = await getJobById(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.userId !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      job: {
        id: job._id?.toString(),
        workspaceId: job.workspaceId,
        prompt: job.prompt,
        state: job.state,
        events: job.events,
        diffs: job.diffs,
        commitMessage: job.commitMessage,
        buildStatus: job.buildStatus,
        testStatus: job.testStatus,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
