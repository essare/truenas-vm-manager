# Docker / CI packaging (TrueNAS VM Manager)

## Goal

Ship the app the same way as `drime-s3`: multi-stage Docker image, GitHub Actions quality gate + publish to Docker Hub (`essayoub/truenas-vm-manager`) and GHCR, compose file suitable for TrueNAS SCALE custom apps.

## Packaging

- **web-build**: Bun Alpine, workspace install, `bun run --filter web build`
- **runtime**: Bun Alpine with `server/src` + `web/dist` only (no Node deps at runtime)
- Listen on `0.0.0.0:8787`, persist `DATA_DIR=/data`
- Healthcheck: `GET /api/status`

## CI

- Triggers: push to `master`/`main`, tags `v*`
- Jobs: `quality` → `docker-publish` → `github-release` (tags only)
- Platforms: `linux/amd64`
- Secrets: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`

Approved 2026-07-21.
