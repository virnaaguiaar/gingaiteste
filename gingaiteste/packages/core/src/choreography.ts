import type { DanceStyle } from "./types";

/**
 * Coreografias dos robôs do "Baile de robôs". Funções puras: dados o estilo, o índice do
 * robô, quantos robôs há e o tempo, devolvem a pose e as luzes. Assim a mesma lógica
 * serve ao simulador 3D de hoje e (no futuro) aos robôs reais.
 *
 * Coordenadas em "metros" do palco: x para a direita, z para a frente (do palco para o
 * público); `heading` 0 olha para +z. O palco vai de -ARENA_HALF a +ARENA_HALF.
 */
export const ARENA_HALF = 3.2;
export const MAX_ROBOTS = 10;
export const LEDS_PER_ROBOT = 6;

export interface RobotPose {
  x: number;
  z: number;
  /** Rotação em torno do eixo vertical, em radianos. */
  heading: number;
  /** Inclinação (balanço) do corpo, em radianos. */
  tilt: number;
}

export interface LedFrame {
  /** Matiz (0–360) de cada um dos 6 LEDs RGB. */
  hues: number[];
  /** Saturação 0–1. */
  sat: number;
  /** Brilho 0–1. */
  level: number;
}

/** Batidas por minuto de cada estilo conhecido; estilos novos usam o padrão. */
export const STYLE_BPM: Record<string, number> = { forro: 120, samba: 110, funk: 130, reggae: 76 };
const DEFAULT_BPM = 100;

/** Andamento (batidas por minuto) usado pela coreografia e pela música do estilo. */
export const styleBpm = (style: DanceStyle): number => STYLE_BPM[style] ?? DEFAULT_BPM;

const TAU = Math.PI * 2;
const mod = (a: number, m: number) => ((a % m) + m) % m;
const easeInOut = (u: number) => (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u));
const clamp01 = (u: number) => Math.min(1, Math.max(0, u));
/** Curva 0→1→0 que dá um "pulso" a cada batida. */
const beatPulse = (b: number) => 1 - mod(b, 1);

export interface Formation {
  slots: { x: number; z: number }[];
  /** Menor distância entre vizinhos (limita a amplitude dos passos). */
  gap: number;
}

/** Posição "de casa" de cada robô: filas centralizadas no palco. */
export function formation(n: number): Formation {
  const count = Math.max(0, Math.min(MAX_ROBOTS, Math.floor(n)));
  if (count === 0) return { slots: [], gap: 3 };
  const rows = count <= 3 ? 1 : count <= 8 ? 2 : 3;
  const base = Math.floor(count / rows);
  const extra = count % rows;
  const slots: { x: number; z: number }[] = [];
  let gap = 4.4;
  for (let r = 0; r < rows; r++) {
    const k = base + (r < extra ? 1 : 0);
    const z = rows === 1 ? 0 : -1.4 + (2.8 * r) / (rows - 1);
    for (let c = 0; c < k; c++) {
      const x = k === 1 ? 0 : -2.2 + (4.4 * c) / (k - 1);
      slots.push({ x, z });
    }
    if (k > 1) gap = Math.min(gap, 4.4 / (k - 1));
  }
  if (rows > 1) gap = Math.min(gap, 2.8 / (rows - 1));
  return { slots, gap };
}

/** Pose parada (sem música): cada robô no seu lugar, de frente. */
export function idlePose(i: number, n: number): RobotPose {
  const s = formation(n).slots[i] ?? { x: 0, z: 0 };
  return { x: s.x, z: s.z, heading: 0, tilt: 0 };
}

