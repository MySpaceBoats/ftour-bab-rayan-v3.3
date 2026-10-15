// Outils GitHub du superassistant (équivalent « terminal » côté Worker : pas de shell, tout passe par l'API GitHub).
// Auth : secret GITHUB_TOKEN (PAT fin : Contents, Pull requests, Actions en lecture/écriture) sinon l'installation GitHub App (GITHUB_APP_*).
// Garde-fous serveur : merge, deploy et commit sur la branche par défaut exigent allow=true ; .env/.git/node_modules illisibles ; .github/workflows jamais modifiable.
import { getInstallationToken } from "./github-app";
import type { D1Like } from "./gallery-d1";

export type GhEnv = {
  GITHUB_TOKEN?: string; GITHUB_REPO?: string; GITHUB_BRANCH?: string; GITHUB_DEPLOY_WORKFLOW?: string;
  GITHUB_APP_ID?: string; GITHUB_APP_INSTALLATION_ID?: string; GITHUB_APP_PRIVATE_KEY?: string;
  CLOUDFLARE_API_TOKEN?: string; CLOUDFLARE_ACCOUNT_ID?: string;
  DB?: Pick<D1Like, "prepare">;
};
/** Terminal du conteneur Cloudflare (Sandbox.exec). */
export type Shell = { exec(cmd: string, o?: { cwd?: string; env?: Record<string, string>; timeout?: number }): Promise<{ stdout: string; stderr: string; exitCode: number }> };
export type Tool = { name: string; description: string; parameters: object; run: (a: Record<string, any>) => Promise<unknown> };

const te = new TextEncoder(), td = new TextDecoder();
export const READ_DENY = /^(\.env[^/]*|.*\/\.env[^/]*|\.git\/|node_modules\/|\.wrangler\/)/;
export const WRITE_DENY = /^\.github\/workflows\//;
const repo = (e: GhEnv) => e.GITHUB_REPO || "MySpaceBoats/ftour-bab-rayan-v3.3";
const main = (e: GhEnv) => e.GITHUB_BRANCH || "main";
export const githubReady = (e: GhEnv) => !!(e.GITHUB_TOKEN || (e.GITHUB_APP_ID && e.GITHUB_APP_INSTALLATION_ID && e.GITHUB_APP_PRIVATE_KEY));
const clean = (p: unknown) => String(p ?? "").replace(/^\/+/, "").replace(/\/{2,}/g, "/");
const safe = (p: string) => !!p && !p.includes("..") && !/[\0\\]/.test(p);
const b64 = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(s); };
const msg = (m: unknown) => { const s = String(m ?? "").replace(/[\r\n]+/g, " ").slice(0, 160).trim(); if (!s) throw new Error("message de commit requis"); return s; };

const ghToken = async (env: GhEnv) => env.GITHUB_TOKEN || (await getInstallationToken({ appId: env.GITHUB_APP_ID!, installationId: env.GITHUB_APP_INSTALLATION_ID!, privateKey: env.GITHUB_APP_PRIVATE_KEY! })).token;

