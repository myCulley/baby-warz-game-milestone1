# Ubuntu deployment and rollback

## First deployment

1. Install current Docker Engine with the Compose plugin and clone this repository.
2. Copy `.env.example` to `.env`. Keep `PUBLIC_ORIGIN=https://baby-warz.mytechvault.com`; normally leave `VITE_SERVER_URL` empty so the browser uses its public origin.
3. Run `docker compose -f infra/docker-compose.yml up -d --build`.
4. Verify `curl -fsS http://127.0.0.1:8080/healthz` and `curl -fsS http://127.0.0.1:8080/health`.
5. Point the existing Cloudflare Tunnel ingress for `baby-warz.mytechvault.com` to `http://127.0.0.1:8080`. Cloudflare must allow WebSockets. No inbound router port is required.

The edge container serves the static browser bundle and proxies Colyseus HTTP/WebSocket matchmaking on the same origin. Structured server logs are available with `docker compose -f infra/docker-compose.yml logs -f server`. Both services restart unless explicitly stopped.

## Update

Pull the desired commit, run `docker compose -f infra/docker-compose.yml build`, then `docker compose -f infra/docker-compose.yml up -d`. Re-run both health checks and complete a two-browser match smoke test.

## Rollback

Check out the previous known-good Git tag or commit, rebuild both images, and run Compose again. The game has no persistent data or schema migration, so rollback is limited to code and images. Existing in-memory lobbies end when the server container is replaced.
