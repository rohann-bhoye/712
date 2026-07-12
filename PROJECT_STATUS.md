# BucketDev — Project Status & Roadmap

This file is a living document that tracks the progress of the **BucketDev** project, details our architectural decisions, and lists all remaining work. It is updated at the end of every work session to keep you and your team aligned.

---

## 📊 Current Status at a Glance

* **Current Phase**: Phase 2 (Workspace Provisioning)
* **Local environment**: Node.js sandbox runner (Option A selected due to 8GB RAM)
* **Last Updated**: July 13, 2026

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

---

## 🛠️ Completed Work

### Phase 1: Simulated MVP (Completed)
- [x] **Database Schema Setup**: Designed and created MongoDB collections (`dev_users`, `dev_workspaces`, `dev_providers`, `dev_conversations`, `dev_agent_jobs`, `dev_history`).
- [x] **BYOK Security (Secrets Encryption)**: Built robust AES-256-GCM encryption/decryption utilities to securely store third-party developer API keys.
- [x] **Provider Key Verification**: Implemented active verification endpoints (`POST /api/dev/providers/:id/verify`) for OpenAI and Google Gemini keys.
- [x] **GitHub Direct Write integration**: Designed a file modification pipeline using GitHub's Direct Database API (trees/commits), allowing edits to be pushed directly without local clones.
- [x] **Mobile Client UI**: Created an interactive Expo App (`App.tsx`) with dashboard controls, workspace logs streaming simulation, and code change approval/rejection panels.

---

## 📋 Remaining Work & Roadmap

Here is the exact task list of what is left to implement, which you can use for planning or presenting at your office:

### Phase 2: Sandbox Provisioning (Current Focus)
- [ ] **Local Sandbox Manager (`dev-workspace-local.ts`)**: Implement functions to clone repositories, install dependencies (`npm install`), and run builds/tests inside `scratch/workspaces/<workspaceId>`.
- [ ] **Integrate Sandbox into Agent Runner (`dev-agent-runner.ts`)**: Change the agent lifecycle to run actual `npm run build` and `npm test` commands on the local files instead of simulated timeouts.
- [ ] **Push Local Changes**: Hook up the approval route so that when a developer approves a change, the final changes are committed and pushed.

### Phase 3: Preview Proxy Gateway
- [ ] **Port Scanner**: Build a tool to detect which local port a running project starts listening on (e.g. 3000, 3001, etc.).
- [ ] **Routing/Preview Gateway**: Connect the preview server so a developer can see their app's live preview URL from their mobile screen.

### Phase 4: Production Deployment & Scaling
- [ ] **Production DB**: Migrate local MongoDB connection to production MongoDB Atlas.
- [ ] **Hosting**: Deploy the Next.js API to a cloud host (Render/Vercel).
- [ ] **Error Telemetry**: Add Sentry and Winston logs to monitor system crashes and AI stream failures.

---

## 🚀 Next Immediate Steps
1. **Approve the Implementation Plan**: Once you approve the [Option A Implementation Plan](file:///C:/Users/Lenovo/.gemini/antigravity-ide/brain/175384b8-0d1b-465e-b99c-6f29cbec36e2/implementation_plan.md), I will start writing the local workspace manager.

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

