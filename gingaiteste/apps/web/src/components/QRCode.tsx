"use client";

import QR from "qrcode";
import { useEffect, useState } from "react";

/** QR Code em SVG gerado no próprio navegador (nenhum serviço externo). */
export function QRCode({ value, className }: { value: string; className?: string }) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QR.toString(value, { type: "svg", margin: 1, errorCorrectionLevel: "M" })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(null));
    return () => {
      alive = false;
    };
  }, [value]);

  return (
    <div
      className={`rounded-2xl bg-white p-3 [&>svg]:h-full [&>svg]:w-full ${className ?? ""}`}
      role="img"
      aria-label={`QR Code para ${value}`}
      // SVG produzido localmente pela biblioteca qrcode a partir de uma URL nossa.
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}
