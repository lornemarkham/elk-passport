"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LoaderCircle } from "lucide-react";
import {
  getProgress,
  getServerProgress,
  isBusy,
  subscribeProgress,
} from "./progress";

/**
 * **A form's button that says the form was sent.**
 *
 * For a GET form that opens a page ("Make my Christmas plan"): from the moment
 * it is submitted until the next page arrives, the button reads `pending`
 * with a small spinner and stops taking a second press. It is the place the
 * person is looking, so the answer to "did that work?" is there, not only in
 * the line at the top of the screen.
 *
 * Works before JavaScript too — it is a plain submit button until hydrated.
 */
export function SubmitButton({
  children,
  pending,
  className = "",
  ...rest
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  readonly pending: string;
  readonly "data-testid"?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [sent, setSent] = useState(false);
  const busy = isBusy(
    useSyncExternalStore(subscribeProgress, getProgress, getServerProgress),
  );
  // The wait the submit started has ended (the address changed, or the
  // navigation gave up): ready for another go.
  const [wasBusy, setWasBusy] = useState(busy);
  if (busy !== wasBusy) {
    setWasBusy(busy);
    if (!busy && sent) setSent(false);
  }

  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const onSubmit = () => setSent(true);
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, []);

  return (
    <button
      ref={ref}
      type="submit"
      aria-disabled={sent || undefined}
      data-pending={sent ? "true" : undefined}
      onClick={(event) => {
        if (sent) event.preventDefault();
      }}
      className={className}
      {...rest}
    >
      {sent ? (
        <>
          <LoaderCircle
            className="h-5 w-5 animate-spin motion-reduce:animate-none"
            aria-hidden
          />
          <span role="status">{pending}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
