"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/**
 * **Say it instead of typing it — where the browser can listen.**
 *
 * The Web Speech API (`SpeechRecognition`, `webkitSpeechRecognition` in
 * Chrome and Safari). Where it does not exist (Firefox, many in-app
 * browsers) `supported` is false and the microphone is simply not drawn:
 * the text box is always there. Passport receives only the words; the
 * browser's own speech service does the listening, which is said beside the
 * button.
 */
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult:
    | ((e: {
        resultIndex: number;
        results: ArrayLike<
          { isFinal: boolean } & ArrayLike<{ transcript: string }>
        >;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

function ctor(): (new () => Recognition) | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const noop = () => () => {};

export function useSpeech(onFinal: (text: string) => void) {
  const supported = useSyncExternalStore(
    noop,
    () => Boolean(ctor()),
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [problem, setProblem] = useState<string | undefined>();
  const live = useRef<Recognition | null>(null);
  const finalText = useRef("");
  const done = useRef(onFinal);
  useEffect(() => {
    done.current = onFinal;
  }, [onFinal]);

  const stop = useCallback(() => live.current?.stop(), []);

  const start = useCallback(() => {
    const Make = ctor();
    if (!Make || live.current) return;
    const r = new Make();
    r.lang = "en-CA";
    r.interimResults = true;
    r.continuous = false;
    finalText.current = "";
    setHeard("");
    setProblem(undefined);
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]!;
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalText.current += text;
        else interim += text;
      }
      setHeard(`${finalText.current}${interim}`.trim());
    };
    r.onerror = (e) => {
      setProblem(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "The microphone is blocked for this site. Typing works just as well."
          : e.error === "no-speech"
            ? "I didn't catch anything. Try again, or type it."
            : "Listening stopped. Typing works just as well.",
      );
    };
    r.onend = () => {
      live.current = null;
      setListening(false);
      const said = finalText.current.trim();
      if (said) done.current(said);
    };
    live.current = r;
    setListening(true);
    try {
      r.start();
    } catch {
      live.current = null;
      setListening(false);
    }
  }, []);

  useEffect(() => () => live.current?.abort(), []);

  return { supported, listening, heard, problem, start, stop };
}
