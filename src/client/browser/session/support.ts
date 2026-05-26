import type { BrowserVoiceSupport } from "./types.js";

interface WebKitAudioWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

export function checkBrowserVoiceSupport(): BrowserVoiceSupport {
  if (typeof window === "undefined") {
    return { supported: false, reason: "Not in browser environment" };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { supported: false, reason: "Microphone access is not available" };
  }
  const AudioContextCtor =
    window.AudioContext || (window as WebKitAudioWindow).webkitAudioContext;
  if (!AudioContextCtor) {
    return { supported: false, reason: "AudioContext is not supported" };
  }
  if (!("audioWorklet" in AudioContextCtor.prototype)) {
    return { supported: false, reason: "AudioWorklet is not supported" };
  }
  return { supported: true };
}
