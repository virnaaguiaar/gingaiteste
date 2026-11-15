import type { BuiltinStyle, CONTROL_LABELS, MotionSample } from "./types";

/**
 * Gerador de movimento sintético. Serve para testes e para o "modo simulação"
 * (computador sem sensores, telão de demonstração). Não substitui dados reais.
 */
export interface SyntheticProfile {
  cadenceHz: number;
  /** RMS alvo da aceleração dinâmica, m/s². */
  intensity: number;
  /** Proporção vertical alvo (0 a 1). */
  verticalRatio: number;
  /** RMS alvo da rotação, graus/s. */
  rotationRms: number;
  /** Ruído relativo (0 = sinal perfeito). */
  noise: number;
}

export const SYNTHETIC_PROFILES: Record<BuiltinStyle | (typeof CONTROL_LABELS)[number] | "sacudindo", SyntheticProfile> = {
  forro: { cadenceHz: 1.9, intensity: 3.0, verticalRatio: 0.45, rotationRms: 60, noise: 0.3 },
  samba: { cadenceHz: 2.8, intensity: 4.5, verticalRatio: 0.55, rotationRms: 90, noise: 0.3 },
  funk: { cadenceHz: 2.2, intensity: 5.5, verticalRatio: 0.65, rotationRms: 120, noise: 0.3 },
  parado: { cadenceHz: 1, intensity: 0.05, verticalRatio: 0.5, rotationRms: 2, noise: 1 },
  outro: { cadenceHz: 1.5, intensity: 2, verticalRatio: 0.5, rotationRms: 50, noise: 1.2 },
  sacudindo: { cadenceHz: 3.8, intensity: 40, verticalRatio: 0.5, rotationRms: 900, noise: 0.2 },
};

/** PRNG determinístico (mulberry32), para testes reprodutíveis. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  const u = Math.max(1e-12, rand());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/** Gerador contínuo: chame `next(t)` com o tempo em ms para obter uma leitura. */
export function createSyntheticSource(profile: SyntheticProfile, seed = 1) {
  const rand = seededRandom(seed);
  // Orientação aleatória (mas fixa) do celular no bolso.
  const theta = rand() * Math.PI;
  const phi = rand() * 2 * Math.PI;
  const up: [number, number, number] = [
    Math.sin(theta) * Math.cos(phi),
    Math.sin(theta) * Math.sin(phi),
    Math.cos(theta),
  ];
  // Um vetor perpendicular a "up" para o balanço lateral.
  const ref: [number, number, number] = Math.abs(up[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const cross = [
    up[1] * ref[2] - up[2] * ref[1],
    up[2] * ref[0] - up[0] * ref[2],
    up[0] * ref[1] - up[1] * ref[0],
  ];
  const cn = Math.hypot(cross[0]!, cross[1]!, cross[2]!);
  const side = cross.map((c) => c / cn) as [number, number, number];

  const vr = profile.verticalRatio;
  const vRms = profile.intensity / Math.sqrt(1 + ((1 - vr) / vr) ** 2);
  const hRms = (vRms * (1 - vr)) / vr;
  const av = vRms * Math.SQRT2;
  const ah = hRms * Math.SQRT2;
  const ar = profile.rotationRms * Math.SQRT2;
  const phase = rand() * 2 * Math.PI;

  return (t: number): MotionSample => {
    const s = t / 1000;
    const w = 2 * Math.PI * profile.cadenceHz * s + phase;
    const n = () => gaussian(rand) * profile.noise;
    const vert = av * (0.85 * Math.sin(w) + 0.15 * Math.sin(2 * w)) + n() * vRms;
    const hor = ah * Math.sin(w / 2) + n() * hRms;
    const rot = ar * Math.sin(w / 2 + 0.6) + n() * profile.rotationRms * 0.3;
    const g = 9.80665;
    return {
      t,
      ax: up[0] * (g + vert) + side[0] * hor,
      ay: up[1] * (g + vert) + side[1] * hor,
      az: up[2] * (g + vert) + side[2] * hor,
      rx: up[0] * rot,
      ry: up[1] * rot,
      rz: up[2] * rot,
    };
  };
}

/** Gera `seconds` segundos de leituras a `hz` Hz, com pequeno jitter de tempo. */
export function generateSamples(
  profile: SyntheticProfile,
  seconds: number,
  { hz = 60, seed = 1, startT = 0 }: { hz?: number; seed?: number; startT?: number } = {},
): MotionSample[] {
  const next = createSyntheticSource(profile, seed);
  const jitter = seededRandom(seed + 999);
  const out: MotionSample[] = [];
  const step = 1000 / hz;
  for (let i = 0; i < seconds * hz; i++) {
    out.push(next(startT + i * step + (jitter() - 0.5) * step * 0.3));
  }
  return out;
}
