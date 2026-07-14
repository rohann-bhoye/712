# BucketDev — Project Status & Roadmap

This file is a living document that tracks the progress of the **BucketDev** project, details our architectural decisions, and lists all remaining work. It is updated at the end of every work session to keep you and your team aligned.

---

## 📊 Current Status at a Glance

* **Current Phase**: Phase 4 Complete ✅ — All phases shipped
* **Local environment**: Docker sandbox runner (Option B with 512MB RAM limits)
* **Last Updated**: July 14, 2026

---

## 🤝 Discussions & Decisions Log

### 1. The Local Docker vs. Sandbox Decision (July 13, 2026)
* **Problem**: We checked your local Docker installation and found that while the Docker CLI client is installed, the Docker daemon (Server) could not start. We diagnosed that **WSL (Windows Subsystem for Linux)** is not installed on your machine, which modern Docker Desktop needs by default.
* **Hardware Specs**: 
  - **CPU**: Intel Core i5-8265U (4 Cores) — Good.
  - **Storage**: ~173 GB Free — Excellent.
  - **RAM**: 8 GB — **Low for Docker Desktop**.
* **Decision**: Because running Docker Desktop + WSL on an 8GB RAM machine will make your laptop run very slowly and laggy during development, we decided to proceed with **Option A: Local Node Sandbox Runner**.
* **How it works**: The backend will clone repositories and run `npm run build` / `npm test` using lightweight Node.js child processes in your `712/scratch/workspaces` folder instead of heavy Docker containers. This keeps your machine fast.

### 2. Switch back to Docker with Memory Limits (July 14, 2026)
* **Problem**: The user preferred using Docker instead of the local sandbox. However, their computer has only 8GB of RAM, and running unrestricted containers would overload the memory.
* **Decision**: We reverted to Option B (Docker Sandbox Runner) but added strict `--memory="512m"` memory quotas to every container. This ensures that the containers remain extremely lightweight and won't crash the host PC.

---

## 🛠️ Completed Work

### Phase 1: Simulated MVP (Completed)
- [x] **Database Schema Setup**: Designed and created MongoDB collections (`dev_users`, `dev_workspaces`, `dev_providers`, `dev_conversations`, `dev_agent_jobs`, `dev_history`).
- [x] **BYOK Security (Secrets Encryption)**: Built robust AES-256-GCM encryption/decryption utilities to securely store third-party developer API keys.
- [x] **Provider Key Verification**: Implemented active verification endpoints (`POST /api/dev/providers/:id/verify`) for OpenAI and Google Gemini keys.
- [x] **GitHub Direct Write integration**: Designed a file modification pipeline using GitHub's Direct Database API (trees/commits), allowing edits to be pushed directly without local clones.
- [x] **Mobile Client UI**: Created an interactive Expo App (`App.tsx`) with dashboard controls, workspace logs streaming simulation, and code change approval/rejection panels.

### Phase 2: Sandbox Provisioning (Completed)
- [x] **Strict Memory Limits**: Integrated `--memory="512m"` resource quotas in container creation to ensure low memory consumption.
- [x] **File Writing Pipeline**: Added streaming stdin file copy utilities to write modified code directly into the container sandbox.
- [x] **Full Runner Integration**: Replaced simulated timeouts in `dev-agent-runner.ts` with actual Docker start, build, and test steps.
- [x] **Automated Cleanups**: Hooked up automatic container stopping and deletion in the approval route (`approve/route.ts`).

---

## 📋 Remaining Work & Roadmap

Here is the exact task list of what is left to implement, which you can use for planning or presenting at your office:

### Phase 3: Preview Proxy Gateway (Completed)
- [x] **Port Scanner** (`scanContainerPort`): Polls `ss`/`netstat` inside the running container in 2s intervals to detect which port the project server is listening on (up to 30s timeout).
- [x] **App Launcher** (`startContainerApp`): Runs `npm start` (or `npm run dev`) detached inside the container after tests pass.
- [x] **Preview URL API** (`GET /api/dev/workspaces/[workspaceId]/preview`): Starts the preview server, scans the port, persists `previewUrl` to the workspace DB record, and returns it to the mobile client.
- [x] **Preview Logs API** (`POST /api/dev/workspaces/[workspaceId]/preview`): Streams the last 50 lines of the app's preview log from inside the container.
- [x] **Single Workspace API** (`GET /api/dev/workspaces/[workspaceId]`): Returns full workspace details including `previewUrl`, `containerId`, and `ports`.
- [x] **Idle Cleanup Cron** (`GET /api/dev/cron/cleanup`): Auto-stops containers older than 30 minutes, marks workspaces as `expired`, and frees RAM/disk.
- [x] **Mobile API Updated**: Added `getWorkspace`, `getPreviewUrl`, and `getPreviewLogs` to `mobile/src/api.ts`.

### Phase 4: Production Deployment & Scaling (Completed)
- [x] **Winston Logger** (`src/lib/logger.ts`): Structured logging with colorized console output (dev) and JSON file logs (prod). Captures API errors with route context.
- [x] **Sentry Error Tracking** (`src/lib/sentry.ts`): Lazy Sentry init, structured `captureError()` helper, strips auth headers before sending.
- [x] **Health Check API** (`GET /api/health`): Pings MongoDB, reports uptime/version/service status. Returns HTTP 503 if DB is down.
- [x] **Vercel Deploy Config** (`vercel.json`): 5-minute cleanup cron, security headers on all routes, all env vars mapped to Vercel secrets.
- [x] **Env Var Reference** (`.env.example`): Documents every required variable with generation commands for secrets.
- [x] **MongoDB Atlas Hardening** (`mongodb.ts`): TLS enforced, retry writes/reads, 5s server selection timeout, 10-connection pool for production, credential-safe error logging.
- [x] **Next.js Config** (`next.config.ts`): Sentry withSentryConfig wrapper, production-only source map upload, 6 security headers on every response.
- [x] **Logger wired** into: `login`, `approve`, `workspaces`, `dev-agent-runner` — all critical error paths captured.

---

## 🚀 Next Steps (Post-MVP)
1. Create a MongoDB Atlas cluster and set `MONGODB_URI` in Vercel.
2. Run `vercel deploy` to ship the backend.
3. Create a Sentry project, get the DSN, add it to Vercel env vars.
4. Point an uptime monitor (e.g. UptimeRobot) at `GET /api/health`.

---

## 📖 Developer & AI Assistant Protocol

To keep this document accurate and helpful, all developers and AI assistants working on this codebase MUST follow these instructions:

1. **Read First**: Always read this file (`PROJECT_STATUS.md`) at the start of your session to understand the current phase and open tasks.
2. **Update Task States**:
   - Mark in-progress tasks by changing `[ ]` to `[/]`.
   - Mark completed tasks by changing `[/]` or `[ ]` to `[x]`.
3. **Log Technical Decisions**: If you make any architectural decisions or database schema updates, add a new numbered section under the **Discussions & Decisions Log** with the date, the problem, and the solution.
4. **Update Completed Work**: When moving a task to `[x]`, document what you did under the **Completed Work** section with a concise summary.
5. **Session Wrap-Up**: Always update the **Last Updated** timestamp under the **Current Status at a Glance** section at the end of every coding turn or work session.

