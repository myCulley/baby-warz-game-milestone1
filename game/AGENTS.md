# Baby Warz implementation guidance

- The server owns movement, collision, hits, pickups, elimination, match state, and statistics.
- The browser sends intent only and treats snapshots as truth.
- Put cross-runtime contracts and genuine shared tuning in `packages/shared`; keep runtime behavior in its owning app.
- Preserve the accepted one-lobby, one-round, 12-player plus 12-spectator scope.
- Keep new tuning values centralized and document gameplay-visible changes.
- Never commit secrets, public tunnel credentials, generated dependencies, or local environment files.
- Every gameplay change must leave `pnpm lint`, `pnpm test`, and `pnpm build` passing.
