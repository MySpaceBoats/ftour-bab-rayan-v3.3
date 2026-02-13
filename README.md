# Ftour Bab Rayan

A full-stack web application built with React, Express, and Cloudflare Pages.

## Tech Stack

- **Frontend:** React 19, Vite, TailwindCSS, Radix UI
- **Backend:** Express.js, tRPC
- **Database:** MySQL with Drizzle ORM
- **Deployment:** Cloudflare Pages (with advanced mode _worker.js)

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Type checking
pnpm check
```

## Building

```bash
# Build for production
pnpm build

# Build for Cloudflare Pages only (frontend + worker)
pnpm build:cloudflare
```

## Deployment

### ⚠️ Important: Cloudflare Pages Configuration

This project **MUST** be deployed to Cloudflare Pages, not Cloudflare Workers.

#### Fix Required in Cloudflare Dashboard

If you're seeing deployment errors, you need to update your Cloudflare Pages project settings:

1. Go to Cloudflare Dashboard → Pages → Your Project → Settings → Builds & deployments
2. Set the following:
   - **Build command:** `pnpm run build`
   - **Build output directory:** `dist/public`
   - **Deploy command:** _**Leave this EMPTY**_ (remove `npx wrangler versions upload` if present)

3. Save and redeploy

#### Why This Matters

- ❌ `wrangler versions upload` is for Cloudflare **Workers** (incorrect)
- ✅ Cloudflare **Pages** handles deployment automatically from the build output
- ✅ The `_worker.js` file is an advanced mode Pages Function (not a static asset)

### Manual Deployment

```bash
# Deploy manually to Cloudflare Pages
pnpm run deploy:cloudflare
```

## Project Structure

```
.
├── client/              # React frontend
├── server/              # Express backend
├── worker/              # Cloudflare Pages Worker
├── dist/
│   ├── public/          # Built frontend + _worker.js (for Pages)
│   └── index.js         # Built Express server (for Node.js hosting)
└── wrangler.toml        # Cloudflare configuration
```

## Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build everything (frontend, backend, worker)
- `pnpm build:cloudflare` - Build for Cloudflare Pages only
- `pnpm deploy:cloudflare` - Build and deploy to Cloudflare Pages
- `pnpm start` - Run production Express server
- `pnpm check` - TypeScript type checking
- `pnpm format` - Format code with Prettier
- `pnpm test` - Run tests

## Troubleshooting

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions and troubleshooting.
