"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { post } from "./api";

/**
 * **Notifications on this phone.** Real push where the phone allows it — on
 * iPhone that means CourtQueue added to the Home Screen and opened from
 * there (iOS 16.4+) — and the app's own sound, vibration and banner always.
 * The courts never depend on a push arriving: every phone polls.
 */

export type PushState =
  "unsupported" | "needs-home-screen" | "off" | "denied" | "on" | "busy";

export interface Alerts {
  readonly state: PushState;
  readonly enable: () => Promise<void>;
  readonly disable: () => Promise<void>;
  readonly test: () => Promise<void>;
  /** A system notification while the app is in the background. */
  readonly notify: (title: string, body: string) => void;
}

const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const standalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

function keyBytes(b64u: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64u.length % 4)) % 4);
  const raw = atob((b64u + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function useAlerts(signedIn: string | null): Alerts {
  const [state, setState] = useState<PushState>("unsupported");
  const reg = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let gone = false;
    navigator.serviceWorker
      .register("/badminton/sw.js", { scope: "/badminton" })
      .then(async (r) => {
        reg.current = r;
        if (gone) return;
        const pushable = "PushManager" in window && "Notification" in window;
        if (!pushable) {
          setState(
            isIos() && !standalone() ? "needs-home-screen" : "unsupported",
          );
          return;
        }
        if (Notification.permission === "denied") return setState("denied");
        const sub = await r.pushManager.getSubscription();
        if (sub && Notification.permission === "granted" && signedIn) {
          // Keep the server's copy current: a new sign-in on this phone moves
          // the subscription to whoever is signed in now.
          await post("/api/badminton/push", {
            action: "subscribe",
            subscription: sub.toJSON(),
          });
          setState("on");
        } else setState("off");
      })
      .catch(() => {});
    return () => {
      gone = true;
    };
  }, [signedIn]);

  const enable = useCallback(async () => {
    const r = reg.current;
    if (!r) return;
    setState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const { publicKey } = await fetch("/api/badminton/push").then((x) =>
        x.json(),
      );
      if (!publicKey) {
        setState("unsupported");
        return;
      }
      const sub =
        (await r.pushManager.getSubscription()) ??
        (await r.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(publicKey),
        }));
      const out = await post("/api/badminton/push", {
        action: "subscribe",
        subscription: sub.toJSON(),
      });
      setState(out.ok ? "on" : "off");
    } catch {
      setState("off");
    }
  }, []);

  const disable = useCallback(async () => {
    const sub = await reg.current?.pushManager.getSubscription();
    if (sub) {
      await post("/api/badminton/push", {
        action: "unsubscribe",
        endpoint: sub.endpoint,
      });
      await sub.unsubscribe().catch(() => {});
    }
    setState("off");
  }, []);

  const test = useCallback(async () => {
    await post("/api/badminton/push", { action: "test" });
  }, []);

  const notify = useCallback((title: string, body: string) => {
    if (
      typeof Notification === "undefined" ||
      Notification.permission !== "granted" ||
      document.visibilityState === "visible"
    )
      return;
    void reg.current?.showNotification(title, {
      body,
      tag: "courtqueue-up",
      icon: "/badminton/app-icon/192",
    });
  }, []);

  return { state, enable, disable, test, notify };
}
