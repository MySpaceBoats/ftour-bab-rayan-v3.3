import { describe, expect, it } from "vitest";
import { jitsiUrl, signJaasToken, type JaasEnv } from "./jaas";

const APP = "vpaas-magic-cookie-test";
const KID = `${APP}/abc123`;
const NOW = Date.parse("2026-10-18T12:00:00.000Z");
const dec = (s: string) => JSON.parse(Buffer.from(s, "base64url").toString());

async function keypair() {
  const k = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const der = Buffer.from(await crypto.subtle.exportKey("pkcs8", k.privateKey)).toString("base64");
  const pem = `-----BEGIN PRIVATE KEY-----\n${der.match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----`;
  return { pem, pub: k.publicKey };
}
const base = { room: "babrayan-abcdef0123456789", name: "Amina B.", userId: 7, moderator: false, nowMs: NOW };

describe("jaas token", () => {
  it("signs a verifiable RS256 JWT with the JaaS claims", async () => {
    const { pem, pub } = await keypair();
    const jwt = await signJaasToken({ JAAS_APP_ID: APP, JAAS_KEY_ID: KID, JAAS_PRIVATE_KEY: pem }, { ...base, moderator: true });
    const [h, p, s] = jwt.split(".");
    expect(dec(h)).toEqual({ alg: "RS256", kid: KID, typ: "JWT" });
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", pub, Buffer.from(s, "base64url"), new TextEncoder().encode(`${h}.${p}`));
    expect(ok).toBe(true);
    const c = dec(p);
    expect(c).toMatchObject({ aud: "jitsi", iss: "chat", sub: APP, room: base.room });
    expect(c.exp - c.nbf).toBeGreaterThan(2 * 3600 - 60);
    expect(c.exp).toBeLessThanOrEqual(Math.floor(NOW / 1000) + 2 * 3600);
    expect(c.context.user).toMatchObject({ id: "7", name: "Amina B.", moderator: true });
    expect(c.context.features).toMatchObject({ recording: "false", livestreaming: "false" });
  });

  it("accepts a key stored with literal \\n escapes", async () => {
    const { pem } = await keypair();
    const jwt = await signJaasToken({ JAAS_APP_ID: APP, JAAS_KEY_ID: KID, JAAS_PRIVATE_KEY: pem.replaceAll("\n", "\\n") }, base);
    expect(jwt.split(".")).toHaveLength(3);
  });
});

describe("jitsiUrl", () => {
  it("uses JaaS with the jwt when the three secrets are set", async () => {
    const { pem } = await keypair();
    const r = await jitsiUrl({ JAAS_APP_ID: APP, JAAS_KEY_ID: KID, JAAS_PRIVATE_KEY: pem }, base);
    expect(r.provider).toBe("jaas");
    expect(r.url.startsWith(`https://8x8.vc/${APP}/${base.room}?jwt=`)).toBe(true);
    expect(r.url).toContain("#config.prejoinPageEnabled=false");
  });

  it("falls back to the public server when a secret is missing", async () => {
    for (const env of [{}, { JAAS_APP_ID: APP }, { JAAS_APP_ID: APP, JAAS_KEY_ID: KID }] as JaasEnv[]) {
      const r = await jitsiUrl(env, base);
      expect(r.provider).toBe("public");
      expect(r.url.startsWith(`https://meet.jit.si/${base.room}#userInfo.displayName=`)).toBe(true);
      expect(decodeURIComponent(r.url)).toContain('"Amina B."');
    }
  });

  it("falls back (and does not throw) when the private key is unusable", async () => {
    const r = await jitsiUrl({ JAAS_APP_ID: APP, JAAS_KEY_ID: KID, JAAS_PRIVATE_KEY: "pas une clé" }, base);
    expect(r.provider).toBe("public");
  });
});
