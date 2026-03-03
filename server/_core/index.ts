import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ensureVolunteerSlotsColumn, ensurePastriesTable } from "../supabase";
import { refreshUserSession } from "../supabase-auth";
import { getSupabaseAdminClient } from "../supabase";
import {
  getAllGoodiesSupabase,
  getPastriesSupabase,
  initializeAllStocks,
} from "../supabase-services";
import { DONATION_SUGGESTED_AMOUNTS_MAD } from "../../shared/const";
import { handleMemberCardRequest } from "../../worker/member-cards";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Ensure database schema is up to date
  await ensureVolunteerSlotsColumn();
  await ensurePastriesTable();

  // Initialize all product stocks to 60
  await initializeAllStocks(60);

  app.post("/api/auth/refresh", async (req, res) => {
    const refreshToken =
      typeof req.body?.refreshToken === "string" ? req.body.refreshToken : "";

    if (!refreshToken) {
      res.status(400).json({ error: "refreshToken is required" });
      return;
    }

    const result = await refreshUserSession(refreshToken);
    if (result.error || !result.session) {
      res.status(401).json({ error: result.error || "Session expirée" });
      return;
    }

    res.json({ session: result.session });
  });

  app.get("/api/catalog", async (_req, res) => {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      res.status(500).json({ error: "Supabase not configured" });
      return;
    }

    const [goodiesRes, pastriesRes, terroirJoinRes, donationsRes] =
      await Promise.allSettled([
        getAllGoodiesSupabase(true),
        getPastriesSupabase(),
        supabase
          .from("terroir_products")
          .select("*, terroir_product_variants(*)")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("products")
          .select("id,name,price_mad,active")
          .eq("type", "DONATION"),
      ]);

    const goodies =
      goodiesRes.status === "fulfilled"
        ? goodiesRes.value.map(item => ({
            id: `GOODIE-${item.id}`,
            sourceId: item.id,
            type: "GOODIE",
            name: item.name,
            description: item.description || "",
            priceMad: Math.round(Number(item.price || 0)),
            imageUrl: item.imageUrl || null,
          }))
        : [];

    const pastries =
      pastriesRes.status === "fulfilled"
        ? pastriesRes.value.map((item: any) => ({
            id: `PASTRY-${item.id}`,
            sourceId: item.id,
            type: "PASTRY",
            name: item.name,
            description: item.description || "",
            priceMad: Math.round(Number(item.price || 0)),
            imageUrl: item.image_url || null,
          }))
        : [];

    let terroirProducts: any[] = [];
    if (terroirJoinRes.status === "fulfilled" && !terroirJoinRes.value.error) {
      terroirProducts = terroirJoinRes.value.data || [];
    } else {
      const productsQuery = await supabase
        .from("terroir_products")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (!productsQuery.error && (productsQuery.data || []).length) {
        const productIds = (productsQuery.data || []).map(
          (product: any) => product.id
        );
        const variantsQuery = await supabase
          .from("terroir_product_variants")
          .select("*")
          .in("product_id", productIds)
          .eq("is_active", true)
          .order("sort_order", { ascending: true });

        const variantsByProductId = (variantsQuery.data || []).reduce(
          (acc: Record<number, any[]>, variant: any) => {
            if (!acc[variant.product_id]) {
              acc[variant.product_id] = [];
            }
            acc[variant.product_id].push(variant);
            return acc;
          },
          {}
        );

        terroirProducts = (productsQuery.data || []).map((product: any) => ({
          ...product,
          terroir_product_variants: variantsByProductId[product.id] || [],
        }));
      }
    }

    const terroir = terroirProducts.flatMap((product: any) =>
      (product.terroir_product_variants || [])
        .filter((variant: any) => variant.is_active !== false)
        .map((variant: any) => ({
          id: `TERROIR-${product.id}-${variant.id}`,
          sourceId: product.id,
          type: "TERROIR",
          name: `${product.name}${variant.label ? ` - ${variant.label}` : ""}`,
          description: product.description || "",
          priceMad: Math.round(Number(variant.price_unit || 0)),
          imageUrl: product.image_url || null,
          variantId: variant.id,
        }))
    );

    const donationProducts =
      donationsRes.status === "fulfilled" && !donationsRes.value.error
        ? donationsRes.value.data || []
        : [];

    const presets = donationProducts
      .filter((d: any) => d.active !== false)
      .map((d: any) => Number(d.price_mad))
      .filter((v: number) => Number.isFinite(v) && v > 0)
      .sort((a: number, b: number) => a - b)
      .reduce(
        (acc: number[], v: number) => (acc.includes(v) ? acc : [...acc, v]),
        []
      )
      .concat(
        [...DONATION_SUGGESTED_AMOUNTS_MAD].filter(
          v =>
            !donationProducts.some(
              (d: any) => Number(d.price_mad) === v && d.active !== false
            )
        )
      );

    res.json({
      goodies,
      pastries,
      terroir,
      donations: { presets },
    });
  });

  // Member card routes (proxied to Cloudflare Worker handler for dev parity)
  function buildWorkerEnv() {
    return {
      SUPABASE_URL: process.env.SUPABASE_URL ?? '',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? '',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      RESEND_API_KEY: process.env.RESEND_API_KEY ?? '',
      JWT_SECRET: process.env.JWT_SECRET ?? '',
      VITE_APP_ID: process.env.VITE_APP_ID ?? '',
      NODE_ENV: process.env.NODE_ENV ?? 'development',
      GITHUB_APP_ID: process.env.GITHUB_APP_ID ?? '',
      GITHUB_APP_INSTALLATION_ID: process.env.GITHUB_APP_INSTALLATION_ID ?? '',
      GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY ?? '',
      PUBLIC_APP_URL: process.env.PUBLIC_APP_URL,
      CASH_ORDER_ADMIN_CC_EMAIL: process.env.CASH_ORDER_ADMIN_CC_EMAIL,
      RESERVATION_PROOF_TOKEN_TTL_DAYS: process.env.RESERVATION_PROOF_TOKEN_TTL_DAYS,
      RESERVATION_PAYMENT_PROOF_BUCKET: process.env.RESERVATION_PAYMENT_PROOF_BUCKET,
      RESERVATION_ADMIN_DASHBOARD_URL: process.env.RESERVATION_ADMIN_DASHBOARD_URL,
    };
  }

  const memberCardMiddleware: express.RequestHandler = async (req, res, next) => {
    const fullUrl = `http://localhost${req.originalUrl}`;
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers.set(key, value);
      else if (Array.isArray(value)) headers.set(key, value.join(', '));
    }

    let bodyInit: BodyInit | null = null;
    const contentType = req.headers['content-type'] ?? '';
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (contentType.includes('application/json') && req.body != null) {
        bodyInit = JSON.stringify(req.body);
      }
    }

    const webRequest = new Request(fullUrl, {
      method: req.method,
      headers,
      body: bodyInit,
    });

    try {
      const response = await handleMemberCardRequest(webRequest, buildWorkerEnv());
      if (response === null) return next();
      res.status(response.status);
      response.headers.forEach((value: string, key: string) => {
        if (key.toLowerCase() !== 'content-encoding') res.setHeader(key, value);
      });
      res.send(await response.text());
    } catch (err) {
      next(err);
    }
  };

  app.use(['/api/admin/cards', '/api/admin/card', '/api/card', '/card'], memberCardMiddleware);

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
