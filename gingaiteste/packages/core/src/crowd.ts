import type { ParticipantScore } from "./events";
import type { DanceStyle } from "./types";

export interface CrowdMood {
  /** Estilo da maioria de quem está dançando agora; null = ninguém dançando. */
  style: DanceStyle | null;
  /** Quantas pessoas dançam agora. */
  dancers: number;
  /** Quantas pessoas estão na festa (placar). */
  total: number;
  /** Dançarinos agora, por estilo. */
  counts: Record<DanceStyle, number>;
}

/**
 * Descobre, a cada instante, o que a festa está dançando.
 *
 * "Dançando agora" = o participante publicou há pouco um estilo atual (`currentStyle`).
 * O relógio dos celulares pode diferir do da tela, então a frescor é medido pelo relógio
 * de quem observa: vale a última vez que o `updatedAt` MUDOU. Se as atualizações param
 * (celular desligado, aba fechada), a pessoa deixa de contar após `staleMs`.
 */
export class CrowdTracker {
  private readonly seen = new Map<string, { updatedAt: number; seenAt: number }>();
  private scores: readonly ParticipantScore[] = [];
  private previous: DanceStyle | null = null;

  constructor(private readonly staleMs = 8000) {}

  observe(scores: readonly ParticipantScore[], now: number): void {
    this.scores = scores;
    const alive = new Set<string>();
    for (const s of scores) {
      alive.add(s.id);
      const known = this.seen.get(s.id);
      if (!known) {
        // Primeira vez: só conta como recente se a marca de tempo parece atual.
        const fresh = Math.abs(now - s.updatedAt) <= this.staleMs;
        this.seen.set(s.id, { updatedAt: s.updatedAt, seenAt: fresh ? now : -Infinity });
      } else if (known.updatedAt !== s.updatedAt) {
        this.seen.set(s.id, { updatedAt: s.updatedAt, seenAt: now });
      }
    }
    for (const id of this.seen.keys()) if (!alive.has(id)) this.seen.delete(id);
  }

  mood(now: number): CrowdMood {
    const counts: Record<DanceStyle, number> = {};
    let dancers = 0;
    for (const s of this.scores) {
      const seen = this.seen.get(s.id);
      if (!s.currentStyle || !seen || now - seen.seenAt > this.staleMs) continue;
      counts[s.currentStyle] = (counts[s.currentStyle] ?? 0) + 1;
      dancers++;
    }

    let style: DanceStyle | null = null;
    let best = 0;
    for (const [name, n] of Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))) {
      if (n > best) {
        best = n;
        style = name;
      }
    }
    // Empate: mantém o estilo anterior (a coreografia não fica trocando à toa).
    if (this.previous && (counts[this.previous] ?? 0) === best && best > 0) style = this.previous;
    this.previous = style;

    return { style, dancers, total: this.scores.length, counts };
  }
}
