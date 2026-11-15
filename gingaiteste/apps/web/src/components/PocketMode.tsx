"use client";

import { formatPoints } from "@gingai/core";
import { useRef, useState } from "react";

const HOLD_MS = 2000;

/**
 * "Modo bolso": tela preta (economiza bateria em OLED) que engole todos os toques,
 * para o celular no bolso não apertar botões sozinho. Desbloqueia segurando 2 s.
 * A tela continua ACESA de propósito: o navegador pausa os sensores quando ela apaga.
 */
export function PocketMode({ points, onExit }: { points: number; onExit: () => void }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const begin = () => {
    setHolding(true);
    timer.current = setTimeout(() => {
      setHolding(false);
      onExit();
    }, HOLD_MS);
  };
  const cancel = () => {
    setHolding(false);
    if (timer.current) clearTimeout(timer.current);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex touch-none select-none flex-col items-center justify-center bg-black"
      onPointerDown={begin}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      role="dialog"
      aria-label="Modo bolso ativo. Segure a tela por 2 segundos para sair."
    >
      <p className="font-mono text-5xl font-bold text-neutral-700">{formatPoints(points)}</p>
      <p className="mt-2 text-sm text-neutral-800">pontos</p>
      <div className="absolute bottom-16 flex flex-col items-center gap-3">
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-neutral-900">
          <div
            className="h-full bg-neutral-600"
            style={{
              width: holding ? "100%" : "0%",
              transition: holding ? `width ${HOLD_MS}ms linear` : "none",
            }}
          />
        </div>
        <p className="text-xs text-neutral-700">Segure 2 s para desbloquear</p>
      </div>
    </div>
  );
}
