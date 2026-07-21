# TrueNAS VM Manager

A small web UI for starting, restarting, and powering off virtual machines on a TrueNAS host.

TypeScript · [Bun](https://bun.sh) · Docker · React

## Features

- List VMs with state, vCPUs, memory, and guest OS icons inferred from names
- Start / restart / power off with live status polling
- App password gate and encrypted TrueNAS API key storage
- Docker images on **Docker Hub** and **GHCR**

## Run in Docker

Save the following as **`docker-compose.yml`** (same as [`docker-compose.yml`](./docker-compose.yml) in this repository), then set a strong **`SESSION_SECRET`**.

```yaml
# TrueNAS VM Manager — edit SESSION_SECRET, then `docker compose up -d`.

services:
  truenas-vm-manager:
    image: docker.io/essayoub/truenas-vm-manager:latest
    container_name: truenas-vm-manager
    restart: unless-stopped
    ports:
      - "8787:8787"
    environment:
      HOST: "0.0.0.0"
      PORT: "8787"
      DATA_DIR: "/data"
      # Rotate in production (min 16 chars; prefer a long random string)
      SESSION_SECRET: "change-me-to-a-long-random-string"
    volumes:
      - truenas-vm-manager-data:/data

volumes:
  truenas-vm-manager-data:
```

Then:

```bash
docker compose up -d
```

Open **`http://<host>:8787/`**. On first use, set the application password, then connect your TrueNAS host with an API key.

**TrueNAS SCALE / Apps:** create a custom app from this compose file (or the image above). Map host port `8787` (or another free port) and keep a persistent volume on `/data` so setup and the encrypted TrueNAS config survive upgrades.

**Images:** `docker.io/essayoub/truenas-vm-manager` and `ghcr.io/<github-owner>/truenas-vm-manager` — tags like **`latest`**, **`master`**, **`v0.1.0`**.

**Important:** when connecting TrueNAS, use the HTTPS UI URL (for example `https://192.168.1.10:443`). Plain `http://` causes TrueNAS to **disable** the API key. The key needs the `VM_READ` and `VM_WRITE` roles.

## Development

1. Copy the example environment file and set a strong session secret:

   ```sh
   cp .env.example .env
   ```

2. Install dependencies:

   ```sh
   bun install
   ```

3. Run the API and web servers:

   ```sh
   bun run dev:server
   ```

   ```sh
   bun run dev:web
   ```

Open the Vite URL shown by the web development server.

## Testing

```sh
bun run test
```

Avoid bare `bun test` from the repository root; it does not apply the web package's Vitest/jsdom configuration.

## Production (without Docker)

```sh
bun run build
bun run start
```

The server serves the API and the built web application from `web/dist`.
