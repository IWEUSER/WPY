# Agent notes

## Working branch

Live `main` is the current game. Open new follow-up branches off `main`. Do not keep adding to `cursor/chance-atmosphere-haptics-a634`.

- Keep prior requests. A later follow-up does not replace an earlier rule.

## Shipping to live

Always keep a visible stamp on the first menu (`HomeScreen`).

- `LIVE_SHIP_LABEL` in `src/game/branding.ts` names the ship. Update it on every merge to `main`.
- Vite injects `VITE_LIVE_BUILT_AT` at build time, so the UTC clock on the menu is unique for each production deploy. Do not remove that stamp.
- Ian uses the stamp to confirm the live PWA is the build just shipped.
- Do not merge or restamp until Ian says ship.
