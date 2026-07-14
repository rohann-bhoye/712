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
  const dockerRunCmd = `docker run -d --name ${containerName} -p ${port}:3000 --memory="512m" node:20-alpine sleep infinity`;
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

export async function writeContainerFile(containerName: string, filePath: string, content: string): Promise<void> {
  const dir = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '';
  if (dir) {
    await execAsync(`docker exec ${containerName} mkdir -p /app/${dir}`);
  }

  return new Promise((resolve, reject) => {
    const child = exec(`docker exec -i ${containerName} sh -c "cat > /app/${filePath}"`, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve();
      }
    });
    child.stdin?.write(content);
    child.stdin?.end();
  });
}

/**
 * Starts the project dev/preview server inside the container.
 * Runs npm start (or npm run dev) detached in background.
 */
export async function startContainerApp(containerName: string): Promise<void> {
  try {
    await execAsync(
      `docker exec -d -w /app ${containerName} sh -c "nohup npm start > /app/.preview.log 2>&1 &"`
    );
  } catch {
    await execAsync(
      `docker exec -d -w /app ${containerName} sh -c "nohup npm run dev > /app/.preview.log 2>&1 &"`
    );
  }
}

/**
 * Polls inside the container (up to maxWaitMs) to detect which port the app is listening on.
 * Returns the internal container port (e.g. 3000) if found, otherwise null.
 */
export async function scanContainerPort(
  containerName: string,
  maxWaitMs = 30000
): Promise<number | null> {
  const interval = 2000;
  const maxAttempts = Math.ceil(maxWaitMs / interval);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, interval));
    try {
      const { stdout } = await execAsync(
        `docker exec ${containerName} sh -c "ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null"`
      );
      const lines = stdout.split('\n');
      for (const line of lines) {
        const match = line.match(/:(\d{4,5})\s/);
        if (match) {
          const port = parseInt(match[1], 10);
          if (port >= 1024) {
            return port;
          }
        }
      }
    } catch {
      // Still starting — keep polling
    }
  }
  return null;
}

/**
 * Returns the host-mapped port for a given internal container port via docker inspect.
 */
export async function getHostPort(containerName: string, containerPort: number): Promise<number | null> {
  try {
    const { stdout } = await execAsync(
      `docker inspect --format "{{(index (index .NetworkSettings.Ports \\"${containerPort}/tcp\\") 0).HostPort}}" ${containerName}`
    );
    const port = parseInt(stdout.trim(), 10);
    return isNaN(port) ? null : port;
  } catch {
    return null;
  }
}

