import {
  createCipheriv,
  createECDH,
  createHmac,
  createPrivateKey,
  randomBytes,
  sign,
  type ECDH,
} from "node:crypto";

/**
 * **Standards Web Push, with nothing but `node:crypto`.** RFC 8030 delivery,
 * RFC 8291 payload encryption (`aes128gcm`, RFC 8188) and RFC 8292 VAPID.
 * Works with Apple's (iPhone Home Screen apps, iOS 16.4+), Google's and
 * Mozilla's push services. No package: this repository's lockfile can't be
 * regenerated where CourtQueue is built.
 *
 * The VAPID key pair is derived from a seed (the CourtQueue server key, see
 * `push.ts`), so it is the same on every server and needs no new secret.
 */

export interface PushSubscriptionJSON {
  readonly endpoint: string;
  readonly keys: { readonly p256dh: string; readonly auth: string };
}

export interface Vapid {
  /** Uncompressed P-256 point, base64url: what a browser subscribes with. */
  readonly publicKey: string;
  readonly sign: (data: Buffer) => Buffer;
}

const b64u = (b: Buffer) => b.toString("base64url");
const unb64u = (s: string) => Buffer.from(s, "base64url");

const N = BigInt(
  "0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551",
);

/** A P-256 key pair from a seed: the same seed, the same keys, everywhere. */
export function vapidFromSeed(seed: string): Vapid {
  let d: Buffer | null = null;
  for (let i = 0; !d; i++) {
    const h = createHmac("sha256", seed)
      .update(`courtqueue-vapid-v1:${i}`)
      .digest();
    const n = BigInt(`0x${h.toString("hex")}`);
    if (n > BigInt(0) && n < N) d = h;
  }
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(d);
  const pub = ecdh.getPublicKey();
  const key = createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      d: b64u(d),
      x: b64u(pub.subarray(1, 33)),
      y: b64u(pub.subarray(33, 65)),
    },
    format: "jwk",
  });
  return {
    publicKey: b64u(pub),
    sign: (data) => sign("sha256", data, { key, dsaEncoding: "ieee-p1363" }),
  };
}

/** The VAPID `Authorization` header for one push service. */
export function vapidAuthorization(
  vapid: Vapid,
  endpoint: string,
  subject: string,
  now = Date.now(),
): string {
  const aud = new URL(endpoint).origin;
  const header = b64u(
    Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })),
  );
  const claims = b64u(
    Buffer.from(
      JSON.stringify({
        aud,
        exp: Math.floor(now / 1000) + 12 * 3600,
        sub: subject,
      }),
    ),
  );
  const unsigned = `${header}.${claims}`;
  const sig = b64u(vapid.sign(Buffer.from(unsigned)));
  return `vapid t=${unsigned}.${sig}, k=${vapid.publicKey}`;
}

const hmac = (key: Buffer, data: Buffer) =>
  createHmac("sha256", key).update(data).digest();

/**
 * Encrypt a payload for one browser (RFC 8291 §3.4, one `aes128gcm` record).
 * `salt` and `ephemeral` are for tests; normally fresh every message.
 */
export function encryptPayload(
  sub: PushSubscriptionJSON,
  payload: Buffer,
  salt: Buffer = randomBytes(16),
  ephemeral?: ECDH,
): Buffer {
  const uaPublic = unb64u(sub.keys.p256dh);
  const authSecret = unb64u(sub.keys.auth);
  if (uaPublic.length !== 65 || authSecret.length < 16)
    throw new Error("bad subscription keys");
  if (!ephemeral) {
    ephemeral = createECDH("prime256v1");
    ephemeral.generateKeys();
  }
  const asPublic = ephemeral.getPublicKey();
  const shared = ephemeral.computeSecret(uaPublic);
  const prkKey = hmac(authSecret, shared);
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0"),
    uaPublic,
    asPublic,
  ]);
  const ikm = hmac(prkKey, Buffer.concat([keyInfo, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(
    prk,
    Buffer.from("Content-Encoding: aes128gcm\0\x01", "binary"),
  ).subarray(0, 16);
  const nonce = hmac(
    prk,
    Buffer.from("Content-Encoding: nonce\0\x01", "binary"),
  ).subarray(0, 12);
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([
    cipher.update(Buffer.concat([payload, Buffer.from([2])])),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([
    salt,
    rs,
    Buffer.from([asPublic.length]),
    asPublic,
    body,
  ]);
}

/**
 * Push services CourtQueue will talk to. A subscription naming any other host
 * is refused, so the server can't be pointed at an arbitrary URL.
 */
const PUSH_HOSTS = [
  /^web\.push\.apple\.com$/,
  /(^|\.)push\.apple\.com$/,
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/,
  /(^|\.)notify\.windows\.com$/,
];

export function validSubscription(x: unknown): x is PushSubscriptionJSON {
  if (!x || typeof x !== "object") return false;
  const s = x as Partial<PushSubscriptionJSON>;
  if (typeof s.endpoint !== "string" || s.endpoint.length > 1000) return false;
  let url: URL;
  try {
    url = new URL(s.endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port) return false;
  if (!PUSH_HOSTS.some((h) => h.test(url.hostname))) return false;
  const k = s.keys;
  if (!k || typeof k.p256dh !== "string" || typeof k.auth !== "string")
    return false;
  try {
    return unb64u(k.p256dh).length === 65 && unb64u(k.auth).length >= 16;
  } catch {
    return false;
  }
}

export type SendResult = "sent" | "gone" | "failed";

/** Deliver one message. "gone" means the browser unsubscribed: forget it. */
export async function sendPush(
  vapid: Vapid,
  subject: string,
  sub: PushSubscriptionJSON,
  message: object,
  opts: {
    ttlSeconds?: number;
    urgency?: "normal" | "high";
    topic?: string;
  } = {},
  fetcher: typeof fetch = fetch,
): Promise<SendResult> {
  const body = encryptPayload(sub, Buffer.from(JSON.stringify(message)));
  try {
    const res = await fetcher(sub.endpoint, {
      method: "POST",
      headers: {
        Authorization: vapidAuthorization(vapid, sub.endpoint, subject),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(opts.ttlSeconds ?? 600),
        Urgency: opts.urgency ?? "high",
        ...(opts.topic ? { Topic: opts.topic.slice(0, 32) } : {}),
      },
      body: new Uint8Array(body),
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status === 404 || res.status === 410) return "gone";
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
