# Physics boundary

Rapier is initialized on the Node server and is the approved authoritative physics dependency. The current vertical slice keeps its deterministic prototype movement and collision resolution in `GameSimulation` while using a Rapier world for the arena boundary; this makes every gameplay rule straightforward to test without browser state.

The browser's Babylon scene is presentation only. It does not decide hits, river deaths, food collection, ball capacity, hook catches, or match results. Visual bodies are corrected to each server snapshot.

Important prototype rules are explicit: every direct active-ball contact removes one heart; the ball becomes harmless after any player hit or after two terrain bounces; harmless balls no longer collide with players but remain collectible; river contact immediately eliminates; hook pulls are mass-modified and server-owned; and visual scale follows the authoritative food-derived collider intent.

## Arena environment

The runtime arena uses the `vertical-slice-2` visual and collision exports. The
browser renders the detailed visual GLB and keeps the collision GLB hidden. The
server remains authoritative: it uses the centralized `ARENA_BLOCKERS` boxes,
36 x 56 meter bounds, and 4.4 meter fatal river from the slice layout contract.
Player, food, and team spawn positions now match the authored markers. Because
the accepted match supports six players per team while the art supplies three
primary pads, players four through six use a second row 2.25 meters inward.
