"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};
const supported = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

/** Strips emoji so the voice reads the words, not "face with tears of joy". */
const spoken = (text: string) => text.replace(/\p{Extended_Pictographic}/gu, "").replace(/\s+/g, " ").trim();

/**
 * "Read to me" (FR-5.9 stand-in): the browser's speech synthesis, preferring an en-IN voice. `canSpeak` is false where
 * the browser has none, so callers hide the button.
 */
export function useSpeech() {
  const canSpeak = useSyncExternalStore(noopSubscribe, supported, () => false);

  useEffect(() => {
    if (!canSpeak) return;
    return () => window.speechSynthesis.cancel(); // never keep talking after the question is gone
  }, [canSpeak]);

  const speak = useCallback((parts: string[]) => {
    if (!supported()) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const voices = synth.getVoices();
    const voice = voices.find((v) => v.lang.replace("_", "-").toLowerCase() === "en-in") ?? voices.find((v) => v.lang.toLowerCase().startsWith("en"));
    const utterance = new SpeechSynthesisUtterance(parts.map(spoken).filter(Boolean).join(". "));
    utterance.lang = voice?.lang ?? "en-IN";
    if (voice) utterance.voice = voice;
    utterance.rate = 0.92; // a little slower for young listeners
    synth.speak(utterance);
  }, []);

  const stop = useCallback(() => {
    if (supported()) window.speechSynthesis.cancel();
  }, []);

  return { canSpeak, speak, stop };
}
