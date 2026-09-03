/**
 * Procedural Web Audio API Sound Synthesizer for DnDAIe5 Adventure
 * No external MP3/WAV files required. Works 100% offline and in all modern browsers.
 */

let audioCtx: AudioContext | null = null;
let soundEnabled = true;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
  if (typeof window !== 'undefined') {
    localStorage.setItem('dnd_sound_enabled', JSON.stringify(enabled));
  }
}

export function isSoundEnabled(): boolean {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('dnd_sound_enabled');
    if (saved !== null) {
      soundEnabled = JSON.parse(saved);
    }
  }
  return soundEnabled;
}

/**
 * Play procedural dice rolling sound (multiple realistic wooden/acrylic tumbling clicks)
 */
export function playDiceRollSound() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const numClicks = Math.floor(Math.random() * 4) + 6; // 6 to 9 clicks

  for (let i = 0; i < numClicks; i++) {
    const timeOffset = (i * 0.05) + (Math.random() * 0.03);
    const clickTime = now + timeOffset;

    // High pass click / noise burst
    const bufferSize = ctx.sampleRate * 0.02;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let j = 0; j < bufferSize; j++) {
      output[j] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800 + Math.random() * 1200, clickTime);
    filter.Q.setValueAtTime(4, clickTime);

    const gain = ctx.createGain();
    const volume = (1 - (i / numClicks) * 0.5) * 0.25;
    gain.gain.setValueAtTime(volume, clickTime);
    gain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.02);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    whiteNoise.start(clickTime);
    whiteNoise.stop(clickTime + 0.02);

    // Subtle wooden body thump
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const baseFreq = 180 + Math.random() * 120;
    osc.frequency.setValueAtTime(baseFreq, clickTime);
    osc.frequency.exponentialRampToValueAtTime(60, clickTime + 0.03);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.2, clickTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.03);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    osc.start(clickTime);
    osc.stop(clickTime + 0.03);
  }
}

/**
 * Play triumphant fanfare / harp chime for Natural 20 or Critical Success
 */
export function playCriticalHitSound() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const chordNotes = [523.25, 659.25, 783.99, 1046.5, 1318.51]; // C5, E5, G5, C6, E6

  chordNotes.forEach((freq, idx) => {
    const noteTime = now + (idx * 0.07);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, noteTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, noteTime);
    gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.8);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(noteTime);
    osc.stop(noteTime + 0.8);
  });
}

/**
 * Play dramatic fail tone for Natural 1 or critical failure
 */
export function playCriticalFailSound() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.exponentialRampToValueAtTime(45, now + 0.6);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(400, now);
  filter.frequency.exponentialRampToValueAtTime(100, now + 0.6);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.6);
}

/**
 * Play metallic sword clash or damage impact sound
 */
export function playDamageSound() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Impact thump
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(160, now);
  osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.4, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.3);

  // Metallic clash noise
  const bufferSize = ctx.sampleRate * 0.15;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = buffer.getChannelData(0);
  for (let j = 0; j < bufferSize; j++) {
    output[j] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(2400, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + 0.15);
}

/**
 * Play magical healing sound
 */
export function playHealSound() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5

  notes.forEach((freq, idx) => {
    const noteTime = now + (idx * 0.08);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, noteTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, noteTime);
    gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(noteTime);
    osc.stop(noteTime + 0.5);
  });
}

/**
 * Play gold coins clinking sound
 */
export function playCoinSound() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const coins = 3;

  for (let i = 0; i < coins; i++) {
    const coinTime = now + (i * 0.06);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2400 + Math.random() * 400, coinTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, coinTime);
    gain.gain.exponentialRampToValueAtTime(0.001, coinTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(coinTime);
    osc.stop(coinTime + 0.25);
  }
}

/**
 * Play sparkling item pickup / loot discovery chime
 */
export function playItemGainSound() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [587.33, 880, 1174.66, 1760]; // D5, A5, D6, A6 sparkle

  notes.forEach((freq, idx) => {
    const noteTime = now + (idx * 0.06);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, noteTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.16, noteTime);
    gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(noteTime);
    osc.stop(noteTime + 0.45);
  });
}

