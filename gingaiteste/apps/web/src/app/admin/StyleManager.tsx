"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import { createStyle, deleteStyle, listStyles, slugify, type DanceStyleOption } from "@/lib/styles-catalog";

/** Gestão do catálogo de estilos (somente admin): listar, adicionar e remover. */
export function StyleManager() {
  const [styles, setStyles] = useState<DanceStyleOption[] | null>(null);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    void listStyles()
      .then(setStyles)
      .catch(() => setStyles([]));
  };

  useEffect(reload, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await createStyle({ name: trimmed, emoji });
      setName("");
      setEmoji("");
      reload();
    } catch (err) {
      const msg = (err as { message?: string }).message ?? "";
      setError(
        msg.includes("duplicate") || msg.includes("23505")
          ? "Já existe um estilo com esse nome."
          : `Não foi possível adicionar: ${msg}`,
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (slug: string, label: string) => {
    if (!confirm(`Remover o estilo “${label}” do catálogo?`)) return;
    try {
      await deleteStyle(slug);
      reload();
    } catch (err) {
      alert(`Não foi possível remover: ${(err as { message?: string }).message ?? ""}`);
    }
  };

  const preview = name.trim() ? slugify(name) : "";

  return (
    <Card>
      <h2 className="font-bold">Estilos de dança (catálogo)</h2>
      <p className="mt-1 text-xs text-muted">
        Os usuários escolhem entre estes estilos no modo coleta. Só o admin gerencia a lista.
      </p>

      <ul className="mt-3 divide-y divide-surface-2 text-sm">
        {(styles ?? []).map((s) => (
          <li key={s.slug} className="flex items-center gap-3 py-2">
            <span className="text-lg">{s.emoji}</span>
            <span className="flex-1 truncate">
              {s.name}
              {s.isControl && <span className="ml-2 text-xs text-muted">(controle)</span>}
              <span className="ml-2 font-mono text-xs text-muted">{s.slug}</span>
            </span>
            {!s.isControl && (
              <button
                onClick={() => void remove(s.slug, s.name)}
                className="text-xs text-brand underline-offset-4 hover:underline"
              >
                remover
              </button>
            )}
          </li>
        ))}
        {styles !== null && styles.length === 0 && (
          <li className="py-2 text-muted">Nenhum estilo cadastrado.</li>
        )}
      </ul>

      <form className="mt-4 flex flex-col gap-2" onSubmit={add}>
        <div className="flex gap-2">
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder="🎶"
            maxLength={4}
            aria-label="Emoji do estilo"
            className="w-16 rounded-2xl bg-surface-2 px-3 py-3 text-center text-lg"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do novo estilo (ex.: Reggae)"
            maxLength={40}
            className="min-w-0 flex-1 rounded-2xl bg-surface-2 px-4 py-3 placeholder:text-muted"
          />
          <Button type="submit" className="px-5 py-3" disabled={busy || !name.trim()}>
            {busy ? "…" : "Adicionar"}
          </Button>
        </div>
        {preview && (
          <p className="text-xs text-muted">
            slug: <span className="font-mono">{preview}</span>
          </p>
        )}
        {error && <p className="text-xs text-brand">{error}</p>}
      </form>
    </Card>
  );
}
