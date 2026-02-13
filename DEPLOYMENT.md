# Deployment Guide

This project is configured for **Cloudflare Pages** deployment with advanced mode (_worker.js).

## Cloudflare Pages Configuration

### Build Settings (Cloudflare Dashboard)

**Framework preset:** None (Custom)
**Build command:** `pnpm run build`
**Build output directory:** `dist/public`
**Deploy command:** _Leave empty_ (Cloudflare Pages handles deployment automatically)

### Important Notes

- ⚠️ **Do NOT use** `wrangler versions upload` - this is for Cloudflare Workers, not Pages
- ✅ Cloudflare Pages will automatically deploy the `dist/public` directory
- ✅ The `_worker.js` file in `dist/public` is the advanced mode worker (NOT a static asset)
- ✅ The `wrangler.toml` is configured for Pages with the `[assets]` directive

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
