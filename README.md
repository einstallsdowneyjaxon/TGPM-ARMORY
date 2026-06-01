# TGPM Armory

TGPM Armory is an internal launchpad for TGPM property management tools. It is a standalone tool hub built with Next.js, TypeScript, and Tailwind CSS, and is designed for deployment on Vercel.

## Features

- Mobile-first responsive dashboard
- TGPM branded professional theme
- Searchable grid of internal tool cards
- Category grouping for Leasing, Maintenance, Resident, and Budgeting workflows
- Centralized tool configuration in `src/config/tools.ts`
- External tool links open in a new tab
- Property Health Analyzer for AppFolio General Ledger CSV uploads
- Deterministic ledger categorization, totals, monthly trends, and AI-generated structured analysis

## Local Setup

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Required Environment Variables

Create `.env.local` for AI analysis:

```bash
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4.1-mini
```

`OPENAI_MODEL` is optional. The app defaults to `gpt-4.1-mini`.

The Property Health Analyzer still parses CSV files and calculates dashboard totals without an API key. The API key is only required when you click **Generate AI analysis**.

## Property Health Analyzer

Open [http://localhost:3000/property-health-analyzer](http://localhost:3000/property-health-analyzer).

For this MVP, there is no database storage. The CSV is parsed in the browser and deterministic calculations are performed in TypeScript before a compact calculated report is sent to the OpenAI API route. The AI is instructed to analyze only the supplied totals, category breakdowns, monthly trends, and sampled categorized rows.

### AppFolio GL CSV Export

Export a single-property General Ledger detail CSV from AppFolio with these fields when available:

- `Date`
- `Payee / Payer`
- `Debit`
- `Credit`
- `Description`
- `GL Account`
- `Property Address`
- `Month`
- `Quarter`
- `Year`
- `Remarks`
- `Unit ID`

The parser accepts common variants such as `Account`, `GL Account`, `Property`, `Property Name`, `Property Address`, `Payee`, and `Payee / Payer`. Balance sheet rows such as cash, prepaid rent, security deposits, and escrow accounts are categorized but excluded from operating expense totals to avoid double counting double-entry GL activity.

### Categories

Ledger rows are mapped in `src/lib/property-health.ts` into:

- Income
- Repairs
- Maintenance
- Utilities
- Management fees
- Leasing fees
- Owner distributions
- Owner contributions
- Taxes / insurance
- HOA
- Legal
- Uncategorized

Maintenance rows are additionally subcategorized into HVAC, plumbing, roof, lawn, appliance, electrical, pest, turnover, cleaning, general repair, and other.

### Starter CSV

The **Load starter CSV** button reads `public/sample-general-ledger.csv` when present. This is intended for local testing with a known AppFolio export shape.

## Future AppFolio Ingestion Plan

The next phase should move from one-off uploads to quarterly and live AppFolio ingestion:

1. Quarterly ingestion: accept exported GL CSVs per property, normalize them into a durable table, and preserve report snapshots by quarter.
2. AppFolio API ingestion: connect to approved AppFolio endpoints or scheduled exports, pull GL detail on a recurring cadence, and track source sync status.
3. Review workflow: allow TGPM staff to recategorize rows and store mapping overrides for future imports.
4. Owner reporting: generate quarterly owner summaries from stored report snapshots with approval before sending.
5. Portfolio monitoring: compare property health across the TGPM portfolio and flag changes in cash flow, maintenance concentration, and owner funding reliance.

## Managing Tools

Edit `src/config/tools.ts` to add, remove, rename, or update tool cards. Each tool includes:

- `name`
- `description`
- `category`
- `url`

Placeholder URLs use `https://example.com/...` for now.

## Quality Checks

Run linting:

```bash
npm run lint
```

Create a production build:

```bash
npm run build
```

## Deploying on Vercel

1. Push this project to a Git repository.
2. Import the repository in Vercel.
3. Keep the framework preset as Next.js.
4. Use the default build command: `npm run build`.
5. Use the default output settings.
6. Deploy.

No environment variables are required for the placeholder version.
