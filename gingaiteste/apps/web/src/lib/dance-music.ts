"use client";

import { STEPS_PER_BEAT, musicHits, styleBpm, type MusicHit } from "@gingai/core";

/**
 * Toca a música do estilo que os robôs estão dançando, sintetizada com o Web Audio
 * (sem arquivos de áudio). Os padrões vêm de `musicHits` (core) e o andamento é o mesmo
 * da coreografia. Os navegadores só liberam áudio depois de um clique: chame `unlock()`
 * dentro de um manipulador de clique.
 */

const LOOKAHEAD_S = 0.15; // quanto à frente agendamos as notas
const TICK_MS = 25;
const FADE_OUT_S = 0.45;

/** Margem de segurança: vários instrumentos somados não devem estourar o volume. */
const HEADROOM = 0.6;

const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

interface Timbre {
  type: OscillatorType;
  detune: number;
  lowpass: number;
  level: number;
}

/** Som da harmonia (acordes) de cada estilo. */
const CHORD_TIMBRE: Record<string, Timbre> = {
  forro: { type: "sawtooth", detune: 8, lowpass: 2400, level: 0.05 }, // sanfona
  samba: { type: "triangle", detune: 0, lowpass: 3200, level: 0.1 }, // violão
  funk: { type: "square", detune: 0, lowpass: 1400, level: 0.04 },
  reggae: { type: "square", detune: 0, lowpass: 1800, level: 0.045 }, // skank
};
const DEFAULT_TIMBRE: Timbre = { type: "sawtooth", detune: 4, lowpass: 1500, level: 0.045 };

interface Voice {
  style: string;
  bus: GainNode;
  timer: ReturnType<typeof setInterval>;
  nextStep: number;
  nextTime: number;
  stepDur: number;
}

class DanceMusic {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private voice: Voice | null = null;
  private volume = 0.7;

  /** Cria/retoma o áudio. Precisa ser chamado a partir de um clique do usuário. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = this.volume * HEADROOM;
      // Compressor evita estourar quando vários instrumentos tocam juntos.
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ctx.destination);

      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

      this.ctx = ctx;
      this.master = master;
      this.noise = buf;
    }
    void this.ctx.resume();
  }

  get unlocked(): boolean {
    return this.ctx !== null;
  }

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.volume * HEADROOM, this.ctx.currentTime, 0.03);
  }

  /**
   * Começa a tocar `style` (se já toca o mesmo, não faz nada; se toca outro, troca com
   * fade). `delayS` adia o início, para cair numa batida da coreografia.
   */
  play(style: string, delayS = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    if (this.voice?.style === style) return;
    this.stop();

    const bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(this.master);
    const stepDur = 60 / styleBpm(style) / STEPS_PER_BEAT;
    const voice: Voice = {
      style,
      bus,
      stepDur,
      nextStep: 0,
      nextTime: ctx.currentTime + 0.05 + Math.max(0, delayS),
      timer: setInterval(() => this.schedule(voice), TICK_MS),
    };
    this.voice = voice;
    this.schedule(voice);
  }

  /** Para a música atual com um fade curto. */
  stop(): void {
    const ctx = this.ctx;
    const voice = this.voice;
    if (!voice) return;
    this.voice = null;
    clearInterval(voice.timer);
    if (!ctx) return;
    const now = ctx.currentTime;
    voice.bus.gain.cancelScheduledValues(now);
    voice.bus.gain.setValueAtTime(voice.bus.gain.value, now);
    voice.bus.gain.linearRampToValueAtTime(0, now + FADE_OUT_S);
    setTimeout(() => voice.bus.disconnect(), (FADE_OUT_S + 0.2) * 1000);
  }

