"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** The join code, drawn in the browser so it is right for whatever host this is. */
export function Qr({
  path = "/fairview3",
  size = 240,
}: {
  path?: string;
  size?: number;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  useEffect(() => {
    const full = `${window.location.origin}${path}`;
    QRCode.toDataURL(full, {
      margin: 1,
      width: size * 2,
      errorCorrectionLevel: "M",
      color: { dark: "#06041a", light: "#ffffff" },
    })
      .then((data) => {
        setSrc(data);
        setUrl(full.replace(/^https?:\/\//, ""));
      })
      .catch(() => {
        setSrc(null);
        setUrl(full.replace(/^https?:\/\//, ""));
      });
  }, [path, size]);
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="rounded-3xl bg-white p-3 shadow-[0_0_60px_rgba(34,227,255,0.45)]"
        style={{ width: size + 24, height: size + 24 }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={`QR code for ${url}`}
            width={size}
            height={size}
          />
        ) : (
          <div className="h-full w-full rounded-2xl bg-slate-200" />
        )}
      </div>
      <div className="fv3-display-tight text-xl text-white/90 md:text-2xl">
        {url}
      </div>
    </div>
  );
}
