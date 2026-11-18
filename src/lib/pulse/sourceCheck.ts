import { lookup as dnsLookup } from "node:dns";
import https from "node:https";
import { isIP } from "node:net";

/**
 * **Looking at a claim's source without inventing anything.**
 *
 * A creator names a published statistic and links to where it came from.
 * This reads that one page and reports only what the page itself says:
 * its title, publisher, a publication date it declares, and the sentences
 * (copied word for word) that contain the figure and that describe how it
 * was gathered. It never searches for a source, never guesses one, and
 * never says whether a claim is true. If the page does not say, the answer
 * is "not found", not a best guess.
 *
 * Fetching a stranger's link from a server is the risky part: the address is
 * checked when the connection is made (so a name that resolves to a private
 * address is refused), redirects are followed by hand and re-checked, and
 * the page is capped in time and size.
 */

export interface SourceCheck {
  readonly url: string;
  readonly title: string | null;
  readonly site: string;
  /** A date the page declares for itself, as YYYY-MM-DD. */
  readonly published: string | null;
  /** Whether the claimed figure appears in the page's own text. */
  readonly statFound: boolean | null;
  readonly statExcerpts: readonly string[];
  readonly methodExcerpts: readonly string[];
}

export type SourceCheckResult =
  | { readonly ok: true; readonly check: SourceCheck }
  | { readonly ok: false; readonly reason: string };

// ── Which addresses a server may be sent to ─────────────────────────────────

export function isPublicAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b, c] = ip.split(".").map(Number) as [number, number, number];
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 192 && b === 0 && c === 0) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    return true;
  }
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    if (mapped) return isPublicAddress(mapped[1]!);
    if (v === "::" || v === "::1") return false;
    if (/^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith("ff"))
      return false;
    if (v.startsWith("64:ff9b") || v.startsWith("2001:db8")) return false;
    return true;
  }
  return false;
}

/** `dns.lookup` that refuses to hand back anything but public addresses. */
const publicOnlyLookup: NonNullable<https.RequestOptions["lookup"]> = (
  host,
  options,
  callback,
) => {
  dnsLookup(host, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = addresses as { address: string; family: number }[];
    if (list.length === 0 || list.some((a) => !isPublicAddress(a.address)))
      return callback(new Error("not a public address"), "", 0);
    if ((options as { all?: boolean }).all)
      return (callback as unknown as (e: null, a: unknown) => void)(null, list);
    callback(null, list[0]!.address, list[0]!.family);
  });
};

export function checkableUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.port || url.username || url.password)
    return null;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) || !host.includes(".") || host.endsWith(".local")) return null;
  if (host === "localhost" || host.endsWith(".localhost")) return null;
  return url;
}

const MAX_BYTES = 900_000;
const TIMEOUT_MS = 7_000;
const MAX_HOPS = 3;

function fetchOnce(
  url: URL,
): Promise<
  | { status: number; type: string; location: string | null; body: string }
  | "failed"
> {
  return new Promise((resolve) => {
    const req = https.request(
      url,
      {
        method: "GET",
        lookup: publicOnlyLookup,
        timeout: TIMEOUT_MS,
        headers: {
          "user-agent": "PeoplesPulseSourceCheck/1 (+https://passport.elk)",
          accept: "text/html,application/xhtml+xml,text/plain;q=0.8",
          "accept-encoding": "identity",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const type = String(res.headers["content-type"] ?? "").toLowerCase();
        const location = (res.headers.location as string | undefined) ?? null;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, type, location, body: "" });
        }
        if (!/text\/html|text\/plain|application\/xhtml/.test(type)) {
          res.resume();
          return resolve({ status, type, location, body: "" });
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > MAX_BYTES) return res.destroy();
          chunks.push(c);
        });
        const done = () =>
          resolve({
            status,
            type,
            location,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        res.on("end", done);
        res.on("close", done);
        res.on("error", () => resolve("failed"));
      },
    );
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve("failed"));
    req.end();
  });
}

// ── Reading a page ──────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
};

const decode = (s: string) =>
  s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code =
        e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : +e.slice(1);
      return Number.isFinite(code) && code > 0 && code < 0x10ffff
        ? String.fromCodePoint(code)
        : " ";
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

const meta = (html: string, names: readonly string[]): string | null => {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = /(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i.exec(
      tag,
    )?.[1];
    if (!key || !names.includes(key.toLowerCase())) continue;
    const content = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (content?.trim()) return decode(content.trim());
  }
  return null;
};

/** A date the page declares, as YYYY-MM-DD, or null. Never today's date. */
function declaredDate(html: string, now: Date): string | null {
  const candidates = [
    meta(html, [
      "article:published_time",
      "og:article:published_time",
      "datepublished",
      "date",
      "pubdate",
      "publishdate",
      "dc.date.issued",
      "dc.date",
      "citation_publication_date",
      "citation_date",
    ]),
    /"datePublished"\s*:\s*"([^"]+)"/.exec(html)?.[1] ?? null,
    /<time\b[^>]*datetime\s*=\s*["']([^"']+)["']/i.exec(html)?.[1] ?? null,
  ];
  for (const c of candidates) {
    if (!c) continue;
    const m = /^(\d{4})[-/](\d{2})[-/](\d{2})/.exec(c.trim());
    const text = m ? `${m[1]}-${m[2]}-${m[3]}` : null;
    if (!text) continue;
    const t = new Date(`${text}T12:00:00Z`);
    if (
      !Number.isNaN(t.getTime()) &&
      t.toISOString().startsWith(text) &&
      t.getUTCFullYear() >= 1990 &&
      t.getTime() <= now.getTime() + 86_400_000
    )
      return text;
  }
  return null;
}