async function gh(env: GhEnv, path: string, opt: RequestInit = {}): Promise<any> {
  const token = await ghToken(env);
  const r = await fetch("https://api.github.com" + path, { ...opt, headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "User-Agent": "ftour-superassistant", "X-GitHub-Api-Version": "2022-11-28", ...(opt.headers || {}) }, signal: AbortSignal.timeout(20000) });
  const text = await r.text(), j = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${j?.message ?? "erreur"}`);
  return j;
}
const post = (env: GhEnv, path: string, body: unknown, method = "POST") => gh(env, path, { method, body: JSON.stringify(body) });
const enc = encodeURIComponent;

async function sha(env: GhEnv, path: string, ref: string) {
  try { return (await gh(env, `/repos/${repo(env)}/contents/${encodeURI(path)}?ref=${enc(ref)}`)).sha as string; } catch (e) { if (/ 404/.test((e as Error).message)) return undefined; throw e; }
}

// Lecture seule : une seule instruction SELECT/WITH, aucun mot-clé d'écriture (D1 n'a pas de mode read-only natif).
// ponytail: un mot-clé dans un littéral ('update') est refusé aussi — plus strict que nécessaire, reformuler la requête.
const SQL_WRITE = /\b(insert|update|delete|drop|alter|create|attach|detach|pragma|vacuum|reindex)\b/i;
export function readOnlySql(q: unknown): string {
  const s = String(q ?? "").trim().replace(/;+\s*$/, "");
  if (!/^(select|with)\b/i.test(s) || s.includes(";") || SQL_WRITE.test(s)) throw new Error("requête refusée : une seule instruction SELECT (ou WITH … SELECT) en lecture seule");
  return s;
}
const DB_ROWS = 200;

const DIR = "/workspace/repo", BRANCH = /^[\w./-]{1,100}$/;

export function tools(env: GhEnv, allow: boolean, shell?: Shell): Tool[] {
  const R = repo(env), M = main(env);
  // Le jeton n'existe que dans l'env d'une commande (jamais écrit dans le remote ni sur disque) ; le shell libre n'en reçoit pas sans allow.
  const gitEnv = async () => { const t = await ghToken(env); return { GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: `url.https://x-access-token:${t}@github.com/.insteadOf`, GIT_CONFIG_VALUE_0: "https://github.com/" }; };
  let ready: Promise<void> | undefined;
  const run = async (cmd: string, o: { env?: Record<string, string>; timeout?: number } = {}) => {
    ready ||= (async () => {
      const r = await shell!.exec(`command -v pnpm >/dev/null || npm install -g pnpm@10.4.1; test -d ${DIR}/.git || (git clone --depth 50 https://github.com/${R}.git ${DIR} && git -C ${DIR} config user.name Superassistant && git -C ${DIR} config user.email superassistant@ftourbabrayan.ma)`, { env: await gitEnv(), timeout: 180000 });
      if (r.exitCode) { ready = undefined; throw new Error("clone impossible : " + (r.stderr || r.stdout).slice(-300)); }
    })();
    await ready;
    const r = await shell!.exec(cmd, { cwd: DIR, env: o.env, timeout: o.timeout ?? 120000 });
    return `exit ${r.exitCode}\n` + (r.stdout + (r.stderr ? "\n[stderr]\n" + r.stderr : "")).slice(-6000);
  };
  const branchArg = (b: unknown) => { if (typeof b !== "string" || !BRANCH.test(b) || b.includes("..")) throw new Error("nom de branche invalide"); return b; };
  const guardWrite = (path: string, branch: string) => {
    if (!safe(path) || WRITE_DENY.test(path) || READ_DENY.test(path)) throw new Error("écriture interdite sur ce chemin : " + path);
    if (!branch) throw new Error("branche requise");
    if (branch === M && !allow) throw new Error(`commit sur ${M} désactivé : crée une branche (create_branch) ou demande à l'utilisateur d'activer l'autorisation`);
  };
  const str = (d: string) => ({ type: "string", description: d });
  const obj = (properties: object, required: string[] = []) => ({ type: "object", properties, required });
  return [
    { name: "list_files", description: "Liste les fichiers du dépôt (préfixe optionnel).", parameters: obj({ prefix: str("dossier, ex. client/src/features"), ref: str("branche, défaut " + M) }),
      run: async a => { const j = await gh(env, `/repos/${R}/git/trees/${enc(a.ref || M)}?recursive=1`); const l = j.tree.filter((x: any) => x.type === "blob" && x.path.startsWith(clean(a.prefix)) && !READ_DENY.test(x.path)).map((x: any) => `${x.path} (${x.size})`); return l.slice(0, 400).join("\n") + (l.length > 400 ? `\n… ${l.length - 400} de plus : précise le préfixe` : ""); } },
    { name: "read_file", description: "Lit un fichier (12000 caractères par appel, utilise offset pour la suite).", parameters: obj({ path: str("chemin"), offset: { type: "number" }, ref: str("branche") }, ["path"]),
      run: async a => { const p = clean(a.path); if (!safe(p) || READ_DENY.test(p)) throw new Error("fichier illisible"); const j = await gh(env, `/repos/${R}/contents/${encodeURI(p)}?ref=${enc(a.ref || M)}`); if (Array.isArray(j)) return "dossier :\n" + j.map((x: any) => x.path).join("\n"); if (j.size > 400000) throw new Error("fichier trop gros"); const t = td.decode(Uint8Array.from(atob(j.content.replace(/\n/g, "")), c => c.charCodeAt(0))), o = Math.max(0, +a.offset || 0); return t.slice(o, o + 12000) + (t.length > o + 12000 ? `\n… [${t.length - o - 12000} caractères de plus : offset ${o + 12000}]` : ""); } },
    { name: "search_code", description: "Cherche du code dans le dépôt (GitHub code search).", parameters: obj({ query: str("termes") }, ["query"]),
      run: async a => (await gh(env, `/search/code?q=${enc(a.query + " repo:" + R)}&per_page=10`)).items.filter((x: any) => !READ_DENY.test(x.path)).map((x: any) => x.path).join("\n") || "aucun résultat" },
    { name: "create_branch", description: `Crée une branche à partir de ${M} (ou d'une autre).`, parameters: obj({ name: str("ex. ai/fix-footer"), from: str("branche source") }, ["name"]),
      run: async a => { if (!/^[\w./-]{1,100}$/.test(a.name) || a.name.includes("..")) throw new Error("nom de branche invalide"); const base = (await gh(env, `/repos/${R}/git/ref/heads/${enc(a.from || M)}`)).object.sha; await post(env, `/repos/${R}/git/refs`, { ref: "refs/heads/" + a.name, sha: base }); return "branche créée : " + a.name; } },
    { name: "write_file", description: `Crée ou remplace un fichier et le commit sur une branche (commit sur ${M} seulement si autorisé).`, parameters: obj({ path: str("chemin"), content: str("contenu complet du fichier"), message: str("message de commit"), branch: str("branche cible") }, ["path", "content", "message", "branch"]),
      run: async a => { const p = clean(a.path); guardWrite(p, a.branch); if (typeof a.content !== "string" || a.content.length > 300000) throw new Error("contenu absent ou > 300 Ko"); const s = await sha(env, p, a.branch); const j = await post(env, `/repos/${R}/contents/${encodeURI(p)}`, { message: "AI: " + msg(a.message), content: b64(te.encode(a.content)), branch: a.branch, ...(s ? { sha: s } : {}) }, "PUT"); return `${s ? "modifié" : "créé"} ${p} (commit ${j.commit.sha.slice(0, 7)} sur ${a.branch})`; } },
    { name: "delete_file", description: "Supprime un fichier (commit).", parameters: obj({ path: str("chemin"), message: str("message de commit"), branch: str("branche cible") }, ["path", "message", "branch"]),
      run: async a => { const p = clean(a.path); guardWrite(p, a.branch); const s = await sha(env, p, a.branch); if (!s) throw new Error("fichier introuvable"); const j = await post(env, `/repos/${R}/contents/${encodeURI(p)}`, { message: "AI: " + msg(a.message), sha: s, branch: a.branch }, "DELETE"); return `supprimé ${p} (commit ${j.commit.sha.slice(0, 7)})`; } },
    { name: "open_pr", description: "Ouvre une pull request.", parameters: obj({ title: str("titre"), body: str("description"), head: str("branche source"), base: str("branche cible") }, ["title", "head"]),
      run: async a => { const j = await post(env, `/repos/${R}/pulls`, { title: String(a.title).slice(0, 200), body: String(a.body ?? "").slice(0, 10000) + "\n\n_Ouverte par le Superassistant._", head: a.head, base: a.base || M }); return `PR #${j.number} : ${j.html_url}`; } },
    { name: "list_prs", description: "Liste les pull requests ouvertes.", parameters: obj({}),
      run: async () => (await gh(env, `/repos/${R}/pulls?state=open&per_page=20`)).map((x: any) => `#${x.number} ${x.title} (${x.head.ref} → ${x.base.ref})`).join("\n") || "aucune PR ouverte" },
    ...(allow ? [
      { name: "merge_pr", description: "Merge une pull request (autorisé par l'utilisateur).", parameters: obj({ number: { type: "number" }, method: { type: "string", enum: ["merge", "squash", "rebase"] } }, ["number"]),
        run: async (a: Record<string, any>) => { const n = Math.trunc(+a.number); if (!(n > 0)) throw new Error("numéro de PR invalide"); const j = await post(env, `/repos/${R}/pulls/${n}/merge`, { merge_method: a.method || "squash" }, "PUT"); return j.message || "mergée"; } },
      { name: "deploy", description: shell ? `Déploie ${M} depuis le conteneur : pull, pnpm install, pnpm deploy:cloudflare (peut durer plusieurs minutes).` : `Lance le déploiement (workflow GitHub Actions ${env.GITHUB_DEPLOY_WORKFLOW || "deploy.yml"} sur ${M}).`, parameters: obj({}),
        run: async () => {
          if (!shell) { await post(env, `/repos/${R}/actions/workflows/${enc(env.GITHUB_DEPLOY_WORKFLOW || "deploy.yml")}/dispatches`, { ref: M }); return "déploiement lancé (suivre avec list_runs)"; }
          if (!env.CLOUDFLARE_API_TOKEN) throw new Error("secret CLOUDFLARE_API_TOKEN manquant sur le worker");
          return run(`git checkout ${M} && git pull --ff-only && pnpm install --frozen-lockfile && pnpm deploy:cloudflare`, { env: { ...(await gitEnv()), CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN, ...(env.CLOUDFLARE_ACCOUNT_ID ? { CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID } : {}) }, timeout: 600000 });
        } },
    ] as Tool[] : []),
    ...(shell ? [
      { name: "sh", description: `Terminal Linux dans un conteneur (git, node, pnpm). Dépôt cloné dans ${DIR}. Sert à lancer tests, build, typecheck, grep, éditer des fichiers. Sans autorisation : aucun identifiant GitHub/Cloudflare dans la commande (utilise sync_branch / push_branch pour git).`, parameters: obj({ command: str("commande bash"), timeout_s: { type: "number", description: "max 600, défaut 120" } }, ["command"]),
        run: async (a: Record<string, any>) => {
          if (typeof a.command !== "string" || !a.command.trim() || a.command.length > 8000) throw new Error("commande invalide");
          const e = allow ? { ...(await gitEnv()), GH_TOKEN: await ghToken(env), ...(env.CLOUDFLARE_API_TOKEN ? { CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN } : {}), ...(env.CLOUDFLARE_ACCOUNT_ID ? { CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID } : {}) } : {};
          return run(a.command, { env: e, timeout: Math.min(600, Math.max(5, +a.timeout_s || 120)) * 1000 });
        } },
      { name: "sync_branch", description: "Récupère une branche distante dans le conteneur et la checkout (git fetch + checkout -B).", parameters: obj({ branch: str("branche") }, ["branch"]),
        run: async (a: Record<string, any>) => { const b = branchArg(a.branch); return run(`git fetch origin ${b} && git checkout -B ${b} FETCH_HEAD`, { env: await gitEnv() }); } },
      { name: "push_branch", description: `Pousse HEAD du conteneur vers une branche distante (${M} seulement si autorisé). Commit d'abord avec sh.`, parameters: obj({ branch: str("branche cible") }, ["branch"]),
        run: async (a: Record<string, any>) => { const b = branchArg(a.branch); if (b === M && !allow) throw new Error(`push sur ${M} désactivé : pousse une branche et ouvre une PR`); return run(`git push origin HEAD:refs/heads/${b}`, { env: await gitEnv() }); } },
    ] as Tool[] : []),
    ...(env.DB ? [
      { name: "query_db", description: `Interroge la base de données de production (Cloudflare D1, SQLite) en lecture seule : ventes, dons, réservations, bénévoles… Une seule instruction SELECT/WITH, ${DB_ROWS} lignes max (agrège avec SUM/COUNT/GROUP BY plutôt que lister).`, parameters: obj({ sql: str("requête SQLite SELECT") }, ["sql"]),
        run: async (a: Record<string, any>) => { const { results } = await env.DB!.prepare(readOnlySql(a.sql)).all(); return JSON.stringify(results.slice(0, DB_ROWS)) + (results.length > DB_ROWS ? `\n… ${results.length - DB_ROWS} lignes de plus : agrège ou filtre` : ""); } },
    ] as Tool[] : []),
    { name: "list_runs", description: "Derniers runs GitHub Actions (CI / déploiement).", parameters: obj({}),
      run: async () => (await gh(env, `/repos/${R}/actions/runs?per_page=6`)).workflow_runs.map((x: any) => `${x.name} · ${x.head_branch} · ${x.status}/${x.conclusion ?? "-"} · ${x.html_url}`).join("\n") || "aucun run" },
  ];
}
