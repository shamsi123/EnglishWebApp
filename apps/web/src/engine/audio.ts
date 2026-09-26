/**
 * Audio manager. All playback goes through here so the mute setting is respected everywhere.
 * Speech uses the platform voice (Web Speech API) as a placeholder until native-speaker
 * recordings exist; sound effects are synthesised with Web Audio, so no files are needed.
 * Only call from a user gesture (tap) — the first call unlocks audio on iOS.
 */
export type Sfx = 'correct' | 'tryAgain' | 'pop' | 'celebrate' | 'tap';

let muted = false;
let sfxMuted = false;
let ctx: AudioContext | null = null;

export function setMuted(value: boolean) {
  muted = value;
  if (muted && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

/** Sound effects have their own switch (FR-34: sound vs. voice & music). */
export function setSfxMuted(value: boolean) {
  sfxMuted = value;
}

export function isMuted() {
  return muted;
}

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

const LANG_TAGS: Record<string, string> = { ar: 'ar-SA', en: 'en-US', hi: 'hi-IN' };

export type SpeechPart = { text: string; lang: 'ar' | 'en' | 'hi' };

export function speak(text: string, lang: SpeechPart['lang'] = 'en') {
  speakAll([{ text, lang }]);
}

/** Speaks parts in order (e.g. an English instruction followed by an Arabic letter name). */
export function speakAll(parts: SpeechPart[]) {
  if (muted || typeof speechSynthesis === 'undefined') return;
  speechSynthesis.cancel();
  parts.forEach(({ text, lang }) => speechSynthesis.speak(utterance(text, lang)));
}

function utterance(text: string, lang: SpeechPart['lang']): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text);
  const tag = LANG_TAGS[lang] ?? 'en-US';
  u.lang = tag;
  u.rate = 0.85;
  u.pitch = 1.1;
  const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(tag.slice(0, 2)));
  if (voice) u.voice = voice;
  return u;
}

const TONES: Record<Sfx, Array<[freq: number, start: number, dur: number]>> = {
  correct: [[660, 0, 0.12], [880, 0.12, 0.18]],
  tryAgain: [[330, 0, 0.15], [294, 0.15, 0.2]],
  pop: [[900, 0, 0.06]],
  tap: [[520, 0, 0.05]],
  celebrate: [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.12], [1047, 0.36, 0.3]],
};

export function sfx(name: Sfx) {
  if (sfxMuted) return;
  const ac = audioContext();
  if (!ac) return;
  for (const [freq, start, dur] of TONES[name]) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = ac.currentTime + start;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
}
