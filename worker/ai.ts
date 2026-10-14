/** REST routes of the AI assistant, called from handleHubRequest for any /hub/ai/* path. */
import type { D1Like } from "./gallery-d1";
import * as H from "./hub-d1";
import * as N from "./hub-notify";
import * as A from "./ai-d1";
import { AiUnavailable, clip, complete, fallbackSummary, parseModels, splitEscalation, type ChatMsg, type FetchLike } from "./ai-core";
import { CONTEXT_PREFIX, FALLBACK_REPLY, MEMBER_PROMPT, PUBLIC_FALLBACK, PUBLIC_PROMPT, SUMMARY_PROMPT } from "./ai-prompts";
import { id, readJson, str } from "./hub-http";
import { escapeHtml } from "./email";

export interface AiCtx {
  d: D1Like;
  request: Request;
  url: URL;
  path: string; // after "ai/"
  now: () => number;
  json: (data: unknown, status?: number) => Response;
  member: () => Promise<H.MemberRow>;
  admin: () => Promise<void>;
  ip: string;
  env: { OPENROUTER_API_KEY?: string; AI_MODELS?: string };
  fetchFn: FetchLike;
  baseUrl: string;
  /** Best-effort mail to the support inbox (never throws). */
  mailSupport: (subject: string, html: string) => Promise<unknown>;
}

export const SUPPORT_EMAIL = "support@ftourbabrayan.ma";

const UNAVAILABLE = { error: "ai_unavailable", message: "L'assistant est indisponible pour le moment, réessayez dans quelques minutes." };

