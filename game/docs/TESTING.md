# Verification

- `pnpm install --frozen-lockfile` installs the pinned workspace.
- `pnpm lint` checks formatting and all TypeScript boundaries.
- `pnpm test` runs shared food tuning and authoritative match simulations.
- `pnpm build` produces the shared package, Node server, and production browser bundle.
- `pnpm exec playwright install chromium` installs the browser once per workstation.
- `pnpm test:e2e` runs the two-client lobby/movement/late-spectator smoke test.
- `docker compose -f infra/docker-compose.yml config` validates production Compose expansion.

Manual Opera GX smoke: open two normal/private windows, create and join the lobby, select opposite teams, start, move/jump/sprint, collect a ball and food, throw with right click, fire the hook with left click, confirm the river eliminates, then open a third late window and verify spectator controls.
