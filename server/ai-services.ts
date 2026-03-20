/**
 * AI Services – Ftour Bab Rayan
 *
 * Responsibilities:
 *  - RAG context builder  (keyword-intent → structured DB queries → context string)
 *  - Conversation persistence (Supabase)
 *  - Admin analysis helpers
 *  - Content generation helpers
 *  - Action-log writer
 */

import { getSupabaseAdminClient } from "./supabase";
import { invokeLLM } from "./_core/llm";
import type { Message } from "./_core/llm";

// ─────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────

export const BASE_SYSTEM_PROMPT = `Tu es l'assistant IA intelligent de la plateforme Ftour Bab Rayan, une association caritative marocaine qui organise des iftars (ftours) pendant le Ramadan à Casablanca.

Tu peux :
- Répondre aux questions sur la plateforme, les événements, les bénévoles, les réservations
- Analyser les données d'événements et générer des insights
- Aider les administrateurs à prendre des décisions éclairées
- Générer du contenu (articles de blog, rapports, posts réseaux sociaux)
- Détecter des anomalies dans les logs et les comportements

Tu réponds en français par défaut, en arabe si l'utilisateur écrit en arabe, et en anglais si l'utilisateur écrit en anglais.

Sois précis, professionnel, bienveillant. Ne révèle jamais de données personnelles sensibles (numéros de téléphone complets, emails) dans tes réponses.`;

const ADMIN_SYSTEM_ADDENDUM = `
Tu parles à un administrateur de la plateforme. Tu peux fournir des analyses détaillées, des statistiques et des recommandations opérationnelles. Accès complet aux données agrégées.`;

const USER_SYSTEM_ADDENDUM = `
Tu parles à un utilisateur standard. Limite tes réponses aux informations publiques et à l'aide générale sur la plateforme.`;

// ─────────────────────────────────────────────────────────────
// INTENT DETECTION
// ─────────────────────────────────────────────────────────────

type Intent =
  | "volunteers"
  | "reservations"
  | "orders"
  | "donations"
  | "feedback"
  | "events"
  | "products"
  | "blog"
  | "general";

const INTENT_KEYWORDS: Record<Intent, string[]> = {
  volunteers: [
    "bénévole", "benevole", "volunteer", "inscription", "présence", "absent",
    "scanner", "qr", "scan", "checkin", "jour", "day", "présent", "كافل", "متطوع"
  ],
  reservations: [
    "réservation", "reservation", "restaurant", "table", "groupe", "créneau",
    "slot", "place", "espace", "brasserie", "jardin", "empresa", "entreprise", "حجز"
  ],
  orders: [
    "commande", "order", "goodies", "boutique", "livraison", "pickup",
    "paiement", "payment", "article", "panier", "طلب", "مشتريات"
  ],
  donations: [
    "don", "donation", "donner", "montant", "virement", "chèque", "reçu",
    "financement", "تبرع", "هبة"
  ],
  feedback: [
    "avis", "feedback", "retour", "satisfaction", "nps", "note",
    "amélioration", "améliorer", "problème", "issue", "sentiment", "تقييم", "رأي"
  ],
  events: [
    "événement", "event", "ramadan", "ftour", "iftar", "statistique", "stat",
    "performance", "capacité", "capacity", "remplissage", "حدث", "إفطار", "رمضان"
  ],
  products: [
    "produit", "product", "patisserie", "terroir", "menu", "stock", "prix",
    "catalogue", "منتج", "كعك"
  ],
  blog: [
    "blog", "article", "publication", "post", "contenu", "content",
    "rédiger", "écrire", "résumé", "مقال", "منشور"
  ],
  general: [],
};

export function detectIntent(query: string): Intent {
  const lower = query.toLowerCase();
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS) as [Intent, string[]][]) {
    if (intent === "general") continue;
    if (keywords.some(k => lower.includes(k))) return intent;
  }
  return "general";
}

// ─────────────────────────────────────────────────────────────
// RAG CONTEXT BUILDER
// ─────────────────────────────────────────────────────────────

