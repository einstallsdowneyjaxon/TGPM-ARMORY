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

### Maintenance Intelligence (`/maintenance-intelligence`)
- Dashboard reads from Supabase. Sync/cron pulls AppFolio **saved reports** (GET) into Supabase; both the WO report and tenant directory report are saved-report GETs.
- Vercel Cron hits `/api/maintenance/sync` with **GET** (Bearer `CRON_SECRET` if set). The dashboard Sync button uses **POST** without auth. Both run the same sync.
- Empty AppFolio "Today" WO report is OK (returns synced: 0). Daily/full sync still refreshes the tenant directory. Hourly WO-only: `GET/POST /api/maintenance/sync?scope=work_orders`.
- Account is on **Vercel Hobby**, which only allows one cron fire per day — keep the overnight job in `vercel.json`. For business-hours hourly pulls, use an external scheduler against `?scope=work_orders` (Hobby cannot host hourly Vercel Cron).
- "Today's Work Orders" uses America/New_York calendar date vs `work_orders.created_at_af`. Expand loads `/api/maintenance/history` by `occupancy_id` (index `idx_work_orders_occupancy_id`).
