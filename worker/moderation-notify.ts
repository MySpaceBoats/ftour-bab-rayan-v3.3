/** Notifications de modération: cloche + mail (hub-notify) et message de messagerie de l'Équipe Ftour. Chaque canal est isolé: un échec n'arrête pas les autres. */
import type { D1Like } from "./gallery-d1";
import { escapeHtml } from "./email";
import { iso, teamMemberId, TEAM_EMAIL } from "./hub-d1";
import { deliverTo, type Mailer, type NotifInput } from "./hub-notify";
import { ruleById } from "./moderation-rules";
import type { ModerationEvent, Target } from "./moderation";

export interface NotifyDeps { mailer: Mailer; adminEmail: string }

const WORD = {
  post: { noun: "publication", masked: "masquée", restored: "rétablie", article: "Votre" },
  comment: { noun: "commentaire", masked: "masqué", restored: "rétabli", article: "Votre" },
} as const satisfies Record<Target, object>;

const attempt = async (label: string, job: () => Promise<unknown>) => {
  try { await job(); } catch (e) { console.error(`[moderation-notify] ${label} failed`, e); }
};

/** One Pro thread per member with the Équipe account, written directly: openThread/sendMessage require confirmed volunteers. */
export async function systemMessage(d: D1Like, fromId: number, toId: number, body: string, nowMs: number): Promise<void> {
  const [a, b] = fromId < toId ? [fromId, toId] : [toId, fromId];
  const t = await d.prepare(
    `INSERT INTO pro_threads (member_a, member_b, job_id, created_by, created_at, last_message_at) VALUES (?,?,0,?,?,?)
     ON CONFLICT(member_a, member_b, job_id) DO UPDATE SET last_message_at = excluded.last_message_at RETURNING id`,
  ).bind(a, b, fromId, iso(nowMs), iso(nowMs)).first<{ id: number }>();
  await d.prepare("INSERT INTO pro_messages (thread_id, sender_id, body, created_at) VALUES (?,?,?,?)").bind(t!.id, fromId, body.slice(0, 1000), iso(nowMs)).run();
}

async function moderators(d: D1Like): Promise<number[]> {
  const { results } = await d.prepare("SELECT id FROM hub_members WHERE role = 'moderator' AND status = 'active' AND email <> ?").bind(TEAM_EMAIL).all<{ id: number }>();
  return results.map(r => r.id);
}

const ruleLine = (e: Pick<ModerationEvent, "rule" | "reason">) => {
  const r = ruleById(e.rule);
  return `règle ${e.rule}${r ? ` (${r.title})` : ""} : ${e.reason}`;
};

export async function notifyModeration(d: D1Like, deps: NotifyDeps, e: ModerationEvent, nowMs: number): Promise<void> {
  const w = WORD[e.type];
  const team = await teamMemberId(d);
  const link = "/benevole/espace";
  const mods = await moderators(d);

  if (e.action === "hidden") {
    const n: NotifInput = { type: "announcement", title: `${w.article} ${w.noun} a été ${w.masked}`, body: ruleLine(e), link, dedupeKey: `mod:${e.id}:author` };
    await attempt("author bell+mail", () => deliverTo(d, deps.mailer, [{ memberId: e.memberId, n }], nowMs));
    await attempt("author message", () => systemMessage(d, team, e.memberId,
      `Bonjour, votre ${w.noun} a été ${w.masked} automatiquement car ce contenu ne respecte pas la ${ruleLine(e)}\n\nExtrait : « ${e.excerpt} »\n\nSi vous pensez qu'il s'agit d'une erreur, écrivez à ${deps.adminEmail}. Les contenus de l'espace sont analysés automatiquement.`, nowMs));
  }

  const adminTitle = e.action === "hidden" ? `Modération IA : ${w.noun} ${w.masked}` : `Modération IA : ${w.noun} à vérifier`;
  const adminBody = `${ruleLine(e)} (confiance ${Math.round(e.confidence * 100)} %). Extrait : « ${e.excerpt} »`;
  await attempt("moderators bell+mail", () => deliverTo(d, deps.mailer, mods.map(id => ({ memberId: id, n: { type: "announcement" as const, title: adminTitle, body: adminBody, link: "/admin/hub", dedupeKey: `mod:${e.id}:m${id}` } })), nowMs));
  for (const id of mods) await attempt(`moderator ${id} message`, () => systemMessage(d, team, id, `${adminTitle}\n${adminBody}`, nowMs));
  await attempt("admin mail", () => deps.mailer.sendBatch([{
    to: deps.adminEmail, subject: adminTitle,
    html: `<p><strong>${escapeHtml(adminTitle)}</strong></p><p>${escapeHtml(adminBody)}</p><p><a href="${escapeHtml(`${deps.mailer.baseUrl}/admin/hub`)}">Ouvrir l'écran de modération</a></p>`,
  }]));
}

export async function notifyRestored(d: D1Like, deps: NotifyDeps, e: Pick<ModerationEvent, "id" | "type" | "memberId" | "excerpt">, nowMs: number): Promise<void> {
  const w = WORD[e.type];
  const team = await teamMemberId(d);
  const title = `${w.article} ${w.noun} a été ${w.restored}`;
  await attempt("author bell+mail", () => deliverTo(d, deps.mailer, [{ memberId: e.memberId, n: { type: "announcement", title, body: "Un administrateur a vérifié et rétabli votre contenu.", link: "/benevole/espace", dedupeKey: `mod:${e.id}:restored` } }], nowMs));
  await attempt("author message", () => systemMessage(d, team, e.memberId, `Bonjour, ${title.toLowerCase()} : un administrateur a vérifié votre contenu et l'a rétabli. Désolé pour la gêne.\n\nExtrait : « ${e.excerpt} »`, nowMs));
}
