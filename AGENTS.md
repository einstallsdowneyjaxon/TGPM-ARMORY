<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

TGPM Armory is a single Next.js 16 (Turbopack) app on Node 22. Standard scripts live in `package.json`: `npm run dev` (port 3000), `npm run build`, `npm run lint`. There is no test framework configured. Dependencies are installed by the startup update script.

Non-obvious notes:
- Core feature is the Property Health Analyzer at `/property-health-analyzer`. It parses an AppFolio GL CSV and computes all totals client-side; use the "Load starter CSV" button (reads `public/sample-general-ledger.csv`) to exercise it with no external services.
- All env vars are optional for running the app. `OPENAI_API_KEY` is only needed when clicking "Generate AI analysis"; without it the analyzer still parses and calculates. `/mls-ready` needs Google Sheets credentials (see `src/lib/mls-sheets.ts`) — without them the app still runs and only the MLS Sheets API calls error.
- `npm run build` prints a non-blocking Turbopack "dynamic filesystem operations" warning from `src/lib/mls-sheets.ts` (it reads OAuth files at runtime in dev). The build still succeeds; ignore it.