export async function buildRagContext(query: string, isAdmin: boolean): Promise<string> {
  const intent = detectIntent(query);
  const supabase = getSupabaseAdminClient();

  if (!supabase) return "";

  const snippets: string[] = [];

  try {
    // ── Event / Volunteer stats (always relevant for admins) ──
    if (isAdmin || intent === "events" || intent === "volunteers") {
      const { data: days } = await supabase
        .from("ramadan_days")
        .select("day_number, date, capacity, registered_count, is_open, location, iftar_time")
        .order("day_number", { ascending: true })
        .limit(30);

      if (days?.length) {
        const totalCap = days.reduce((s, d) => s + (d.capacity || 0), 0);
        const totalReg = days.reduce((s, d) => s + (d.registered_count || 0), 0);
        const openDays = days.filter(d => d.is_open).length;
        const fullDays = days.filter(d => d.registered_count >= d.capacity).length;

        snippets.push(
          `=== JOURS RAMADAN ===\n` +
          `Total jours configurés: ${days.length}, jours ouverts: ${openDays}, jours complets: ${fullDays}\n` +
          `Capacité totale: ${totalCap} places, inscrits: ${totalReg} (${Math.round(totalReg / (totalCap || 1) * 100)}% de remplissage)\n` +
          days
            .slice(-5)
            .map(d => `Jour ${d.day_number} (${d.date?.split("T")[0]}): ${d.registered_count}/${d.capacity} ${d.is_open ? "OUVERT" : "FERMÉ"}`)
            .join("\n")
        );
      }
    }

    // ── Volunteer details ──────────────────────────────────────
    if (intent === "volunteers" || (isAdmin && intent === "events")) {
      const { data: vols } = await supabase
        .from("volunteers")
        .select("status, city, created_at")
        .limit(500);

      if (vols?.length) {
        const byStatus = vols.reduce<Record<string, number>>((acc, v) => {
          acc[v.status] = (acc[v.status] || 0) + 1;
          return acc;
        }, {});
        const cities = vols.reduce<Record<string, number>>((acc, v) => {
          if (v.city) acc[v.city] = (acc[v.city] || 0) + 1;
          return acc;
        }, {});
        const topCities = Object.entries(cities)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([c, n]) => `${c}: ${n}`)
          .join(", ");

        snippets.push(
          `=== BÉNÉVOLES ===\n` +
          `Total: ${vols.length}\n` +
          Object.entries(byStatus).map(([s, n]) => `${s}: ${n}`).join(", ") + "\n" +
          `Top villes: ${topCities}`
        );
      }
    }

    // ── Reservations ──────────────────────────────────────────
    if (intent === "reservations") {
      const { data: res } = await supabase
        .from("restaurant_reservations")
        .select("status, group_size, space, created_at")
        .order("created_at", { ascending: false })
        .limit(200);

      if (res?.length) {
        const byStatus = res.reduce<Record<string, number>>((acc, r) => {
          acc[r.status] = (acc[r.status] || 0) + 1;
          return acc;
        }, {});
        const totalGuests = res.reduce((s, r) => s + (r.group_size || 1), 0);
        snippets.push(
          `=== RÉSERVATIONS RESTAURANT ===\n` +
          `Total: ${res.length}, couverts totaux: ${totalGuests}\n` +
          Object.entries(byStatus).map(([s, n]) => `${s}: ${n}`).join(", ")
        );
      }
    }

    // ── Orders ────────────────────────────────────────────────
    if (intent === "orders") {
      const { data: orders } = await supabase
        .from("orders")
        .select("status, total_amount, created_at")
        .order("created_at", { ascending: false })
        .limit(200);

      if (orders?.length) {
        const byStatus = orders.reduce<Record<string, number>>((acc, o) => {
          acc[o.status] = (acc[o.status] || 0) + 1;
          return acc;
        }, {});
        const totalRevenue = orders.reduce(
          (s, o) => s + parseFloat(o.total_amount || "0"),
          0
        );
        snippets.push(
          `=== COMMANDES ===\n` +
          `Total: ${orders.length}, CA: ${totalRevenue.toFixed(2)} MAD\n` +
          Object.entries(byStatus).map(([s, n]) => `${s}: ${n}`).join(", ")
        );
      }
    }

    // ── Donations ─────────────────────────────────────────────
    if (intent === "donations") {
      const { data: dons } = await supabase
        .from("donations")
        .select("status, amount, payment_method, is_anonymous, created_at")
        .order("created_at", { ascending: false })
        .limit(200);

      if (dons?.length) {
        const received = dons.filter(d => d.status === "received");
        const totalReceived = received.reduce(
          (s, d) => s + parseFloat(d.amount || "0"),
          0
        );
        const totalPromised = dons.reduce(
          (s, d) => s + parseFloat(d.amount || "0"),
          0
        );
        snippets.push(
          `=== DONS ===\n` +
          `Total promesses: ${dons.length} (${totalPromised.toFixed(2)} MAD)\n` +
          `Dons reçus: ${received.length} (${totalReceived.toFixed(2)} MAD)\n` +
          `Taux de conversion: ${Math.round(received.length / (dons.length || 1) * 100)}%`
        );
      }
    }

    // ── Feedback / Sentiment ──────────────────────────────────
    if (intent === "feedback" || (isAdmin && intent === "events")) {
      const { data: fb } = await supabase
        .from("event_feedback")
        .select("overall_rating, nps_score, would_recommend, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (fb?.length) {
        const avgRating =
          fb.reduce((s, f) => s + (f.overall_rating || 0), 0) / fb.length;
        const avgNps =
          fb.filter(f => f.nps_score !== null).reduce((s, f) => s + (f.nps_score || 0), 0) /
          (fb.filter(f => f.nps_score !== null).length || 1);
        const recommend = fb.filter(f => f.would_recommend === true).length;

        snippets.push(
          `=== FEEDBACK ÉVÉNEMENT ===\n` +
          `Total avis: ${fb.length}\n` +
          `Note moyenne: ${avgRating.toFixed(1)}/5\n` +
          `NPS moyen: ${avgNps.toFixed(1)}/10\n` +
          `Recommanderait: ${recommend}/${fb.length} (${Math.round(recommend / (fb.length || 1) * 100)}%)`
        );
      }

      // Free-text feedback
      const { data: textFb } = await supabase
        .from("event_feedback_text_responses")
        .select("question_key, response_text")
        .not("response_text", "is", null)
        .order("created_at", { ascending: false })
        .limit(20);

      if (textFb?.length) {
        snippets.push(
          `=== COMMENTAIRES LIBRES (20 derniers) ===\n` +
          textFb
            .map(f => `[${f.question_key}]: "${f.response_text?.slice(0, 120)}"`)
            .join("\n")
        );
      }
    }

    // ── Products / Catalogue ──────────────────────────────────
    if (intent === "products") {
      const { data: goodies } = await supabase
        .from("goodies")
        .select("name, price, stock, is_active, category")
        .eq("is_active", true)
        .limit(30);

      if (goodies?.length) {
        snippets.push(
          `=== GOODIES DISPONIBLES ===\n` +
          goodies.map(g => `${g.name} – ${g.price} MAD (stock: ${g.stock})`).join("\n")
        );
      }
    }

    // ── Blog content ──────────────────────────────────────────
    if (intent === "blog") {
      const { data: articles } = await supabase
        .from("community_blog")
        .select("title, summary, tags, published_at")
        .order("published_at", { ascending: false })
        .limit(5);

      if (articles?.length) {
        snippets.push(
          `=== ARTICLES DE BLOG RÉCENTS ===\n` +
          articles.map(a => `"${a.title}" (${a.published_at?.split("T")[0]})`).join("\n")
        );
      }
    }
  } catch (err) {
    console.error("[AI] RAG context build error:", err);
  }

  return snippets.length
    ? `--- CONTEXTE PLATEFORME ---\n${snippets.join("\n\n")}\n--- FIN CONTEXTE ---`
    : "";
}

