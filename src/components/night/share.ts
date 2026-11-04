/**
 * **Send it.** Date Night has no chat: the two of you have one already.
 * Passport hands the words and the link to the phone's own share sheet
 * (Messages, WhatsApp, whatever you use); where there isn't one, it opens a
 * new text on a phone, and copies on a computer. The link always opens the
 * exact thing it's about.
 *
 * Nothing here can know a message was *sent*: the person still taps send
 * in their own app. So the outcomes say what Passport did, not what they
 * did, and the words shown afterwards never claim it went.
 *
 * Call `sendText` **straight from the tap**, with the link already made:
 * the share sheet needs the tap's user activation, which a network round
 * trip before it can use up (Safari's lasts about a second).
 */

export type Sent = "shared" | "sms" | "copied" | "cancelled" | "failed";

/** The body of a new text, for `sms:` (iOS and Android both read `?&body=`). */
export const smsHref = (message: string): string =>
  `sms:?&body=${encodeURIComponent(message)}`;

/** The message: the words, then the link on its own line. */
export const messageOf = (text: string, url: string): string =>
  `${text}\n${url}`;

const onPhone = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(pointer: coarse)").matches === true;

export async function copy(message: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(message);
    return true;
  } catch {
    return false;
  }
}

export async function sendText(text: string, url: string): Promise<Sent> {
  const message = messageOf(text, url);
  // The copy starts in the same tick as the share sheet, so both have the
  // tap behind them; if the sheet is dismissed, the message is still in hand.
  const copying = copy(message);
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      // One string, link included: some apps drop `text` when `url` is set.
      await navigator.share({ text: message });
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError")
        return (await copying) ? "copied" : "cancelled";
      // Not allowed here (no activation left): fall through.
    }
  }
  if (onPhone()) {
    window.location.href = smsHref(message);
    return "sms";
  }
  return (await copying) ? "copied" : "failed";
}

/**
 * What to say after `sendText`, never claiming it was sent. `null`: say
 * nothing (the share sheet or the texts app is in front of them).
 */
export function afterSend(sent: Sent, to: string): string | null {
  switch (sent) {
    case "copied":
      return `Link copied. Paste it into a message to ${to}.`;
    case "failed":
      return "Couldn't open your messages or copy. Press and hold the link to copy it.";
    default:
      return null;
  }
}
