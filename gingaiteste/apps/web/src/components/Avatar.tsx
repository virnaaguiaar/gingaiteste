"use client";

import { useState } from "react";

/**
 * Avatar do usuário: foto (ex.: Google) com fallback para a inicial do nome.
 * `referrerPolicy="no-referrer"` porque o CDN do Google responde 403 a referrer
 * cross-origin. `size` controla o diâmetro via classes utilitárias.
 */
export function Avatar({
  src,
  name,
  className = "size-8",
  textClassName = "text-sm",
}: {
  src?: string | null;
  name: string;
  className?: string;
  textClassName?: string;
}) {
  const [broken, setBroken] = useState(false);
  const initial = name.trim()[0]?.toUpperCase() ?? "?";

  if (!src || broken) {
    return (
      <span
        className={`grid shrink-0 place-items-center rounded-full bg-ginga font-bold text-white ${className} ${textClassName}`}
      >
        {initial}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={`shrink-0 rounded-full object-cover ${className}`}
    />
  );
}