// ─────────────────────────────────────────────────────────────
// CONVERSATION PERSISTENCE
// ─────────────────────────────────────────────────────────────

export async function getOrCreateConversation(
  userOpenId: string,
  conversationId?: string
): Promise<string> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase not configured");

  if (conversationId) {
    const { data } = await supabase
      .from("ai_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_openid", userOpenId)
      .single();

    if (data?.id) return data.id;
  }

  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({ user_openid: userOpenId })
    .select("id")
    .single();

  if (error || !data) throw new Error(`Failed to create conversation: ${error?.message}`);
  return data.id;
}

export async function getConversationHistory(
  conversationId: string,
  limit = 20
): Promise<Message[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  return (data || []) as Message[];
}

export async function saveMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  contextUsed?: string,
  tokensUsed?: number
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    role,
    content,
    context_used: contextUsed ? { snippet: contextUsed.slice(0, 2000) } : null,
    tokens_used: tokensUsed ?? null,
  });

  // Auto-generate conversation title from first user message
  if (role === "user") {
    const { data: existing } = await supabase
      .from("ai_messages")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("role", "user")
      .limit(2);

    if (existing?.length === 1) {
      await supabase
        .from("ai_conversations")
        .update({ title: content.slice(0, 80) })
        .eq("id", conversationId);
    }
  }
}

