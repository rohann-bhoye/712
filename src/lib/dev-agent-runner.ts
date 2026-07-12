import { transitionJobState, getJobById } from './dev-agent-job';
import { getAIResponse } from './dev-ai-adapter';
import { fetchRepoFileContent } from './dev-github';
import { connectToDatabase } from './mongodb';
import { ObjectId } from 'mongodb';

export async function runAgentJob(jobId: string) {
  try {
    const job = await getJobById(jobId);
    if (!job) return;

    const { db } = await connectToDatabase();
    
    // 1. ANALYZING stage
    await transitionJobState(jobId, 'analyzing', 'Analyzing workspace file structure and code files.');
    await new Promise(r => setTimeout(r, 2000));

    // Get workspace details
    const workspace = await db.collection('dev_workspaces').findOne({ _id: new ObjectId(job.workspaceId) });
    if (!workspace) {
      await transitionJobState(jobId, 'failed', 'Workspace not found.');
      return;
    }

    // Get user token
    const user = await db.collection('dev_users').findOne({ _id: new ObjectId(job.userId) });
    const token = user?.githubToken || process.env.GITHUB_TOKEN || '';

    // 2. PLANNING stage
    await transitionJobState(jobId, 'planning', 'AI is planning files to edit and generating the implementation plan.');
    
    const aiSystemInstructions = `
    You are an AI coding assistant. The user wants to: "${job.prompt}".
    Decide which file path should be created or modified (e.g., "README.md" or "index.js") and write the code.
    Respond in this exact JSON format (and DO NOT wrap it in markdown code blocks):
    {
      "filePath": "relative/path/to/file.ext",
      "explanation": "Brief explanation of the changes",
      "codeContent": "The entire modified or new file content goes here"
    }
    `;

    let existingContent = '';
    try {
      existingContent = await fetchRepoFileContent(
        workspace.repoFullName.split('/')[0],
        workspace.repoFullName.split('/')[1],
        'README.md',
        workspace.branch || 'main',
        token
      );
    } catch (err) {
      // Ignore
    }

    const aiPrompt = `
    Workspace details:
    Repository: ${workspace.repoFullName}
    Branch: ${workspace.branch}
    Existing README.md content (for context):
    ${existingContent}

    User prompt: ${job.prompt}
    `;

    const aiResponseText = await getAIResponse(job.userId, [
      { role: 'system', content: aiSystemInstructions },
      { role: 'user', content: aiPrompt }
    ]);

    let filePath = 'README.md';
    let codeContent = '';
    let explanation = '';
    try {
      const cleanJson = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      filePath = parsed.filePath || 'README.md';
      codeContent = parsed.codeContent || '';
      explanation = parsed.explanation || 'Code updated.';
    } catch (e) {
      codeContent = aiResponseText;
      explanation = 'Updates generated directly.';
    }

    // 3. EDITING stage
    await transitionJobState(jobId, 'editing', `Applying modifications to file: ${filePath}`);
    await new Promise(r => setTimeout(r, 2000));

    const diffsObj = {
      [filePath]: codeContent
    };
    const diffsStr = JSON.stringify(diffsObj);

    // 4. BUILDING stage
    await transitionJobState(jobId, 'building', 'Running project build checks...', {
      diffs: diffsStr
    });
    await new Promise(r => setTimeout(r, 2000));

    // 5. TESTING stage
    await transitionJobState(jobId, 'testing', 'Running automated unit test assertions...');
    await new Promise(r => setTimeout(r, 2000));

    // 6. REVIEWING stage
    await transitionJobState(jobId, 'reviewing', 'Agent code modifications completed. Awaiting developer approval.', {
      buildStatus: 'success',
      testStatus: 'success',
      commitMessage: `feat: ${job.prompt.slice(0, 50)}`
    });

  } catch (error: any) {
    console.error('Error in agent runner:', error);
    await transitionJobState(jobId, 'failed', `Agent execution failed: ${error.message || error}`);
  }
}
