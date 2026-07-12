import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getJobById, transitionJobState } from '@/lib/dev-agent-job';
import { connectToDatabase } from '@/lib/mongodb';
import { pushFilesToGithub } from '@/lib/dev-github';
import { ObjectId } from 'mongodb';

export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> | { jobId: string } }) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { commitMessage } = await req.json();
    
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

    // 1. Transition state to 'pushing'
    const finalCommitMsg = commitMessage || job.commitMessage || `feat: ${job.prompt.slice(0, 50)}`;
    await transitionJobState(jobId, 'pushing', `Committing changes directly to GitHub branch: "${finalCommitMsg}"`);

    const { db } = await connectToDatabase();

    // 2. Fetch workspace to get repo and branch details
    const workspace = await db.collection('dev_workspaces').findOne({ _id: new ObjectId(job.workspaceId) });
    if (!workspace) {
      await transitionJobState(jobId, 'failed', 'Workspace details not found.');
      return NextResponse.json({ error: 'Workspace details not found' }, { status: 404 });
    }

    // 3. Fetch token
    const user = await db.collection('dev_users').findOne({ _id: new ObjectId(job.userId) });
    const token = user?.githubToken || process.env.GITHUB_TOKEN || '';

    if (!token) {
      await transitionJobState(jobId, 'failed', 'No GitHub credentials found for push.');
      return NextResponse.json({ error: 'No GitHub credentials found' }, { status: 400 });
    }

    // 4. Perform direct GitHub Database API push
    let commitSha = '';
    try {
      // Parse files diffs
      if (!job.diffs) {
        throw new Error('No files found to commit.');
      }
      const filesMap = JSON.parse(job.diffs);
      const filesList = Object.keys(filesMap).map(path => ({
        path,
        content: filesMap[path]
      }));

      const owner = workspace.repoFullName.split('/')[0];
      const repo = workspace.repoFullName.split('/')[1];

      commitSha = await pushFilesToGithub(
        owner,
        repo,
        workspace.branch || 'main',
        filesList,
        finalCommitMsg,
        token
      );
    } catch (e: any) {
      await transitionJobState(jobId, 'failed', `GitHub Write pipeline failed: ${e.message || e}`);
      return NextResponse.json({ success: false, error: `GitHub write failed: ${e.message}` }, { status: 500 });
    }

    // 5. Complete task
    await transitionJobState(jobId, 'completed', 'Changes merged and pushed successfully.', {
      commitMessage: finalCommitMsg
    });

    // 6. Insert history record
    await db.collection('dev_history').insertOne({
      userId: session.userId,
      workspaceId: job.workspaceId,
      prompt: job.prompt,
      repoFullName: workspace.repoFullName,
      branch: workspace.branch,
      commitMessage: finalCommitMsg,
      commitSha,
      status: 'completed',
      durationMs: Date.now() - job.createdAt.getTime(),
      createdAt: new Date()
    });

    // 7. Write Assistant summary message to the chat
    const assistantSummary = `I have successfully committed and pushed the changes to GitHub!
- **Branch**: \`${workspace.branch}\`
- **Commit Message**: "${finalCommitMsg}"
- **SHA**: \`${commitSha.slice(0, 7)}\``;

    await db.collection('dev_conversations').insertOne({
      userId: session.userId,
      workspaceId: job.workspaceId,
      role: 'assistant',
      content: assistantSummary,
      createdAt: new Date()
    });

    return NextResponse.json({
      success: true,
      message: 'Changes approved, committed, and pushed successfully.',
      commitSha
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
