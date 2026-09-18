# Agent notes

## Shipping to live

Always keep a visible stamp on the first menu (`HomeScreen`).

- `LIVE_SHIP_LABEL` in `src/game/branding.ts` names the ship. Update it on every merge to `main`.
- Vite injects `VITE_LIVE_BUILT_AT` at build time, so the UTC clock on the menu is unique for each production deploy. Do not remove that stamp.
- Ian uses the stamp to confirm the live PWA is the build just shipped.
