# Networking

The browser connects to the Colyseus `baby_warz` room at the same origin by default. Caddy forwards `/matchmake/*` to the game server and automatically preserves WebSocket upgrades. Development may override the URL with `VITE_SERVER_URL=ws://127.0.0.1:2567`.

Clients send monotonically sequenced input commands: movement axes, aim direction, jump, sprint activation, throw, and hook. They never send position, damage, pickups, or successful hit claims. The server drops stale sequences, simulates at 20 Hz, and broadcasts complete compact snapshots at 20 Hz with the acknowledged sequence for reconciliation.

Disconnects mark a living player as a noninteractive ghost. Colyseus reserves the seat for 15 seconds; successful reconnection restores control, while expiry becomes an authoritative forfeit. This value is centralized for later tuning.

The current client renders server snapshots directly and smooths the follow camera. The protocol already carries sequence acknowledgements, positions, and velocities needed to add fuller input replay/interpolation without changing server authority.
