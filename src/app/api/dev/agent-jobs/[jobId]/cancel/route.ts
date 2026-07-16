import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getJobById, transitionJobState } from '@/lib/dev-agent-job';

export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> | { jobId: string } }) {
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

    if (!['queued', 'analyzing', 'planning', 'editing', 'reviewing'].includes(job.state)) {
      return NextResponse.json({ error: 'Job is not in a cancellable state' }, { status: 400 });
    }

    await transitionJobState(jobId, 'failed', 'Agent run cancelled by the developer.');

    return NextResponse.json({
      success: true,
      message: 'Agent job cancelled successfully.'
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
