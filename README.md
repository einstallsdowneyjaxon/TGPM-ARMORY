# TGPM Armory

TGPM Armory is a standalone internal property management tool hub built with Next.js, TypeScript, and Tailwind CSS. It is designed for deployment on Vercel.

## Features

- Mobile-first responsive dashboard
- Dark navy professional theme
- Searchable grid of internal tool cards
- Category grouping for Leasing, Maintenance, Resident, and Budgeting workflows
- Centralized tool configuration in `src/config/tools.ts`
- External tool links open in a new tab

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
