import { useCallback, useState } from "react";
import type { MicrophoneDiagnosticReport } from "../domain/runtime/microphone.js";

export function useMicrophoneDiagnostic() {
  const [microphoneDiagnostic, setMicrophoneDiagnostic] =
    useState<MicrophoneDiagnosticReport | null>(null);

  const runMicrophoneDiagnostic = useCallback(async () => {
    const report = await collectMicrophoneDiagnostic();
    setMicrophoneDiagnostic(report);
  }, []);

  return {
    microphoneDiagnostic,
    setMicrophoneDiagnostic,
    runMicrophoneDiagnostic,
  };
}

export async function collectMicrophoneDiagnostic(): Promise<MicrophoneDiagnosticReport> {
  const base: MicrophoneDiagnosticReport = {
    secureContext: window.isSecureContext,
    mediaDevices: Boolean(navigator.mediaDevices?.getUserMedia),
    permission: "unknown",
    audioInputCount: 0,
    audioInputs: [],
    testStatus: "idle",
  };

  if (navigator.permissions?.query) {
    try {
      const permission = await navigator.permissions.query({
        name: "microphone",
      } as PermissionDescriptor);
      base.permission = permission.state;
    } catch {
      base.permission = "unsupported";
    }
  }

  if (navigator.mediaDevices?.enumerateDevices) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((device) => device.kind === "audioinput");
      base.audioInputCount = inputs.length;
      base.audioInputs = inputs.map((device, index) => {
        return device.label || `audio input ${index + 1}`;
      });
    } catch (error) {
      base.errorName = error instanceof Error ? error.name : "DeviceError";
      base.errorMessage =
        error instanceof Error ? error.message : "Could not enumerate devices";
    }
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      ...base,
      testStatus: "error",
      errorName: base.errorName ?? "NotSupportedError",
      errorMessage:
        base.errorMessage ?? "navigator.mediaDevices.getUserMedia is missing",
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return { ...base, testStatus: "ok" };
  } catch (error) {
    return {
      ...base,
      testStatus: "error",
      errorName: error instanceof Error ? error.name : "MicrophoneError",
      errorMessage:
        error instanceof Error
          ? error.message
          : "Could not open microphone with minimal constraints",
    };
  }
}
