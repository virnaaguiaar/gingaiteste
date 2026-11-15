import type { DanceStyle } from "./types";

/** Visibilidade de uma festa: pública aparece na listagem; privada só por código. */
export type EventVisibility = "public" | "private";

/** Evento/festa com ranking coletivo. */
export interface DanceEvent {
  code: string;
  name: string;
  createdAt: number;
  /** Estilo do evento, se for temático (ex.: "Forró da Praça"). */
  style?: DanceStyle;
  /** Pública = listada na home; privada = acessível apenas por código. Padrão: pública. */
  visibility?: EventVisibility;
  /** Usuário que criou a festa (só ele pode ligar o modo demonstração do telão). */
  ownerId?: string;
}

/** Placar de um participante, publicado periodicamente durante a dança. */
export interface ParticipantScore {
  id: string;
  nickname: string;
  points: number;
  danceSeconds: number;
  topStyle: DanceStyle | null;
  /** Estilo que a pessoa está dançando AGORA (null = parada). Alimenta o Baile de robôs. */
  currentStyle?: DanceStyle | null;
  updatedAt: number;
  /** Foto de perfil do participante (quando logado). */
  avatarUrl?: string;
  /** Participante gerado pelo modo de demonstração do telão. */
  simulated?: boolean;
}

// Sem 0/O, 1/I/L: o código precisa ser lido em voz alta e digitado no celular.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateEventCode(length = 6, rand: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < length; i++) code += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
  return code;
}

export function normalizeEventCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

export function isValidEventCode(code: string): boolean {
  return code.length >= 4 && [...code].every((c) => CODE_ALPHABET.includes(c));
}

/** Ordena por pontos (desempate: mais tempo dançado, depois quem chegou antes). */
export function rankParticipants(scores: readonly ParticipantScore[]): ParticipantScore[] {
  return [...scores].sort(
    (a, b) => b.points - a.points || b.danceSeconds - a.danceSeconds || a.updatedAt - b.updatedAt,
  );
}

/** Limpa o apelido digitado: tira espaços extras e limita o tamanho. */
export function sanitizeNickname(input: string): string {
  return input.replace(/\s+/g, " ").trim().slice(0, 24);
}
