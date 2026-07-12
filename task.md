# BucketDev Execution Checklist

## Phase 1: Hardening the Simulated MVP
- [x] Create MongoDB collections structure for `dev_` collections
- [x] Build AES-256-GCM encryption/decryption utilities for BYOK API keys
- [x] Integrate provider connectivity check for `POST /api/dev/providers/:id/verify`
- [x] Clean up Mobile Client `api.ts` and `App.tsx` routes

## Phase 2: Real Container Provisioning
- [x] Set up Docker daemon interface for provisioning workspaces (implemented in dev-workspace-docker.ts)
- [ ] Configure standard Dockerfiles for Node.js, Python, and Java workspaces
- [ ] Limit container CPU/RAM resource quotas and egress rules
- [ ] Implement an automated workspace idle-cleanup cron job

## Phase 3: Preview Proxy Gateway
- [ ] Build container port scanner (listening services tracker)
- [ ] Configure Nginx / Traefik dynamic routing logic for preview subdomains
- [ ] Secure preview endpoints with user ownership tokens

## Phase 4: Production Deployment & Scaling
- [ ] Move MongoDB to production-ready Atlas instance
- [ ] Set up backend REST endpoints deployment scripts
- [ ] Configure live dashboard telemetry and error logger (Sentry/Datadog)
