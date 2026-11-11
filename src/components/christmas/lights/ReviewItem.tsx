"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  KIND_LABEL,
  TOWN_LABEL,
  type PinView,
  photoSrc,
} from "@/domain/christmas/lights/model";
import { send } from "./api";

const CLAIM: Record<
  NonNullable<NonNullable<PinView["review"]>["consentClaim"]>,
  string
> = {
  "i-live-here": "Submitter says it's their home and they're happy to share it",
  "owner-said-yes": "Submitter says the owner told them they'd love visitors",
  "public-listing": "Submitter says it's publicly listed",
};

/**
 * One pin for a reviewer. A home is published only with the permission the
 * reviewer records here — the submitter's word is shown, but it is the
 * reviewer who says on what basis.
 */
export function ReviewItem({ pin }: { readonly pin: PinView }) {
  const router = useRouter();
  const [basis, setBasis] = useState<"owner-consent" | "public-listing" | "">(
    pin.review?.consentClaim === "public-listing" ? "public-listing" : "",
  );
  const [url, setUrl] = useState(pin.review?.consentUrl ?? "");
  const [say, setSay] = useState<string | null>(null);
  async function act(action: string, extra: Record<string, unknown> = {}) {
    const r = await send(`/christmas/api/lights/${pin.id}`, {
      action,
      ...extra,
    });
    if (r.ok) router.refresh();
    else setSay(r.error ?? "That didn't work.");
  }
  const src = photoSrc(pin);
  const reports = pin.review?.trail.filter((e) => e.kind === "report") ?? [];
  return (
    <li
      className="rounded-[24px] bg-white p-5 text-[#082319]"
      data-testid="review-item"
      data-id={pin.id}
    >
      <div className="flex flex-wrap gap-4">
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            className="h-28 w-28 rounded-2xl object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-wider text-[#b3242f] uppercase">
            {KIND_LABEL[pin.kind]} · {TOWN_LABEL[pin.town]} · {pin.status}
            {pin.residential ? " · HOME" : ""}
          </p>
          <h3 className="ghad-display text-xl font-extrabold">{pin.name}</h3>
          {pin.description && <p className="text-sm">{pin.description}</p>}
          <p className="text-sm">
            {pin.address ? `${pin.address} · ` : ""}
            <a
              className="underline"
              target="_blank"
              rel="noreferrer"
              href={`https://www.google.com/maps/search/?api=1&query=${pin.at.lat},${pin.at.lng}`}
            >
              {pin.at.lat.toFixed(5)}, {pin.at.lng.toFixed(5)}
            </a>
            {pin.hours ? ` · ${pin.hours}` : ""}
          </p>
          {pin.residential && (
            <p className="mt-1 text-sm font-bold">
              {pin.review?.consentClaim
                ? CLAIM[pin.review.consentClaim]
                : "Submitter wasn't sure about permission"}
              {pin.review?.consentUrl ? ` — ${pin.review.consentUrl}` : ""}
            </p>
          )}
          {reports.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm text-[#b3242f]">
              {reports.map((r) => (
                <li key={r.at + r.by}>{r.text}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {pin.residential &&
        pin.status !== "approved" &&
        pin.status !== "hidden" && (
          <fieldset className="mt-3 space-y-1 text-sm">
            <legend className="font-bold">
              I&apos;ve confirmed permission:
            </legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name={`b-${pin.id}`}
                checked={basis === "owner-consent"}
                onChange={() => setBasis("owner-consent")}
                data-testid="basis-owner"
              />{" "}
              The owner said yes
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name={`b-${pin.id}`}
                checked={basis === "public-listing"}
                onChange={() => setBasis("public-listing")}
              />{" "}
              It&apos;s on a public listing:
            </label>
            {basis === "public-listing" && (
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-xl border p-2"
              />
            )}
          </fieldset>
        )}
      <div className="mt-3 flex flex-wrap gap-2">
        {(pin.status === "pending" || pin.status === "declined") && (
          <button
            type="button"
            onClick={() => void act("approve", basis ? { basis, url } : {})}
            className="min-h-11 rounded-full bg-[#0f3b2b] px-4 font-bold text-white"
            data-testid="review-approve"
          >
            Publish
          </button>
        )}
        {pin.status === "pending" && (
          <button
            type="button"
            onClick={() => void act("decline")}
            className="min-h-11 rounded-full px-4 font-bold ring-1 ring-[#0f3b2b]/25"
            data-testid="review-decline"
          >
            Decline
          </button>
        )}
        {pin.status === "hidden" && (
          <button
            type="button"
            onClick={() => void act("restore")}
            className="min-h-11 rounded-full px-4 font-bold ring-1 ring-[#0f3b2b]/25"
          >
            Restore (the takedown wasn&apos;t the owner)
          </button>
        )}
        <button
          type="button"
          onClick={() => confirm("Remove for good?") && void act("remove")}
          className="min-h-11 rounded-full px-4 font-bold text-[#b3242f] ring-1 ring-[#b3242f]/30"
          data-testid="review-remove"
        >
          Remove
        </button>
      </div>
      {say && (
        <p className="mt-2 text-sm font-bold text-[#b3242f]" role="alert">
          {say}
        </p>
      )}
    </li>
  );
}
