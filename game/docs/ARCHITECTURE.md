# Architecture

Baby Warz is a pnpm TypeScript monorepo with three explicit boundaries:

- `apps/client`: Vite and Babylon.js presentation, input capture, prediction-ready local state, interpolation-ready snapshots, and DOM HUD.
- `apps/server`: one Colyseus room, input validation, 20 Hz authoritative simulation, Rapier initialization, match lifecycle, and structured logs.
- `packages/shared`: protocol DTOs, arena coordinates, tuning constants, math helpers, and the nine-food data model.

There is deliberately no database, Redis, account system, or cross-process room state. A single long-lived room accepts up to 12 players and 12 spectators. Players joining during play become spectators. Server messages are Zod-validated before reaching the simulation.

The first blockout uses cheap Babylon primitives following the accepted Balanced Chunk direction. Team color lives on bib and bands; the diaper remains a separate transformable volume. The arena uses broad sand planes, coral/teal bank trims, a recessed indigo/cyan river, sparse cover, and fixed pickup pads.

## Central tuning

All ordinary prototype values live in `packages/shared/src/constants.ts`. Food curves live in `packages/shared/src/foods.ts`. The selected defaults are 6.2 units/s movement, 8.5 jump velocity, 17 units/s base ball speed, 14-unit hook range, 15-second reconnect grace, and the accepted 20 Hz server cadence.
