/**
 * Cloudflare Worker for Ftour Bab Rayan API
 * Handles all /api/* requests using tRPC Fetch adapter
 */
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from './routers';
import { createWorkerContext } from './context';

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RESEND_API_KEY: string;
  JWT_SECRET: string;
  VITE_APP_ID: string;
  NODE_ENV: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // ---- CORS (restrict to allowed origins) ----
    const origin = request.headers.get('Origin') ?? '';
    const allowed = new Set([
      'https://ftourbabrayan.ma',
      'https://www.ftourbabrayan.ma',
      'https://ftour-bab-rayan-v2.pages.dev',
    ]);
    const allowOrigin = allowed.has(origin) ? origin : 'https://ftourbabrayan.ma';

    const baseCorsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      // Optionnel (utile si tu envoies un header Authorization côté client)
      'Vary': 'Origin',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: baseCorsHeaders });
    }

    // Handle tRPC API requests
    if (url.pathname.startsWith('/api/trpc')) {
      const response = await fetchRequestHandler({
        endpoint: '/api/trpc',
        req: request,
        router: appRouter,
        createContext: () => createWorkerContext(request, env),
        onError: ({ error, path }) => {
          console.error(`[tRPC Error] ${path}:`, error.message);
        },
      });

      // Merge CORS headers into tRPC response
      const newHeaders = new Headers(response.headers);
      Object.entries(baseCorsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};
