import type { DanceStyle, MotionLabel } from "./types";

export const LABEL_INFO: Record<string, { name: string; emoji: string }> = {
  forro: { name: "Forró", emoji: "🪗" },
  samba: { name: "Samba", emoji: "🥁" },
  funk: { name: "Funk", emoji: "🔊" },
  parado: { name: "Parado", emoji: "🧍" },
  outro: { name: "Outro movimento", emoji: "🚶" },
};

/** Nome e emoji de um estilo; para estilos fora da lista embutida (catálogo) usa um padrão. */
export function labelInfo(style: DanceStyle): { name: string; emoji: string } {
  return (
    LABEL_INFO[style] ?? {
      name: style.charAt(0).toUpperCase() + style.slice(1),
      emoji: "🎶",
    }
  );
}

export function styleName(style: DanceStyle | null): string {
  return style ? labelInfo(style).name : "—";
}

export function formatDuration(seconds: number): string {
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m % 60)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

export function formatPoints(points: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.round(points));
}
