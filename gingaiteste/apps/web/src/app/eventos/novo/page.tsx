"use client";

import { DANCE_STYLES, labelInfo, type DanceStyle, type EventVisibility } from "@gingai/core";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GoogleSignInButton } from "@/components/AuthButton";
import { Button, Card, Header, Page } from "@/components/ui";
import { eventStore } from "@/lib/event-store";
import { useAuth } from "@/lib/use-auth";

export default function NovoEventoPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [style, setStyle] = useState<DanceStyle | undefined>();
  const [visibility, setVisibility] = useState<EventVisibility>("public");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const { user } = useAuth();

  if (user === null) {
    return (
      <Page>
        <Header right={<span className="text-sm text-muted">Nova festa</span>} />
        <Card>
          <p className="mb-4 text-muted">Para criar uma festa é preciso entrar com o Google. Quem só vai dançar não precisa.</p>
          <GoogleSignInButton />
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <Header right={<span className="text-sm text-muted">Nova festa</span>} />
      <h1 className="text-3xl font-black">Transforme sua festa numa arena de dança</h1>
      <p className="text-muted">
        Os convidados escaneiam o QR Code, entram com um apelido e o telão mostra quem mais está dançando.
        Ninguém precisa instalar nada.
      </p>
      <Card>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const trimmed = name.trim();
            if (!trimmed) return;
            setBusy(true);
            setErro(null);
            try {
              const event = await eventStore.createEvent({
                name: trimmed.slice(0, 60),
                style,
                visibility,
              });
              router.push(`/e/${event.code}/telao`);
            } catch (err) {
              setErro(err instanceof Error ? err.message : "Não foi possível criar a festa.");
              setBusy(false);
            }
          }}
        >
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Nome da festa</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Forró da Praça"
              maxLength={60}
              required
              className="rounded-2xl bg-surface-2 px-4 py-3 text-lg placeholder:text-muted"
            />
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">Ritmo da noite (opcional)</legend>
            <div className="flex flex-wrap gap-2">
              {DANCE_STYLES.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setStyle(style === s ? undefined : s)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${style === s ? "bg-ginga text-white" : "bg-surface-2 text-foreground"}`}
                >
                  {labelInfo(s).name}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">Quem pode ver</legend>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVisibility("public")}
                aria-pressed={visibility === "public"}
                className={`rounded-2xl px-4 py-3 text-left text-sm ${visibility === "public" ? "bg-ginga text-white" : "bg-surface-2 text-foreground"}`}
              >
                <span className="block font-bold">Pública</span>
                <span className={`block text-xs ${visibility === "public" ? "text-white/80" : "text-muted"}`}>
                  Aparece na página inicial
                </span>
              </button>
              <button
                type="button"
                onClick={() => setVisibility("private")}
                aria-pressed={visibility === "private"}
                className={`rounded-2xl px-4 py-3 text-left text-sm ${visibility === "private" ? "bg-ginga text-white" : "bg-surface-2 text-foreground"}`}
              >
                <span className="block font-bold">Privada</span>
                <span className={`block text-xs ${visibility === "private" ? "text-white/80" : "text-muted"}`}>
                  Só entra quem tem o código
                </span>
              </button>
            </div>
          </fieldset>
          {erro && <p className="text-sm text-brand-2">{erro}</p>}
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? "Criando…" : "Criar festa e abrir telão"}
          </Button>
        </form>
      </Card>
      <p className="text-xs text-muted">
        O ranking ao vivo sincroniza entre todos os celulares conectados à festa.
      </p>
    </Page>
  );
}
