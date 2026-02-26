import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouterUpdated as appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ensureVolunteerSlotsColumn, ensurePastriesTable } from "../supabase";
import { refreshUserSession } from "../supabase-auth";
import { getSupabaseAdminClient } from "../supabase";
import {
  getAllGoodiesSupabase,
  getPastriesSupabase,
} from "../supabase-services";
import { DONATION_SUGGESTED_AMOUNTS_MAD } from "../../shared/const";

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
