import {
  getCaptureWorkletURL,
  getPlaybackWorkletURL,
} from "../audio-worklet.js";
import { acquireMicrophoneStream } from "./microphone.js";

export interface BrowserAudioNodes {
  audioContext: AudioContext;
  mediaStream: MediaStream;
  captureNode: AudioWorkletNode;
  playbackNode: AudioWorkletNode;
}

export async function createMicrophoneAudioNodes(
  audio?: MediaTrackConstraints,
): Promise<BrowserAudioNodes> {
  const mediaStream = await acquireMicrophoneStream(audio);
  const audioContext = new AudioContext({ sampleRate: 48000 });
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  await audioContext.audioWorklet.addModule(getCaptureWorkletURL());
  await audioContext.audioWorklet.addModule(getPlaybackWorkletURL());

  const source = audioContext.createMediaStreamSource(mediaStream);
  const captureNode = new AudioWorkletNode(audioContext, "capture-processor");
  source.connect(captureNode);
  if (audioContext.sampleRate !== 48000) {
    captureNode.port.postMessage({
      type: "config",
      sampleRate: audioContext.sampleRate,
    });
  }

  const playbackNode = new AudioWorkletNode(audioContext, "playback-processor");
  playbackNode.connect(audioContext.destination);
  playbackNode.port.postMessage({
    type: "config",
    sampleRate: audioContext.sampleRate,
  });

  return { audioContext, mediaStream, captureNode, playbackNode };
}
