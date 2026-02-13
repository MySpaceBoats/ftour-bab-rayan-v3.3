# Ftour Bab Rayan

A full-stack web application built with React, Express, and Cloudflare Workers.

## Tech Stack

- **Frontend:** React 19, Vite, TailwindCSS, Radix UI
- **Backend:** tRPC API on Cloudflare Workers
- **Database:** MySQL with Drizzle ORM
- **Deployment:** Cloudflare Workers (with static assets)

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

### Cloudflare Workers Configuration

This project is deployed to **Cloudflare Workers** with static assets.

#### Build & Deploy Commands

The deployment uses `wrangler versions upload` which requires:
- **Build command:** `pnpm run build`
- **Worker code:** `dist/worker.js` (API handler)
- **Static assets:** `dist/public/` (frontend)

The `wrangler.toml` is configured with:
```toml
main = "dist/worker.js"         # Worker entry point
[assets]
directory = "dist/public"       # Static assets
```

### Manual Deployment

```bash
# Build and deploy to Cloudflare Workers
pnpm run build
wrangler versions upload

# Or for legacy Cloudflare Pages deployment
pnpm run deploy:cloudflare
```

## Project Structure

```
.
├── client/              # React frontend
├── server/              # Express backend (for Node.js hosting)
├── worker/              # Cloudflare Workers API (tRPC)
├── dist/
│   ├── worker.js        # Built Worker (API handler)
│   ├── public/          # Built frontend (static assets)
│   └── index.js         # Built Express server (for Node.js)
└── wrangler.toml        # Cloudflare Workers configuration
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
