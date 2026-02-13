# Deployment Guide

This project is configured for **Cloudflare Workers** deployment with static assets.

## Cloudflare Workers Configuration

### Build Settings

**Build command:** `pnpm run build`
**Deploy command:** `wrangler versions upload` (or `npx wrangler versions upload`)

### Architecture

- **Worker code:** `dist/worker.js` - Handles API requests (`/api/*`)
- **Static assets:** `dist/public/` - React frontend (HTML, CSS, JS)
- **Configuration:** `wrangler.toml` - Defines worker entry point and assets directory

### Important Notes

- ✅ This is a **Cloudflare Workers** deployment (not Pages)
- ✅ The `main` field in `wrangler.toml` points to the worker code
- ✅ The `[assets]` directive serves static files automatically
- ✅ Worker handles API routes, static assets are served directly by Cloudflare

### Manual Deployment (if needed)

If you need to deploy manually from your local machine:

```bash
pnpm run deploy:cloudflare
```

This will:
1. Build the frontend and worker: `pnpm build:cloudflare`
2. Deploy to Pages: `wrangler pages deploy dist/public --project-name=ftour-bab-rayan`

### Deployment Architecture

- **Frontend:** React SPA built with Vite → `dist/public/`
- **Backend:** Express API bundled with esbuild → `dist/index.js` (for Node.js hosting)
- **Edge Worker:** Cloudflare Pages Function → `dist/public/_worker.js` (handles requests at the edge)

## Troubleshooting

### Error: "Uploading a Pages _worker.js file as an asset"

This error occurs when using `wrangler versions upload` instead of Pages deployment.

**Solution:** Remove any custom deploy command from Cloudflare Pages settings. Let Cloudflare Pages handle deployment automatically.

### Error: "The entry-point file at ... was not found"

This error occurs when `main` is set incorrectly in `wrangler.toml`.

**Solution:** For Pages projects, remove the `main` field from `wrangler.toml` or ensure it's not set to an invalid path.
