interface MicrophoneAttempt {
  label: string;
  constraints: MediaStreamConstraints;
}

export async function acquireMicrophoneStream(
  audio?: MediaTrackConstraints,
): Promise<MediaStream> {
  const attempts: MicrophoneAttempt[] = [
    {
      label: "preferred",
      constraints: {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          ...audio,
        },
      },
    },
    {
      label: "minimal",
      constraints: { audio: true },
    },
    {
      label: "raw",
      constraints: {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      },
    },
  ];
  let lastError: unknown;

  for (const attempt of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        attempt.constraints,
      );
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("No audio track returned by getUserMedia");
      }
      if (audioTrack.readyState !== "live") {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error(
          `Audio track is not live after getUserMedia: ${audioTrack.readyState}`,
        );
      }
      return stream;
    } catch (error) {
      lastError = error;
      if (!shouldRetryMicrophone(error)) break;
    }
  }

  throw new Error(formatMicrophoneError(lastError));
}

function shouldRetryMicrophone(error: unknown): boolean {
  const name = error instanceof DOMException ? error.name : "";
  return !["NotAllowedError", "SecurityError", "PermissionDeniedError"].includes(
    name,
  );
}

function formatMicrophoneError(error: unknown): string {
  if (error instanceof DOMException) {
    return [
      `${error.name}: ${error.message}`,
      microphoneRecoveryHint(error.name),
    ]
      .filter(Boolean)
      .join(" ");
  }
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return "MicrophoneError: Failed to start microphone audio source";
}

function microphoneRecoveryHint(name: string): string {
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "Allow microphone permission for localhost in Chrome.";
    case "NotReadableError":
    case "AbortError":
      return "Chrome has permission but cannot open the device; check OS input device, another app using the mic, and PipeWire/PulseAudio.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No microphone input device is visible to the browser.";
    case "OverconstrainedError":
      return "The requested audio constraints failed; the SDK retried with minimal constraints.";
    default:
      return "";
  }
}
