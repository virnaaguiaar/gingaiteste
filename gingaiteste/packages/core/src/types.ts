/** Estilos embutidos (têm centróide heurístico inicial). */
export const DANCE_STYLES = ["forro", "samba", "funk"] as const;
export type BuiltinStyle = (typeof DANCE_STYLES)[number];
/**
 * Slug de um estilo de dança. Os embutidos são DANCE_STYLES; o admin pode cadastrar
 * outros no catálogo (ex.: "reggae"), então o tipo é texto livre.
 */
export type DanceStyle = string;

/** Classes de controle do modo de coleta (não são estilos e não entram no classificador). */
export const CONTROL_LABELS = ["parado", "outro"] as const;

/** Rótulos usados no modo de coleta (estilos + classes de controle). */
export const MOTION_LABELS = [...DANCE_STYLES, ...CONTROL_LABELS] as const;
export type MotionLabel = string;

/**
 * Uma leitura do sensor, já normalizada pelos adaptadores de plataforma.
 * - `t`: tempo em milissegundos (relógio monotônico de preferência)
 * - `ax, ay, az`: aceleração INCLUINDO gravidade, em m/s²
 * - `rx, ry, rz`: velocidade de rotação em graus/s (0 se o aparelho não tiver giroscópio)
 *
 * O sinal dos eixos não importa: as características são invariantes à orientação
 * do celular no bolso (a gravidade é estimada pela média da janela).
 */
export interface MotionSample {
  t: number;
  ax: number;
  ay: number;
  az: number;
  rx: number;
  ry: number;
  rz: number;
}

/** Características extraídas de uma janela de movimento (invariantes à orientação). */
export interface WindowFeatures {
  /** Duração real coberta pela janela, em segundos. */
  durationS: number;
  /** Taxa de amostragem efetiva do sensor, em Hz. */
  sampleRateHz: number;
  /** Módulo médio da gravidade estimada (≈ 9,8 com o celular parado ou dançando normalmente). */
  gravity: number;
  /** RMS da aceleração dinâmica (sem gravidade), em m/s². */
  intensity: number;
  /** RMS da componente vertical (na direção da gravidade). */
  verticalRms: number;
  /** RMS da componente horizontal (perpendicular à gravidade). */
  horizontalRms: number;
  /** verticalRms / (verticalRms + horizontalRms), entre 0 e 1. */
  verticalRatio: number;
  /** RMS do módulo da rotação, em graus/s. */
  rotationRms: number;
  /** Frequência dominante do "quique" vertical, em Hz (0 se não houver ritmo). */
  cadenceHz: number;
  /** Força da periodicidade (pico da autocorrelação), entre 0 e 1: a "constância". */
  periodicity: number;
}
