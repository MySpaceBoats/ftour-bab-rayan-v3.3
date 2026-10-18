/** Jitsi as a Service (8x8.vc): jeton JWT RS256 par participant, signé avec WebCrypto. Repli sur meet.jit.si sans secrets. */
export interface JaasEnv { JAAS_APP_ID?: string; JAAS_KEY_ID?: string; JAAS_PRIVATE_KEY?: string }
export interface JitsiOpts { room: string; name: string; userId: number; moderator: boolean; nowMs: number }

const TOKEN_TTL_S = 2 * 3600;
const b64u = (v: ArrayBuffer | string) => Buffer.from(typeof v === "string" ? v : new Uint8Array(v)).toString("base64url");

/** Clé PKCS#8 PEM (le .pk de la console JaaS) ; accepte aussi les "\n" littéraux d'un secret sur une ligne. */
async function importKey(pem: string): Promise<CryptoKey> {
  const der = Buffer.from(pem.replaceAll("\\n", "\n").replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""), "base64");
  return crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

export async function signJaasToken(env: JaasEnv, o: JitsiOpts): Promise<string> {
  const now = Math.floor(o.nowMs / 1000);
  const head = b64u(JSON.stringify({ alg: "RS256", kid: env.JAAS_KEY_ID, typ: "JWT" }));
  const body = b64u(JSON.stringify({
    aud: "jitsi", iss: "chat", sub: env.JAAS_APP_ID, room: o.room, nbf: now - 10, exp: now + TOKEN_TTL_S,
    context: {
      user: { id: String(o.userId), name: o.name, moderator: o.moderator },
      features: { recording: "false", livestreaming: "false", transcription: "false", "outbound-call": "false" },
    },
  }));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", await importKey(env.JAAS_PRIVATE_KEY!), new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64u(sig)}`;
}

/** URL de l'iframe : JaaS si les 3 secrets sont posés, sinon le serveur public (limité en embarquement). */
export async function jitsiUrl(env: JaasEnv, o: JitsiOpts): Promise<{ url: string; provider: "jaas" | "public" }> {
  if (env.JAAS_APP_ID && env.JAAS_KEY_ID && env.JAAS_PRIVATE_KEY) {
    try {
      const jwt = await signJaasToken(env, o);
      return { url: `https://8x8.vc/${env.JAAS_APP_ID}/${o.room}?jwt=${jwt}#config.prejoinPageEnabled=false`, provider: "jaas" };
    } catch (e) {
      // ponytail: clé illisible = repli public plutôt qu'une visio cassée ; l'erreur reste dans les logs
      console.error("[jaas] signature impossible", e);
    }
  }
  return { url: `https://meet.jit.si/${o.room}#userInfo.displayName=${encodeURIComponent(JSON.stringify(o.name))}&config.prejoinPageEnabled=false`, provider: "public" };
}
