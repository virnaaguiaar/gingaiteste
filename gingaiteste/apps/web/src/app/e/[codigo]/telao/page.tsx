import { Suspense } from "react";
import { Telao } from "./Telao";

export default function TelaoPage({ params }: PageProps<"/e/[codigo]/telao">) {
  return (
    <Suspense fallback={<p className="p-10 text-muted">Carregando telão…</p>}>
      {params.then(({ codigo }) => (
        <Telao code={codigo} />
      ))}
    </Suspense>
  );
}