export async function handleAi(c: AiCtx): Promise<Response | null> {
  const { d, request, url, path, now, json, member, admin, ip, env, fetchFn, baseUrl, mailSupport } = c;
  const match = (method: string, re: RegExp) => (request.method === method ? re.exec(path) : null);
  const models = parseModels(env.AI_MODELS);
  const ask = (messages: ChatMsg[]) => complete(fetchFn, env.OPENROUTER_API_KEY, models, messages);
  const guard = async (fn: () => Promise<Response>): Promise<Response> => {
    try { return await fn(); } catch (e) { if (e instanceof AiUnavailable) return json(UNAVAILABLE, 503); throw e; }
  };
  const userText = (v: unknown) => {
    const s = str(v).trim();
    if (s.length < 1 || s.length > A.LIMITS.userChars) throw new H.HubError("invalid", `Message invalide (1 à ${A.LIMITS.userChars} caractères)`);
    return s;
  };
  let m: RegExpExecArray | null;

  // ---- public bot (stateless: the client sends the last turns) -----------------
  if (match("POST", /^public$/)) {
    const b = await readJson(request);
    const turns = (Array.isArray(b.messages) ? b.messages : []).slice(-A.LIMITS.historyTurns * 2)
      .filter((x): x is { role: "user" | "assistant"; content: string } => !!x && (x.role === "user" || x.role === "assistant") && typeof x.content === "string")
      .map(x => ({ role: x.role, content: clip(x.content, A.LIMITS.userChars) }));
    const last = turns[turns.length - 1];
    if (!last || last.role !== "user" || last.content.trim().length < 1 || str((b.messages as { content?: unknown }[]).at(-1)?.content).length > A.LIMITS.userChars)
      throw new H.HubError("invalid", `Message invalide (1 à ${A.LIMITS.userChars} caractères)`);
    await A.hit(d, `ip:${ip}`, A.LIMITS.publicPerWindow, A.LIMITS.publicWindowMs, now());
    return guard(async () => json({ reply: splitEscalation(await ask([{ role: "system", content: PUBLIC_PROMPT }, ...turns])).reply || PUBLIC_FALLBACK }));
  }

  // ---- member bot ----------------------------------------------------------------
  if (match("GET", /^choices$/)) {
    const me = await member();
    return json({ items: await A.choices(d, me.id) });
  }
  if ((m = match("GET", /^conversations\/(\d+)$/))) {
    const me = await member();
    const conv = await A.getOwned(d, me.id, id(m[1]));
    return json({ messages: await A.messages(d, conv.id), case: await A.caseOf(d, conv.id), source: conv.source, item_id: conv.item_id });
  }
  if (match("POST", /^chat$/)) {
    const me = await member();
    const b = await readJson(request);
    const text = userText(b.message);
    let conv: A.ConvRow;
    if (b.conversation_id !== undefined && b.conversation_id !== null) conv = await A.getOwned(d, me.id, id(b.conversation_id));
    else {
      const ref = b.source === undefined || b.source === null ? null : A.isSource(b.source) ? { source: b.source, id: id(b.item_id) } : (() => { throw new H.HubError("invalid", "Source invalide"); })();
      conv = await A.getOwned(d, me.id, await A.openConversation(d, me, ref, now()));
    }
    await A.hit(d, `m:${me.id}`, A.LIMITS.memberPerHour, H.HOUR_MS, now());
    await A.addMessage(d, conv.id, "user", text, now());
    const open = await A.caseOf(d, conv.id);
    if (open?.status === "open") return json({ conversation_id: conv.id, reply: null, escalated: false, case_open: true });

    return guard(async () => {
      const context = conv.source && conv.item_id ? await A.itemContext(d, me, { source: conv.source, id: conv.item_id }).catch(() => null) : null;
      const hist = await A.history(d, conv.id, A.LIMITS.historyTurns);
      const system = context ? `${MEMBER_PROMPT}\n\n${CONTEXT_PREFIX}${context}` : MEMBER_PROMPT;
      const out = splitEscalation(await ask([{ role: "system", content: system }, ...hist.map(x => ({ role: x.role, content: x.body }))]));
      const replyText = out.reply || FALLBACK_REPLY;
      await A.addMessage(d, conv.id, "assistant", replyText, now());
      if (out.escalate) await openCase(conv.id, me);
      return json({ conversation_id: conv.id, reply: replyText, escalated: out.escalate, case_open: out.escalate });
    });
  }
  if (match("POST", /^escalate$/)) {
    const me = await member();
    const conv = await A.getOwned(d, me.id, id((await readJson(request)).conversation_id));
    const ex = await A.caseOf(d, conv.id);
    if (ex?.status === "open") return json({ case_id: ex.id }); // no summary call, no quota
    await A.hit(d, `m:${me.id}`, A.LIMITS.memberPerHour, H.HOUR_MS, now());
    const r = await openCase(conv.id, me);
    return json({ case_id: r.id });
  }

  // ---- admin ---------------------------------------------------------------------
  if (match("GET", /^admin\/cases$/)) {
    await admin();
    const status = url.searchParams.get("status") ?? "open";
    if (status !== "open" && status !== "closed") throw new H.HubError("invalid", "Statut invalide");
    return json({ cases: await A.listCases(d, status) });
  }
  if ((m = match("GET", /^admin\/cases\/(\d+)$/))) {
    await admin();
    return json({ case: await A.getCase(d, id(m[1])) });
  }
  if ((m = match("POST", /^admin\/cases\/(\d+)\/reply$/))) {
    await admin();
    const caseId = id(m[1]);
    const body = str((await readJson(request)).body).trim();
    if (body.length < 1 || body.length > 2000) throw new H.HubError("invalid", "Réponse invalide (1 à 2000 caractères)");
    const meta = await A.caseMeta(d, caseId);
    await A.addMessage(d, meta.conversation_id, "admin", body, now());
    // type "announcement": the only bell type that fits (hub_notifications has a CHECK on type, no migration for this feature)
    await N.notify(d, meta.member_id, { type: "announcement", title: "Réponse de l'équipe", body: clip(body, 140), link: `/fr/benevole/espace?assistant=${meta.conversation_id}` }, now());
    return json({ ok: true });
  }
  if ((m = match("POST", /^admin\/cases\/(\d+)\/close$/))) {
    await admin();
    await A.closeCase(d, id(m[1]), now());
    return json({ ok: true });
  }

  return null;

  /** Summary by the model (or the last raw lines), the case row, and one mail to support when the case is new. */
  async function openCase(convId: number, me: H.MemberRow) {
    const msgs = await A.messages(d, convId);
    const lines = msgs.map(x => `${x.role === "user" ? "MEMBRE" : x.role === "admin" ? "ADMIN" : "ASSISTANT"}: ${x.body}`);
    let summary: string;
    try { summary = await ask([{ role: "system", content: SUMMARY_PROMPT }, { role: "user", content: clip(lines.join("\n"), A.LIMITS.ctxChars) }]); }
    catch { summary = fallbackSummary(lines); }
    const r = await A.createCase(d, convId, me.id, summary, now());
    if (r.created) {
      await mailSupport(
        `Assistant IA — dossier #${r.id} (${me.display_name})`,
        `<p><b>${escapeHtml(me.display_name)}</b> (${escapeHtml(me.email)}) demande l'aide d'un administrateur.</p><p><b>Résumé</b></p><p style="white-space:pre-line">${escapeHtml(summary)}</p><p><a href="${baseUrl}/fr/admin/benevoles">Ouvrir « Dossiers IA » dans l'admin</a> (dossier #${r.id})</p>`,
      );
    }
    return r;
  }
}
