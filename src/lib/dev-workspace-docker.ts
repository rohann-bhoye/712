import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function startContainer(
  workspaceId: string,
  repoFullName: string,
  branch: string,
  token: string
): Promise<{ containerName: string; port: number }> {
  const containerName = `bucketdev-ws-${workspaceId}`;
  const port = Math.floor(Math.random() * 1000) + 3000;

  // 1. Run Node container in background (sleep infinity keeps it alive)
  const dockerRunCmd = `docker run -d --name ${containerName} -p ${port}:3000 node:20-alpine sleep infinity`;
  await execAsync(dockerRunCmd);

  // 2. Install Git inside Alpine container
  await execAsync(`docker exec ${containerName} apk add --no-cache git`);

  // 3. Clone repository inside container under /app
  const cloneUrl = `https://x-token-auth:${token}@github.com/${repoFullName}.git`;
  await execAsync(`docker exec ${containerName} git clone -b ${branch} ${cloneUrl} /app`);

  // 4. Run dependency installations
  await execAsync(`docker exec -w /app ${containerName} npm install`);

  return { containerName, port };
}

export async function runContainerBuild(containerName: string): Promise<{ success: boolean; log: string }> {
  try {
    const { stdout, stderr } = await execAsync(`docker exec -w /app ${containerName} npm run build`);
    return { success: true, log: stdout || stderr };
  } catch (error: any) {
    return { success: false, log: error.stdout || error.stderr || error.message };
  }
}

export async function runContainerTest(containerName: string): Promise<{ success: boolean; log: string }> {
  try {
    const { stdout, stderr } = await execAsync(`docker exec -w /app ${containerName} npm test`);
    return { success: true, log: stdout || stderr };
  } catch (error: any) {
    return { success: false, log: error.stdout || error.stderr || error.message };
  }
}

export async function stopContainer(workspaceId: string): Promise<void> {
  const containerName = `bucketdev-ws-${workspaceId}`;
  try {
    await execAsync(`docker stop ${containerName}`);
    await execAsync(`docker rm ${containerName}`);
  } catch (error) {
    // Silently ignore if already removed
  }
}
