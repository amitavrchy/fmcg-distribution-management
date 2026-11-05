# DeshFlow frontend

Next.js/React distribution workspace. Full setup, API, architecture and capability notes are in [backend/README.md](../backend/README.md).

From the repository root:

```text
node backend/scripts/setup.mjs
```

Then run `npm run dev:all` from `backend/`. The web app opens at http://127.0.0.1:3000. Frontend and backend each own their package/lock files; the root contains only these two directories plus hidden Git metadata.

For frontend-only work, install with `npm ci` here, then `npm run dev`, `npm run typecheck` or `npm run build`. API defaults to localhost:4000; configure `.env.local` when changing it. All UI text is at least 14px and motion respects reduced-motion preferences.
