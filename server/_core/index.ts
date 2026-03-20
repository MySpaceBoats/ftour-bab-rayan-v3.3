import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouterUpdated } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ensureVolunteerSlotsColumn, ensurePastriesTable, ensureTeamTable, ensureEventFeedbackTables } from "../supabase";
import { refreshUserSession } from "../supabase-auth";
import { getSupabaseAdminClient } from "../supabase";
import {
  getAllGoodiesSupabase,
  getPastriesSupabase,
  initializeAllStocks,
} from "../supabase-services";
import { DONATION_SUGGESTED_AMOUNTS_MAD } from "../../shared/const";
import { validateGroupRequestByToken } from "../volunteer-group-service";
import { getAdminDashboardPayload } from "../admin-dashboard-bff";
import { sdk } from "./sdk";
import { buildRagContext, getOrCreateConversation, getConversationHistory, saveMessage, BASE_SYSTEM_PROMPT } from "../ai-services";
import { ENV } from "./env";

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
  await ensureTeamTable();
  await ensureEventFeedbackTables();

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
        let variantsQuery = await supabase
          .from("terroir_product_variants")
          .select("*")
          .in("product_id", productIds)
          .eq("is_active", true)
          .order("sort_order", { ascending: true });

        const missingSortOrder = /sort_order.*terroir_product_variants/i.test(
          variantsQuery.error?.message || ""
        );

        if (missingSortOrder) {
          variantsQuery = await supabase
            .from("terroir_product_variants")
            .select("*")
            .in("product_id", productIds)
            .eq("is_active", true)
            .order("id", { ascending: true });
        }

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
        .map((variant: any) => {
          const stockTotal = Number(
            variant.stock_total ?? variant.stockTotal ?? variant.stock ?? 0
          );
          const stockReserved = Number(
            variant.stock_reserved ?? variant.stockReserved ?? 0
          );
          const availableStock = Math.max(0, stockTotal - stockReserved);

          return {
            id: `TERROIR-${product.id}-${variant.id}`,
            sourceId: product.id,
            type: "TERROIR",
            name: `${product.name}${variant.label ? ` - ${variant.label}` : ""}`,
            description: product.description || "",
            priceMad: Math.round(Number(variant.price_unit || 0)),
            imageUrl: product.image_url || null,
            variantId: variant.id,
            availableStock,
          };
        })
        .filter((variant: any) => variant.availableStock > 0)
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

  app.get('/api/admin-dashboard', async (req, res) => {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 50);

    try {
      const payload = await getAdminDashboardPayload({ page, pageSize });
      res.setHeader('Cache-Control', 'private, max-age=45');
      res.json(payload);
    } catch (error) {
      console.error('[Admin Dashboard API] Failed to build payload', error);
      res.status(500).json({ error: 'Failed to fetch dashboard payload' });
    }
  });

  // Direct validation link for volunteer group requests (from admin notification email)
  app.get("/api/validate-group-request/:token", async (req, res) => {
    const { token } = req.params;

    if (!token || typeof token !== "string" || token.length < 32) {
      res.status(400).send(validationResultPage(false, "Lien de validation invalide."));
      return;
    }

    try {
      const result = await validateGroupRequestByToken(token);
      res.status(200).send(
        validationResultPage(
          true,
          `L'inscription du groupe <strong>${result.groupName}</strong> pour le jour ${result.dayNumber} du Ramadan a été validée avec succès.<br><br>
           Un email de confirmation avec le QR code a été envoyé au responsable (<strong>${result.responsibleEmail}</strong>).<br>
           ${result.participantsProcessed > 0 ? `${result.participantsProcessed} participant(s) ont été inscrits et ont reçu leur QR code par email.` : ''}`
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Une erreur est survenue.";
      res.status(400).send(validationResultPage(false, message));
    }
  });

  // ─── AI STREAMING CHAT (SSE) ─────────────────────────────────────────────────
  // POST /api/ai/chat/stream
  // Body: { message: string, conversationId?: string }
  // Returns: Server-Sent Events stream with delta text chunks
  app.post("/api/ai/chat/stream", async (req, res) => {
    // 1. Authenticate
    let user: Awaited<ReturnType<typeof sdk.authenticateRequest>> | null = null;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      res.status(401).json({ error: "Non authentifié" });
      return;
    }

    const message: string = typeof req.body?.message === "string" ? req.body.message.slice(0, 4000) : "";
    if (!message) {
      res.status(400).json({ error: "message est requis" });
      return;
    }

    const conversationId: string | undefined =
      typeof req.body?.conversationId === "string" ? req.body.conversationId : undefined;

    // 2. SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const sendEvent = (event: string, data: string) => {
      res.write(`event: ${event}\ndata: ${data}\n\n`);
    };

    try {
      const isAdmin = ["admin", "super_admin", "admin_ops"].includes(user.role);

      // 3. Ensure conversation + RAG
      const convId = await getOrCreateConversation(user.openId, conversationId);
      await saveMessage(convId, "user", message);

      const [ragContext, history] = await Promise.all([
        buildRagContext(message, isAdmin),
        getConversationHistory(convId, 20),
      ]);

      const systemPrompt =
        BASE_SYSTEM_PROMPT +
        (isAdmin
          ? "\nTu parles à un administrateur. Analyse détaillée autorisée."
          : "\nTu parles à un utilisateur standard.") +
        (ragContext ? `\n\n${ragContext}` : "");

      const messages = [
        { role: "system", content: systemPrompt },
        ...history.slice(0, -1),
        { role: "user", content: message },
      ];

      // 4. Emit conversationId to client
      sendEvent("conversation", JSON.stringify({ conversationId: convId }));

      // 5. Call Forge API with stream: true
      const forgeApiUrl = ENV.forgeApiUrl
        ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
        : "https://forge.manus.im/v1/chat/completions";

      const forgeRes = await fetch(forgeApiUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${ENV.forgeApiKey}`,
        },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages,
          max_tokens: 2048,
          stream: true,
        }),
      });

      if (!forgeRes.ok || !forgeRes.body) {
        const errText = await forgeRes.text();
        sendEvent("error", JSON.stringify({ message: `LLM error: ${errText.slice(0, 200)}` }));
        res.end();
        return;
      }

      // 6. Stream SSE chunks from Forge → client
      const decoder = new TextDecoder();
      let buffer = "";
      let fullReply = "";

      for await (const chunk of forgeRes.body as unknown as AsyncIterable<Uint8Array>) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;

          try {
            const parsed = JSON.parse(payload);
            const delta: string = parsed?.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              fullReply += delta;
              sendEvent("delta", JSON.stringify({ delta }));
            }
          } catch {
            // malformed chunk – skip
          }
        }
      }

      // 7. Persist assistant reply
      await saveMessage(convId, "assistant", fullReply || "(no content)", ragContext);

      sendEvent("done", JSON.stringify({ conversationId: convId }));
      res.end();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur interne";
      console.error("[AI Stream] Error:", err);
      sendEvent("error", JSON.stringify({ message: msg }));
      res.end();
    }
  });

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouterUpdated,
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

function validationResultPage(success: boolean, message: string): string {
  const color = success ? "#166534" : "#991b1b";
  const bgColor = success ? "#f0fdf4" : "#fef2f2";
  const borderColor = success ? "#16a34a" : "#dc2626";
  const icon = success ? "✅" : "❌";
  const title = success ? "Inscription validée" : "Validation impossible";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} – Ftour Bab Rayan</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f5f5f5;">
  <table role="presentation" style="width:100%;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:60px 20px;">
        <table role="presentation" style="width:560px;max-width:100%;border-collapse:collapse;background:#fff;border-radius:12px;box-shadow:0 2px 16px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:linear-gradient(135deg,#166534 0%,#15803d 100%);padding:28px;text-align:center;border-radius:12px 12px 0 0;">
              <h1 style="color:#fff;margin:0;font-size:26px;font-weight:bold;">
                Ftour <span style="color:#fbbf24;">Bab Rayan</span>
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 36px;">
              <div style="background-color:${bgColor};border:2px solid ${borderColor};border-radius:10px;padding:28px;text-align:center;">
                <div style="font-size:48px;margin-bottom:16px;">${icon}</div>
                <h2 style="color:${color};margin:0 0 16px 0;font-size:22px;">${title}</h2>
                <p style="color:#374151;font-size:15px;line-height:1.7;margin:0;">${message}</p>
              </div>
              <p style="color:#6b7280;font-size:13px;text-align:center;margin:28px 0 0 0;">
                Vous pouvez fermer cette fenêtre.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8f9fa;padding:18px 36px;text-align:center;border-radius:0 0 12px 12px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:13px;color:#6b7280;">Association Bab Rayan – 4 rue Bayt Lahm, quartier Palmier, Casablanca</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

startServer().catch(console.error);
