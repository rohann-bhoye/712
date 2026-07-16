# BucketDev — Project Status & Roadmap

This file is a living document that tracks the progress of the **BucketDev** project, details our architectural decisions, and lists all remaining work. It is updated at the end of every work session to keep you and your team aligned.

---

## 📊 Current Status at a Glance

* **Current Phase**: Pure GitHub-API MVP Pivot Completed ✅
* **Local environment**: Pure GitHub API edit loop (no Docker/local sandboxing needed)
* **Last Updated**: July 16, 2026

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

### 3. Pure GitHub API Pivot (July 16, 2026)
* **Problem**: The Docker containers and sandbox workspace runner shell out to local docker daemon which is not available in Vercel Serverless environment, preventing us from running the backend entirely on the cloud without a laptop.
* **Decision**: We dropped the Docker sandbox entirely in favor of direct GitHub REST/Data API read/write operations. Edits are prepared inside Next.js API router, verified by the developer on the mobile app via a unified diff patch, and then committed directly to GitHub via the Data API. No Docker daemon is required, which enables backend deployment on Vercel. We also upgraded the mobile app to render colored line diffs and a timeline stepper.

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

### Pure GitHub-API Pivot (Completed)
- [x] **Remove Docker Engine**: Cleanly deleted workspace sandbox scripts, preview routers, and stop API calls.
- [x] **Recursive Tree Listing**: Built `fetchRepoTree()` to read repository layouts dynamically.
- [x] **Multi-File AI Edits & Diffs**: Structured the runner to generate file updates, compute unified patches, and display color-coded inline differences.
- [x] **Direct Commits**: Wired direct git commit writes to the target branch.
- [x] **Hardened Security**: Eliminated fallbacks for JWT and decryption keys.

---

## 📋 Remaining Work & Roadmap

All planned MVP phases are complete, verified, and successfully pivoted!

---

## 🚀 Next Steps (Post-MVP Deployment)
1. Delete the superseded `mobile_backup/` directory to clean up space.
2. Create a MongoDB Atlas cluster and set `MONGODB_URI` in Vercel.
3. Deploy the Next.js backend for real to Vercel via `vercel deploy`.
4. Point `EXPO_PUBLIC_API_URL` on the mobile client (Expo) to the deployed Vercel API and test end-to-end.
5. Create a Sentry project, obtain the DSN, and set it up on Vercel environment variables.
6. Point an uptime monitor (e.g. UptimeRobot) at `GET /api/health`.

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

