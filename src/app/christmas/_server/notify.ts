import "server-only";

/**
 * **Tell the administrator** when something needs them: a new display in the
 * queue, or a removal request that has just hidden a listing.
 *
 * Passport had no outbound email, so this is the smallest real seam: one
 * HTTPS call to Resend (`RESEND_API_KEY`). Nothing here can fail a
 * submission or a removal request — the listing is already safely stored
 * when this runs, and a send that fails or isn't configured is said in the
 * server log and in the dashboard banner (`mailStatus`), never to the
 * person who submitted.
 *
 * Configuration (all server-only):
 *
 * - `RESEND_API_KEY` — the key. Without it nothing is sent.
 * - `CHRISTMAS_MAIL_FROM` — a sender on a domain verified in Resend
 *   (`Passport <christmas@yourdomain>`). Resend's own
 *   `onboarding@resend.dev` works for trying it, to the account owner only.
 * - `CHRISTMAS_NOTIFY_EMAIL` — who is told; defaults to the first address in
 *   `ADMIN_EMAILS`.
 * - `RESEND_API_URL` — tests only, to point at a local stand-in.
 *
 * What is sent: the kind of event, the display's name and town, and a link
 * to the dashboard. Never the submitter, never a photo, never a requester's
 * contact — the administrator reads those behind the sign-in.
 */

export interface Mail {
  readonly subject: string;
  readonly text: string;
}

export type MailResult =
  { readonly sent: true } | { readonly sent: false; readonly why: string };

export function notifyTo(): string | null {
  const direct = process.env.CHRISTMAS_NOTIFY_EMAIL?.trim();
  if (direct) return direct;
  const first = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .find(Boolean);
  return first ?? null;
}

/** For the dashboard: is email on, and to whom (the address is the administrator's own). */
export function mailStatus(): { on: boolean; to: string | null; why?: string } {
  const to = notifyTo();
  if (!process.env.RESEND_API_KEY)
    return { on: false, to, why: "RESEND_API_KEY is not set" };
  if (!process.env.CHRISTMAS_MAIL_FROM)
    return { on: false, to, why: "CHRISTMAS_MAIL_FROM is not set" };
  if (!to)
    return { on: false, to, why: "no CHRISTMAS_NOTIFY_EMAIL or ADMIN_EMAILS" };
  return { on: true, to };
}

export async function sendToAdmin(mail: Mail): Promise<MailResult> {
  const status = mailStatus();
  if (!status.on || !status.to) {
    console.warn(`[christmas-lights] email not sent: ${status.why}`);
    return { sent: false, why: status.why ?? "not configured" };
  }
  try {
    const r = await fetch(
      process.env.RESEND_API_URL ?? "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.CHRISTMAS_MAIL_FROM,
          to: [status.to],
          subject: mail.subject,
          text: mail.text,
        }),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!r.ok) {
      const why = `mail service answered ${r.status}`;
      console.error(`[christmas-lights] email failed: ${why}`);
      return { sent: false, why };
    }
    return { sent: true };
  } catch (error) {
    const why = error instanceof Error ? error.message : "send failed";
    console.error(`[christmas-lights] email failed: ${why}`);
    return { sent: false, why };
  }
}

/** The dashboard's own address, from the request's origin so it works on any host. */
export const dashboardUrl = (
  request: Request,
  path = "/christmas/lights/review",
) => `${new URL(request.url).origin}${path}`;

/** A community suggestion, from any experience (mission 1005), is waiting in the shared queue. */
export const newSuggestionMail = (
  name: string,
  category: string,
  experience: string,
  link: string,
): Mail => ({
  subject: `New suggestion: ${name}`,
  text: [
    `Someone suggested something through Passport (${experience}).`,
    ``,
    `${name} — ${category}`,
    ``,
    `Nothing is public until you approve it. Review it (works on your phone):`,
    link,
  ].join("\n"),
});

export const newSubmissionMail = (
  name: string,
  town: string,
  hasPhoto: boolean,
  link: string,
): Mail => ({
  subject: `New Christmas lights submission: ${name}`,
  text: [
    `A new display is waiting for your review.`,
    ``,
    `${name} — ${town}${hasPhoto ? " (with a photo)" : ""}`,
    ``,
    `Nothing is public until you approve it. Review it (works on your phone):`,
    link,
  ].join("\n"),
});

export const removalMail = (
  name: string,
  town: string,
  link: string,
): Mail => ({
  subject: `REMOVAL REQUEST — hidden now: ${name}`,
  text: [
    `Someone asked for a Christmas lights listing to be removed. It has been hidden from the public map immediately.`,
    ``,
    `${name} — ${town}`,
    ``,
    `Review the request, then remove it permanently or restore it:`,
    link,
  ].join("\n"),
});
