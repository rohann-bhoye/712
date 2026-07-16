import { transitionJobState, getJobById } from './dev-agent-job';
import { getAIResponse } from './dev-ai-adapter';
import { fetchRepoFileContent, fetchRepoTree } from './dev-github';
import { connectToDatabase } from './mongodb';
import { ObjectId } from 'mongodb';
import { decrypt } from './secrets';
import { createTwoFilesPatch } from 'diff';
import { logger, logApiError } from './logger';
import { captureError } from './sentry';

export async function runAgentJob(jobId: string) {
  try {
    const job = await getJobById(jobId);
    if (!job) return;

    const { db } = await connectToDatabase();
    
    // 1. ANALYZING stage
    await transitionJobState(jobId, 'analyzing', 'Listing repository file structure via GitHub API.');

    // Get workspace details
    const workspace = await db.collection('dev_workspaces').findOne({ _id: new ObjectId(job.workspaceId) });
    if (!workspace) {
      await transitionJobState(jobId, 'failed', 'Workspace not found.');
      return;
    }

    // Get user token and decrypt if encrypted
    const user = await db.collection('dev_users').findOne({ _id: new ObjectId(job.userId) });
    let token = '';
    if (user?.githubToken) {
      try {
        token = decrypt(user.githubToken);
      } catch {
        token = user.githubToken;
      }
    } else {
      token = process.env.GITHUB_TOKEN || '';
    }

    const owner = workspace.repoFullName.split('/')[0];
    const repo = workspace.repoFullName.split('/')[1];
    const branch = workspace.branch || 'main';

    // Fetch repository tree
    let filePaths: string[] = [];
    try {
      filePaths = await fetchRepoTree(owner, repo, branch, token);
      await transitionJobState(jobId, 'analyzing', `Found ${filePaths.length} files in the repository tree.`);
    } catch (e: any) {
      await transitionJobState(jobId, 'failed', `Failed to fetch repo structure from GitHub: ${e.message || e}`);
      return;
    }

    // 2. PLANNING stage
    await transitionJobState(jobId, 'planning', 'AI is planning files to edit based on your prompt.');
    
    const fileSelectionPrompt = `
    You are an AI coding assistant. The user wants to: "${job.prompt}".
    Here is a list of all files in the repository:
    ${JSON.stringify(filePaths, null, 2)}

    Identify which files (up to 3) need to be read, modified, or created to complete the user's request.
    Respond in this exact JSON format (do not wrap it in markdown code blocks or add any other text):
    {
      "files": ["relative/path/to/file1.ext", "relative/path/to/file2.ext"]
    }
    `;

    let chosenFiles: string[] = [];
    try {
      const response = await getAIResponse(job.userId, [
        { role: 'system', content: 'You are a precise routing agent. Respond with raw JSON only.' },
        { role: 'user', content: fileSelectionPrompt }
      ]);
      const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      chosenFiles = parsed.files || [];
      chosenFiles = chosenFiles.map(f => f.trim()).filter(f => f.length > 0);
    } catch (err) {
      chosenFiles = ['README.md'];
    }

    if (chosenFiles.length === 0) {
      chosenFiles = ['README.md'];
    }

    // 3. EDITING stage
    await transitionJobState(jobId, 'editing', `Fetching contents and applying AI edits to files: ${chosenFiles.join(', ')}`);

    // Fetch contents
    const originalContents: Record<string, string> = {};
    for (const filePath of chosenFiles) {
      try {
        const content = await fetchRepoFileContent(owner, repo, filePath, branch, token);
        originalContents[filePath] = content;
      } catch (err) {
        originalContents[filePath] = ''; // New file
      }
    }

    const aiSystemInstructions = `
    You are an AI coding assistant. The user wants to: "${job.prompt}".
    
    Here are the files you selected for modification and their current contents:
    ${chosenFiles.map(filePath => `
    --- FILE: ${filePath} ---
    ${originalContents[filePath] || '(empty / new file)'}
    -------------------------
    `).join('\n')}

    For each file, generate the complete, correct new content. Return your response in this exact JSON format (and DO NOT wrap it in markdown code blocks or add any other text):
    {
      "edits": [
        {
          "filePath": "relative/path/to/file1.ext",
          "explanation": "Brief explanation of what changed",
          "codeContent": "Complete new content of the file"
        }
      ]
    }
    `;

    const aiResponseText = await getAIResponse(job.userId, [
      { role: 'system', content: 'You are a professional code generator. Respond with raw JSON only.' },
      { role: 'user', content: aiSystemInstructions }
    ]);

    let edits: Array<{ filePath: string; explanation: string; codeContent: string }> = [];
    try {
      const cleanJson = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      edits = parsed.edits || [];
    } catch (e) {
      edits = [{
        filePath: chosenFiles[0],
        explanation: 'AI generated contents',
        codeContent: aiResponseText
      }];
    }

    // Build diffs structure
    const diffsObj: Record<string, { before: string; after: string; patch: string }> = {};
    for (const edit of edits) {
      const path = edit.filePath;
      const afterContent = edit.codeContent;
      const beforeContent = originalContents[path] || '';
      
      const patch = createTwoFilesPatch(path, path, beforeContent, afterContent, 'Original', 'Modified');
      diffsObj[path] = {
        before: beforeContent,
        after: afterContent,
        patch
      };
    }

    const diffsStr = JSON.stringify(diffsObj);

    // 4. REVIEWING stage
    await transitionJobState(jobId, 'reviewing', 'Agent code modifications completed. Awaiting developer approval.', {
      diffs: diffsStr,
      commitMessage: `feat: ${job.prompt.slice(0, 50)}`
    });

  } catch (error: any) {
    logApiError('runAgentJob', error, { jobId });
    captureError(error, { route: 'runAgentJob', extra: { jobId } });
    logger.error('Agent job failed', { jobId, message: error.message });
    await transitionJobState(jobId, 'failed', `Agent execution failed: ${error.message || error}`);
  }
}