const METHOD =
  /\b(margin of error|sample of|sampled|respondents|surveyed|interviewed|polled|online panel|telephone|conducted (?:between|from|on)|fieldwork|weighted|randomly selected|confidence level|questionnaire)\b/i;

const sentences = (text: string) =>
  text
    .split(/(?<=[.!?])\s+(?=[A-Z“"(])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 25);

const clip = (s: string) => (s.length > 300 ? `${s.slice(0, 297)}…` : s);

/** The sentences that state `percent`: "65%", "65 per cent", "65.0 percent". */
function statPattern(percent: number): RegExp {
  const num = Number.isInteger(percent)
    ? `${percent}(?:\\.0)?`
    : String(percent).replace(".", "\\.");
  return new RegExp(`(?<![\\d.])${num}\\s?(?:%|per\\s?cent|percent)`, "i");
}

export function readSource(
  html: string,
  url: URL,
  percent: number | null,
  now: Date,
): SourceCheck {
  const title =
    meta(html, ["og:title", "twitter:title"]) ??
    (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]
      ? decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)![1]!)
          .replace(/\s+/g, " ")
          .trim()
      : null);
  const body = html
    .replace(/<(script|style|noscript|svg|head)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  const text = decode(body).replace(/\s+/g, " ").trim();
  const all = sentences(text);
  const statExcerpts =
    percent === null
      ? []
      : all
          .filter((s) => statPattern(percent).test(s))
          .slice(0, 3)
          .map(clip);
  return {
    url: url.toString(),
    title: title ? title.slice(0, 200) : null,
    site:
      meta(html, ["og:site_name", "application-name"]) ??
      url.hostname.replace(/^www\./, ""),
    published: declaredDate(html, now),
    statFound: percent === null ? null : statExcerpts.length > 0,
    statExcerpts,
    methodExcerpts: all
      .filter((s) => METHOD.test(s))
      .slice(0, 3)
      .map(clip),
  };
}

/** Fetch the page at `raw` and read it. Every failure is a plain sentence. */
export async function checkSource(
  raw: string,
  percent: number | null,
  now: Date,
): Promise<SourceCheckResult> {
  let url = checkableUrl(raw);
  if (!url)
    return {
      ok: false,
      reason: "That needs to be an https:// link to a public web page.",
    };
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const res = await fetchOnce(url);
    if (res === "failed")
      return {
        ok: false,
        reason:
          "Couldn't open that page from here. You can still fill the details in yourself.",
      };
    if (res.status >= 300 && res.status < 400 && res.location) {
      const next = checkableUrl(new URL(res.location, url).toString());
      if (!next)
        return {
          ok: false,
          reason: "That link redirects somewhere we can't open.",
        };
      url = next;
      continue;
    }
    if (res.status < 200 || res.status >= 300)
      return { ok: false, reason: `That page answered ${res.status}.` };
    if (!res.body)
      return {
        ok: false,
        reason: res.type.includes("pdf")
          ? "That is a PDF, which can't be read here. Open it and fill the details in yourself."
          : "That page isn't plain text we can read.",
      };
    return { ok: true, check: readSource(res.body, url, percent, now) };
  }
  return { ok: false, reason: "That link redirects too many times." };
}

// ── Optional AI help ────────────────────────────────────────────────────────

export interface AiNotes {
  readonly measures: string | null;
  readonly method: string | null;
}

export type Complete = (system: string, user: string) => Promise<string>;

const SYSTEM =
  'You help someone describe a published statistic. You are given a claim and sentences copied from the page it came from. Using ONLY those sentences, say in one plain sentence each (a) what the figure measures and (b) how the data was gathered. If the sentences do not say, answer exactly "not stated" for that part. Never add facts, never guess a source, date or sample size, never judge whether the claim is true. Reply as JSON: {"measures": string, "method": string}.';

/**
 * Optionally ask a language model to put the page's own sentences into plain
 * words. It sees only the claim and the copied sentences, and whatever it
 * says is shown as AI wording to be checked, never as a finding.
 */
export async function explainWithAi(
  claim: string,
  check: Pick<SourceCheck, "statExcerpts" | "methodExcerpts">,
  complete: Complete,
): Promise<AiNotes | null> {
  const excerpts = [...check.statExcerpts, ...check.methodExcerpts];
  if (excerpts.length === 0) return null;
  const reply = await complete(
    SYSTEM,
    `Claim: ${claim}\n\nSentences from the page:\n${excerpts.map((e) => `- ${e}`).join("\n")}`,
  );
  try {
    const parsed = JSON.parse(reply.replace(/^```(?:json)?|```$/g, "").trim());
    const part = (v: unknown) =>
      typeof v === "string" && v.trim() && !/^not stated\.?$/i.test(v.trim())
        ? v.trim().slice(0, 240)
        : null;
    const notes = {
      measures: part(parsed.measures),
      method: part(parsed.method),
    };
    return notes.measures || notes.method ? notes : null;
  } catch {
    return null;
  }
}

export const aiConfigured = () => !!process.env.OPENAI_API_KEY;

/** The OpenAI call Passport already uses elsewhere (insiders); off without its key. */
export async function openAiComplete(
  system: string,
  user: string,
): Promise<string> {
  const { default: OpenAI } = await import("openai");
  const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const r = await ai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    max_tokens: 300,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return r.choices[0]?.message.content ?? "";
}
