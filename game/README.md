# Baby Warz — Milestone One

A self-hosted browser-based 3D team dodgeball vertical slice. Giant cartoon babies throw right-hand dodgeballs, fire left-hand grappling hooks, collect stackable foods, and try not to fall into the fatal central river.

## Windows development

Requires Node.js 24 LTS and pnpm 11.7.0.

```powershell
corepack enable
pnpm install
$env:VITE_SERVER_URL='ws://127.0.0.1:2567'
pnpm dev
```

Open `http://127.0.0.1:5173`. Controls: WASD movement, Space jump, Shift sprint burst, mouse aim, left click hook, right click throw. Ordinary play uses a fixed elevated camera; spectators use right-drag and the wheel.

Run the full local gate with `pnpm check`, then the browser smoke test with `pnpm test:e2e`. Production and Cloudflare Tunnel instructions are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Prototype limitations

The vertical slice uses deliberately styled primitive characters and arena art. Server snapshots are authoritative and sequence-aware; the client currently renders them directly rather than replaying a long local prediction buffer. Rapier owns the server physics boundary, while several simple collision paths remain explicit TypeScript so accepted rules stay deterministic and unit-testable. Audio, final animation, production models, advanced latency concealment, and operational metrics are the highest-value follow-up refinements.