export async function listConversations(userOpenId: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("ai_conversations")
    .select("id, title, created_at, updated_at")
    .eq("user_openid", userOpenId)
    .order("updated_at", { ascending: false })
    .limit(30);

  return data || [];
}

export async function deleteConversation(conversationId: string, userOpenId: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  await supabase
    .from("ai_conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_openid", userOpenId);
}

// ─────────────────────────────────────────────────────────────
// CORE CHAT  (non-streaming, tRPC-compatible)
// ─────────────────────────────────────────────────────────────

export async function chat({
  userOpenId,
  userRole,
  message,
  conversationId,
}: {
  userOpenId: string;
  userRole: string;
  message: string;
  conversationId?: string;
}): Promise<{ reply: string; conversationId: string; tokensUsed?: number }> {
  const isAdmin =
    userRole === "admin" ||
    userRole === "super_admin" ||
    userRole === "admin_ops";

  // 1. Ensure conversation exists
  const convId = await getOrCreateConversation(userOpenId, conversationId);

  // 2. Save the user message
  await saveMessage(convId, "user", message);

  // 3. Build RAG context
  const ragContext = await buildRagContext(message, isAdmin);

  // 4. Load recent history (last 10 turns = 20 messages)
  const history = await getConversationHistory(convId, 20);

  // 5. Build messages array for LLM
  const systemPrompt =
    BASE_SYSTEM_PROMPT +
    (isAdmin ? ADMIN_SYSTEM_ADDENDUM : USER_SYSTEM_ADDENDUM) +
    (ragContext ? `\n\n${ragContext}` : "");

  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    // inject history (exclude the last user msg we just saved, it's already in history)
    ...history.slice(0, -1),
    { role: "user", content: message },
  ];

  // 6. Call LLM
  const result = await invokeLLM({ messages, maxTokens: 2048 });
  const reply =
    typeof result.choices[0]?.message?.content === "string"
      ? result.choices[0].message.content
      : "";

  const tokensUsed = result.usage?.total_tokens;

  // 7. Save assistant reply
  await saveMessage(convId, "assistant", reply, ragContext, tokensUsed);

  return { reply, conversationId: convId, tokensUsed };
}

// ─────────────────────────────────────────────────────────────
// ADMIN ANALYSIS
// ─────────────────────────────────────────────────────────────

