# TrueNAS VM Manager

A small web interface for managing virtual machines on a TrueNAS system.

## Setup

1. Copy the example environment file and set a strong session secret:

   ```sh
   cp .env.example .env
   ```

2. Install dependencies:

   ```sh
   bun install
   ```

3. In TrueNAS, create an API key for the account that will manage VMs. The key
   needs the `VM_READ` and `VM_WRITE` roles.

## Development

Run the API server and web development server in separate terminals:

```sh
bun run dev:server
```

```sh
bun run dev:web
```

Open the Vite URL shown by the web development server. On first use, set the
application password, then connect your TrueNAS host with the API key.

## Production

Build the web application, then start the server:

```sh
bun run build
bun run start
```

The server serves the API and the built web application from `web/dist`.
