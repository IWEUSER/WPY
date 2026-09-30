# Agent notes

## Working branch

Ian iterates on one unreleased stack. Do not start a new branch off `main` for follow-ups.

- Latest in-progress branch: `cursor/chance-atmosphere-haptics-a634` (PR #30).
- Preview: https://wpy-git-cursor-chance-atmosphere-haptics-a634-iweusers-projects.vercel.app
- Live `main` is only the last shipped PWA. Career follow-ups belong on the stack above until Ian says ship or merge.
- Continue that branch. Commit and push there. Do not open a parallel career PR from `main` or from older branches such as `cursor/trials-intl-records-wages-a634`.
- Keep prior requests on that stack. A later follow-up does not replace an earlier rule.

## Shipping to live

Always keep a visible stamp on the first menu (`HomeScreen`).

- `LIVE_SHIP_LABEL` in `src/game/branding.ts` names the ship. Update it on every merge to `main`.
- Vite injects `VITE_LIVE_BUILT_AT` at build time, so the UTC clock on the menu is unique for each production deploy. Do not remove that stamp.
- Ian uses the stamp to confirm the live PWA is the build just shipped.
- Do not merge or restamp until Ian says ship.