export async function runAdminAnalysis(analysisType: string): Promise<string> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase not configured");

  let dataContext = "";

  switch (analysisType) {
    case "event_performance": {
      const [daysRes, volsRes, fbRes] = await Promise.allSettled([
        supabase.from("ramadan_days").select("*").order("day_number"),
        supabase.from("volunteers").select("status, city, day_id, created_at").limit(2000),
        supabase
          .from("event_feedback")
          .select("overall_rating, nps_score, would_recommend, day_id")
          .limit(500),
      ]);

      const days = daysRes.status === "fulfilled" ? daysRes.value.data || [] : [];
      const vols = volsRes.status === "fulfilled" ? volsRes.value.data || [] : [];
      const fbs  = fbRes.status  === "fulfilled" ? fbRes.value.data   || [] : [];

      const totalReg = vols.length;
      const totalPresent = vols.filter(v => v.status === "present").length;
      const totalAbsent  = vols.filter(v => v.status === "absent").length;
      const avgRating = fbs.length
        ? (fbs.reduce((s, f) => s + (f.overall_rating || 0), 0) / fbs.length).toFixed(1)
        : "N/A";

      dataContext =
        `Jours Ramadan: ${days.length}\n` +
        `Bénévoles inscrits: ${totalReg}, présents: ${totalPresent} (${Math.round(totalPresent/(totalReg||1)*100)}%), absents: ${totalAbsent}\n` +
        `Note moyenne satisfaction: ${avgRating}/5\n` +
        `Avis reçus: ${fbs.length}`;
      break;
    }

    case "feedback_sentiment": {
      const [fbRes, textRes] = await Promise.allSettled([
        supabase
          .from("event_feedback")
          .select("overall_rating, nps_score, would_recommend, created_at")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("event_feedback_text_responses")
          .select("question_key, response_text")
          .not("response_text", "is", null)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      const fbs  = fbRes.status  === "fulfilled" ? fbRes.value.data  || [] : [];
      const texts = textRes.status === "fulfilled" ? textRes.value.data || [] : [];

      dataContext =
        `Total avis: ${fbs.length}\n` +
        `Note moyenne: ${fbs.length ? (fbs.reduce((s,f) => s+(f.overall_rating||0),0)/fbs.length).toFixed(1) : "N/A"}/5\n` +
        `Recommanderait: ${fbs.filter(f=>f.would_recommend).length}/${fbs.length}\n` +
        `\nCommentaires:\n` +
        texts
          .map(t => `[${t.question_key}]: "${t.response_text?.slice(0, 150)}"`)
          .join("\n");
      break;
    }

    case "volunteer_activity": {
      const { data: vols } = await supabase
        .from("volunteers")
        .select("first_name, last_name, status, city, day_id, created_at")
        .order("created_at", { ascending: false })
        .limit(500);

      const present = (vols || []).filter(v => v.status === "present");
      const cities = (vols || []).reduce<Record<string,number>>((acc,v)=>{
        if (v.city) acc[v.city] = (acc[v.city]||0)+1;
        return acc;
      }, {});
      const topCities = Object.entries(cities).sort((a,b)=>b[1]-a[1]).slice(0,5);

      dataContext =
        `Total bénévoles: ${(vols||[]).length}\n` +
        `Présents: ${present.length}\n` +
        `Top villes: ${topCities.map(([c,n])=>`${c}(${n})`).join(", ")}`;
      break;
    }

    case "anomaly_detection": {
      // Look for duplicate registrations, no-shows, high absence rate days
      const { data: vols } = await supabase
        .from("volunteers")
        .select("email, status, day_id, created_at")
        .limit(2000);

      const emailCounts: Record<string, number> = {};
      (vols || []).forEach(v => {
        emailCounts[v.email] = (emailCounts[v.email] || 0) + 1;
      });
      const duplicates = Object.entries(emailCounts).filter(([,n]) => n > 1);

      const absentByDay: Record<number, number> = {};
      (vols || []).filter(v => v.status === "absent").forEach(v => {
        absentByDay[v.day_id] = (absentByDay[v.day_id] || 0) + 1;
      });

      dataContext =
        `Emails en double: ${duplicates.length}\n` +
        `Jours avec beaucoup d'absents: ${
          Object.entries(absentByDay)
            .sort((a,b)=>b[1]-a[1])
            .slice(0,5)
            .map(([d,n])=>`Jour ${d}: ${n} absents`)
            .join(", ")
        }`;
      break;
    }

    default:
      throw new Error(`Unknown analysis type: ${analysisType}`);
  }

  const promptMap: Record<string, string> = {
    event_performance:
      `Analyse les données de performance de l'événement Ftour Bab Rayan et fournis:\n1. Un résumé des indicateurs clés\n2. Les points forts\n3. Les points d'amélioration\n4. 5 recommandations concrètes pour les prochains événements`,
    feedback_sentiment:
      `Analyse le sentiment des retours des participants. Fournis:\n1. Analyse sentiment globale (positif/neutre/négatif)\n2. Thèmes récurrents positifs\n3. Points de friction identifiés\n4. Suggestions d'amélioration priorisées`,
    volunteer_activity:
      `Analyse l'activité et l'engagement des bénévoles. Fournis:\n1. Profil démographique des bénévoles\n2. Taux de présence et no-show\n3. Géographie de mobilisation\n4. Recommandations pour fidéliser et recruter`,
    anomaly_detection:
      `Analyse les données et détecte les anomalies. Fournis:\n1. Anomalies identifiées (doublons, incohérences)\n2. Jours problématiques\n3. Risques identifiés\n4. Actions correctives recommandées`,
  };

  const result = await invokeLLM({
    messages: [
      { role: "system", content: BASE_SYSTEM_PROMPT + ADMIN_SYSTEM_ADDENDUM },
      {
        role: "user",
        content: `${promptMap[analysisType]}\n\n=== DONNÉES ===\n${dataContext}`,
      },
    ],
    maxTokens: 3000,
  });

  return typeof result.choices[0]?.message?.content === "string"
    ? result.choices[0].message.content
    : "Analyse indisponible.";
}

// ─────────────────────────────────────────────────────────────
// CONTENT GENERATION
// ─────────────────────────────────────────────────────────────

export async function generateContent({
  type,
  context,
  language = "fr",
}: {
  type: "blog_summary" | "social_post" | "event_report" | "email_template";
  context: string;
  language?: "fr" | "ar" | "en";
}): Promise<string> {
  const langInstructions: Record<string, string> = {
    fr: "Réponds en français.",
    ar: "أجب باللغة العربية.",
    en: "Respond in English.",
  };

  const typePrompts: Record<string, string> = {
    blog_summary:
      "Génère un résumé d'article de blog engageant (150-200 mots) avec un titre accrocheur et une introduction captivante.",
    social_post:
      "Rédige 3 variantes de posts réseaux sociaux (Facebook, Instagram, LinkedIn) de longueurs différentes, avec des emojis appropriés et des hashtags pertinents.",
    event_report:
      "Génère un rapport d'événement professionnel et structuré avec: résumé exécutif, statistiques clés, points marquants, défis rencontrés, et recommandations.",
    email_template:
      "Rédige un template d'email professionnel et chaleureux adapté à l'association Ftour Bab Rayan.",
  };

  const result = await invokeLLM({
    messages: [
      { role: "system", content: BASE_SYSTEM_PROMPT },
      {
        role: "user",
        content: `${typePrompts[type]}\n${langInstructions[language]}\n\nContexte / informations:\n${context}`,
      },
    ],
    maxTokens: 2000,
  });

  return typeof result.choices[0]?.message?.content === "string"
    ? result.choices[0].message.content
    : "Génération indisponible.";
}

// ─────────────────────────────────────────────────────────────
// ACTION LOGGING
// ─────────────────────────────────────────────────────────────

export async function logAction({
  userOpenId,
  sessionId,
  action,
  entityType,
  entityId,
  metadata,
  ip,
  userAgent,
}: {
  userOpenId?: string;
  sessionId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  // Fire-and-forget – do not await to avoid blocking request handling
  supabase
    .from("ai_action_logs")
    .insert({
      user_openid: userOpenId ?? null,
      session_id: sessionId ?? null,
      action,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      metadata: metadata ?? null,
      ip: ip ?? null,
      user_agent: userAgent ?? null,
    })
    .then(() => {})
    .catch(err => console.error("[AI] logAction error:", err));
}
