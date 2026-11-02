/**
 * **Text it.** Date Night has no chat: the two of you have one already.
 * Passport hands the words and the link to the phone's own share sheet
 * (Messages, WhatsApp, whatever you use); where there isn't one, it opens a
 * new text on a phone, and copies on a computer. The link always opens the
 * exact thing it's about.
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
  // Copied first, always (as the invitation has done since mission 495): if
  // the sheet is dismissed or missing, the message is still in hand.
  const copied = await copy(message);
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      // One string, link included: some apps drop `text` when `url` is set.
      await navigator.share({ text: message });
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError")
        return copied ? "copied" : "cancelled";
      // Not allowed here (no gesture left after a save): fall through.
    }
  }
  if (onPhone()) {
    window.location.href = smsHref(message);
    return "sms";
  }
  return copied ? "copied" : "failed";
}