/** Pose do robô `i` (de `n`) dançando `style` no instante `t` (segundos). */
export function choreoPose(style: DanceStyle | null, i: number, n: number, t: number): RobotPose {
  if (!style) return idlePose(i, n);
  const b = (t * (STYLE_BPM[style] ?? DEFAULT_BPM)) / 60; // tempo em batidas
  const { slots, gap } = formation(n);
  const slot = slots[i] ?? { x: 0, z: 0 };

  switch (style) {
    case "forro": {
      // Casais: dois robôs giram um em torno do outro, balançando o par de lado a lado.
      const pairs = formation(Math.ceil(n / 2));
      const pair = pairs.slots[i >> 1] ?? { x: 0, z: 0 };
      const sway = 0.15 * Math.sin((TAU * b) / 4);
      const lone = n % 2 === 1 && i === n - 1;
      if (lone) {
        return {
          x: pair.x + sway,
          z: pair.z,
          heading: 0.5 * Math.sin((TAU * b) / 4),
          tilt: 0.08 * Math.sin(TAU * b),
        };
      }
      const angle = (TAU * b) / 8 + (i & 1) * Math.PI;
      const r = 0.55;
      return {
        x: pair.x + r * Math.cos(angle) + sway,
        z: pair.z + r * Math.sin(angle),
        heading: -angle,
        tilt: 0.08 * Math.sin(TAU * b),
      };
    }
    case "samba": {
      // Gingado largo de um lado a outro, "sambando" com o corpo e um giro a cada 16 batidas.
      const amp = Math.min(0.5, gap * 0.28);
      const phrase = mod(b, 16) / 16;
      const spin = phrase >= 14 / 16 ? TAU * easeInOut(clamp01((phrase - 14 / 16) * 8)) : 0;
      return {
        x: slot.x + amp * Math.sin((TAU * b) / 4),
        z: slot.z + 0.12 * Math.sin((TAU * b) / 2 + slot.x),
        heading: 0.7 * Math.sin(TAU * b) + spin,
        tilt: 0.1 * Math.sin(TAU * b),
      };
    }
    case "funk": {
      // Fila e contra-fila: avança rápido e volta devagar, com giro de 360° a cada 8 batidas.
      const u = mod(b, 2);
      const stomp = u < 0.25 ? u / 0.25 : Math.max(0, 1 - (u - 0.25) / 1.0);
      const sign = i % 2 === 0 ? 1 : -1;
      const q = mod(b, 8);
      const spin = q >= 7 ? TAU * easeInOut(q - 7) : 0;
      return {
        x: slot.x,
        z: slot.z + sign * 0.28 * stomp,
        heading: 0.45 * Math.sin(TAU * b * 2) + spin,
        tilt: 0.12 * Math.sin(TAU * b * 2),
      };
    }
    case "reggae": {
      // Balanço lento em oito (lemniscata).
      const a = (TAU * b) / 8 + i * 0.4;
      const dx = 0.5 * Math.cos(a);
      const dz = 0.6 * Math.cos(2 * a);
      return {
        x: slot.x + 0.5 * Math.sin(a),
        z: slot.z + 0.3 * Math.sin(2 * a),
        heading: Math.atan2(dx, dz),
        tilt: 0.15 * Math.sin(2 * a),
      };
    }
    default: {
      // Estilo novo sem coreografia própria: ciranda em volta do palco.
      const R = n > 1 ? 1.9 : 0;
      const angle = (TAU * i) / Math.max(1, n) + (TAU * b) / 16;
      return {
        x: R * Math.cos(angle),
        z: R * Math.sin(angle),
        heading: R > 0 ? -angle : (TAU * b) / 8,
        tilt: 0.06 * Math.sin(TAU * b),
      };
    }
  }
}

/** Luzes RGB do robô `i` no instante `t`. Sem estilo (parado), respira em azul fraco. */
export function ledFrame(style: DanceStyle | null, i: number, t: number): LedFrame {
  const leds = Array.from({ length: LEDS_PER_ROBOT }, (_, k) => k);
  if (!style) {
    return { hues: leds.map(() => 210), sat: 0.6, level: 0.12 + 0.08 * Math.sin(t * 1.2 + i) };
  }
  const b = (t * (STYLE_BPM[style] ?? DEFAULT_BPM)) / 60;
  switch (style) {
    case "forro":
      return { hues: leds.map((k) => 20 + k * 9), sat: 0.95, level: 0.5 + 0.5 * beatPulse(b) };
    case "samba":
      return { hues: leds.map((k) => mod(120 + k * 40 + b * 60, 360)), sat: 1, level: 0.9 };
    case "funk":
      return {
        hues: leds.map((k) => ((k + Math.floor(b * 2)) % 2 === 0 ? 300 : 185)),
        sat: 1,
        level: 0.25 + 0.75 * beatPulse(b * 2) ** 2,
      };
    case "reggae":
      return {
        hues: leds.map((k) => [120, 55, 0][(Math.floor(b / 2) + k) % 3]!),
        sat: 1,
        level: 0.6 + 0.3 * Math.sin((TAU * b) / 4),
      };
    default:
      return { hues: leds.map((k) => mod(t * 40 + i * 36 + k * 60, 360)), sat: 1, level: 0.85 };
  }
}
