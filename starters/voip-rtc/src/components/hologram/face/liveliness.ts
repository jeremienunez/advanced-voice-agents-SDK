/* Liveliness policy — TalkingHead-style engagement behaviors adapted to
   the rig (met4citizen/TalkingHead defaults: eye contact 0.2 idle / 0.5
   speaking, idle head move 0.5). Three pure pieces: an attack-triggered
   emphasis gesture with a refractory period (brow flash + micro-nod on
   stressed onsets), a per-mood gaze-wander scale (engaged = steadier
   eyes), and a bounded speaking head-bob. */

export interface EmphasisState {
  /** 0..1 raised-cosine pulse driving the brow flash / micro-nod. */
  readonly pulse: number;
  readonly lastOnsetMs: number;
}

export interface MoodLiveliness {
  /** Scale on idle gaze drift/saccades — wanders most when disengaged. */
  readonly gazeWander: number;
  /** Speech-only head bob gain. */
  readonly bobGain: number;
}

const ATTACK_THRESHOLD = 0.55;
const REFRACTORY_MS = 800;
const PULSE_MS = 300;
const BOB_AMPLITUDE = 0.08;

export function initialEmphasis(): EmphasisState {
  return { pulse: 0, lastOnsetMs: Number.NEGATIVE_INFINITY };
}

export function foldEmphasis(
  prev: EmphasisState,
  attack: number,
  timeMs: number,
): EmphasisState {
  const lastOnsetMs =
    attack >= ATTACK_THRESHOLD && timeMs - prev.lastOnsetMs >= REFRACTORY_MS
      ? timeMs
      : prev.lastOnsetMs;
  const phase = (timeMs - lastOnsetMs) / PULSE_MS;
  const pulse = phase >= 0 && phase < 1 ? Math.sin(Math.PI * phase) : 0;
  return { pulse, lastOnsetMs };
}

/** Engagement ordering (falsifiable): muted >= idle > listening/speaking.
    Complement of TalkingHead eye-contact (0.2 idle / 0.5 speaking). */
export function livelinessForMood(mood: 0 | 1 | 2 | 3): MoodLiveliness {
  const gazeWander = [0.8, 0.5, 0.5, 0.9][mood];
  return { gazeWander, bobGain: mood === 2 ? 1 : 0 };
}

/** Subtle speech rhythm on the head pitch — bounded, envelope-gated. */
export function speakingBob(envelope: number, timeMs: number): number {
  if (envelope <= 0) return 0;
  const t = timeMs * 0.001;
  const wave = Math.sin(t * 2.1 * Math.PI * 2) * 0.7 +
    Math.sin(t * 0.83 * Math.PI * 2 + 1.3) * 0.3;
  return BOB_AMPLITUDE * Math.min(1, envelope * 1.4) * wave;
}
