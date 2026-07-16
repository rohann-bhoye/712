import axios from 'axios';

export interface FileChange {
  path: string;
  content: string;
}

export async function getGithubHeaders(token: string) {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'BucketDev-Agent'
  };
}

export async function pushFilesToGithub(
  owner: string,
  repo: string,
  branch: string,
  files: FileChange[],
  commitMessage: string,
  token: string
): Promise<string> {
  const headers = await getGithubHeaders(token);
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;
  
  const refRes = await axios.get(`${baseUrl}/git/ref/heads/${branch}`, { headers });
  const latestCommitSha = refRes.data.object.sha;
  
  const commitRes = await axios.get(`${baseUrl}/git/commits/${latestCommitSha}`, { headers });
  const baseTreeSha = commitRes.data.tree.sha;
  
  const treeNodes = [];
  for (const file of files) {
    const blobRes = await axios.post(
      `${baseUrl}/git/blobs`,
      {
        content: file.content,
        encoding: 'utf-8',
      },
      { headers }
    );
    treeNodes.push({
      path: file.path,
      mode: '100644',
      type: 'blob',
      sha: blobRes.data.sha,
    });
  }
  
  const treeRes = await axios.post(
    `${baseUrl}/git/trees`,
    {
      base_tree: baseTreeSha,
      tree: treeNodes,
    },
    { headers }
  );
  const newTreeSha = treeRes.data.sha;
  
  const newCommitRes = await axios.post(
    `${baseUrl}/git/commits`,
    {
      message: commitMessage,
      tree: newTreeSha,
      parents: [latestCommitSha],
    },
    { headers }
  );
  const newCommitSha = newCommitRes.data.sha;
  
  await axios.patch(
    `${baseUrl}/git/refs/heads/${branch}`,
    {
      sha: newCommitSha,
      force: false,
    },
    { headers }
  );
  
  return newCommitSha;
}

export async function fetchRepoFileContent(
  owner: string,
  repo: string,
  path: string,
  branch: string,
  token: string
): Promise<string> {
  const headers = await getGithubHeaders(token);
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;
  try {
    const res = await axios.get(`${baseUrl}/contents/${path}?ref=${branch}`, { headers });
    if (res.data && res.data.content) {
      return Buffer.from(res.data.content, 'base64').toString('utf8');
    }
    return '';
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      return '';
    }
    throw error;
  }
}

export async function fetchRepoTree(
  owner: string,
  repo: string,
  branch: string,
  token: string
): Promise<string[]> {
  const headers = await getGithubHeaders(token);
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;
  try {
    const res = await axios.get(`${baseUrl}/git/trees/${branch}?recursive=1`, { headers });
    if (res.data && Array.isArray(res.data.tree)) {
      return res.data.tree
        .filter((item: any) => item.type === 'blob')
        .map((item: any) => item.path);
    }
    return [];
  } catch (error) {
    throw error;
  }
}