  private schedule(voice: Voice): void {
    const ctx = this.ctx;
    if (!ctx || this.voice !== voice) return;
    // Aba em segundo plano/áudio suspenso: não acumula notas atrasadas.
    if (voice.nextTime < ctx.currentTime - 0.5) voice.nextTime = ctx.currentTime + 0.05;
    while (voice.nextTime < ctx.currentTime + LOOKAHEAD_S) {
      for (const h of musicHits(voice.style, voice.nextStep)) this.render(voice, h, voice.nextTime);
      voice.nextStep++;
      voice.nextTime += voice.stepDur;
    }
  }

  // ---------------- síntese ----------------

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private noiseBurst(
    dest: AudioNode,
    t: number,
    type: BiquadFilterType,
    freq: number,
    q: number,
    peak: number,
    decay: number,
    attack = 0.002,
  ): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, peak, attack, decay);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + attack + decay + 0.05);
  }

  private tone(
    dest: AudioNode,
    t: number,
    type: OscillatorType,
    f0: number,
    f1: number,
    glideS: number,
    peak: number,
    decay: number,
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + glideS);
    const g = ctx.createGain();
    this.env(g, t, peak, 0.003, decay);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + decay + 0.05);
  }

  /** Nota sustentada (baixo/lead/acorde): ataque rápido, segura até `holdS`, solta. */
  private note(
    dest: AudioNode,
    t: number,
    hz: number,
    type: OscillatorType,
    detuneCents: number,
    lowpass: number,
    peak: number,
    holdS: number,
    attack = 0.008,
  ): void {
    const ctx = this.ctx!;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = lowpass;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.setValueAtTime(Math.max(0.0002, peak * 0.7), t + Math.max(attack, holdS * 0.6));
    g.gain.exponentialRampToValueAtTime(0.0001, t + holdS + 0.09);
    filter.connect(g).connect(dest);
    const detunes = detuneCents ? [-detuneCents, detuneCents] : [0];
    for (const d of detunes) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = hz;
      osc.detune.value = d;
      osc.connect(filter);
      osc.start(t);
      osc.stop(t + holdS + 0.12);
    }
  }

  private render(voice: Voice, h: MusicHit, t: number): void {
    const dest = voice.bus;
    const v = h.velocity;
    const dur = (h.steps ?? 1) * voice.stepDur;
    switch (h.instrument) {
      case "kick":
        this.tone(dest, t, "sine", 150, 45, 0.12, 0.95 * v, 0.35);
        break;
      case "surdo":
        this.tone(dest, t, "sine", 115, 62, 0.1, 0.9 * v, 0.5);
        break;
      case "snare":
        this.noiseBurst(dest, t, "bandpass", 1900, 0.7, 0.55 * v, 0.18);
        this.tone(dest, t, "triangle", 200, 170, 0.05, 0.25 * v, 0.1);
        break;
      case "hat":
        this.noiseBurst(dest, t, "highpass", 7000, 0.7, 0.25 * v, 0.05);
        break;
      case "shaker":
        this.noiseBurst(dest, t, "bandpass", 5500, 1, 0.3 * v, 0.06, 0.01);
        break;
      case "rim":
        this.tone(dest, t, "square", 1100, 900, 0.02, 0.18 * v, 0.04);
        break;
      case "tri":
        this.noiseBurst(dest, t, "bandpass", 8200, 9, 0.35 * v, 0.14);
        break;
      case "bass": {
        const hz = midiToHz(h.notes?.[0] ?? 45);
        this.note(dest, t, hz, "triangle", 0, 700, 0.5 * v, dur);
        this.note(dest, t, hz, "sine", 0, 400, 0.35 * v, dur);
        break;
      }
      case "chord": {
        const tb = CHORD_TIMBRE[voice.style] ?? DEFAULT_TIMBRE;
        for (const n of h.notes ?? []) {
          this.note(dest, t, midiToHz(n), tb.type, tb.detune, tb.lowpass, tb.level * v, dur);
        }
        break;
      }
      case "lead":
        this.note(dest, t, midiToHz(h.notes?.[0] ?? 69), "sawtooth", 6, 3200, 0.07 * v, dur, 0.02);
        break;
    }
  }
}

/** Uma única música por página. */
export const danceMusic = new DanceMusic();
