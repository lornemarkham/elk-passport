"use client";

/**
 * **One random token per browser**, so a person with no account is
 * recognised on this device: their suggestions are counted together and a
 * household behind one connection isn't one person. The lights map's form
 * keeps the same kind of token under `xmas-lights-device`; this adopts it
 * when it is already there, so one phone's lights pins and suggestions add
 * up to one count. Never shown; sent only to Passport's own API, which hashes
 * it with a server key before anything is stored.
 */
const KEY = "passport.contributor.device";
const LIGHTS_KEY = "xmas-lights-device";

export function deviceToken(): string {
  try {
    let d = localStorage.getItem(KEY);
    if (!d) {
      d = localStorage.getItem(LIGHTS_KEY);
      if (!d || !/^[A-Za-z0-9_-]{8,64}$/.test(d))
        d = crypto.randomUUID().replace(/-/g, "");
      localStorage.setItem(KEY, d);
      // The lights form reads its own key; give it the same token so the two
      // queues see one person.
      if (!localStorage.getItem(LIGHTS_KEY))
        localStorage.setItem(LIGHTS_KEY, d);
    }
    return d;
  } catch {
    return "";
  }
}
