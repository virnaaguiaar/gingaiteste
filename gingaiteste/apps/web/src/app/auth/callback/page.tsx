"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { Page } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Callback do OAuth (Google). O code exchange do PKCE acontece AQUI, no navegador,
 * porque o `code_verifier` foi gravado pelo client do browser (createBrowserClient).
 * Fazê-lo no servidor falharia com "PKCE code verifier not found in storage".
 */
export default function AuthCallbackPage() {
  return (
    <Page>
      <Suspense fallback={<p className="text-muted">Entrando…</p>}>
        <CallbackHandler />
      </Suspense>
    </Page>
  );
}

function CallbackHandler() {
  const router = useRouter();
  const params = useSearchParams();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // o exchange só pode rodar uma vez (o code é de uso único)
    ran.current = true;

    // Destino: sessionStorage (definido no início do login) → query → "/".
    let next = params.get("next") ?? "/";
    try {
      const saved = sessionStorage.getItem("gingai:next");
      if (saved) {
        next = saved;
        sessionStorage.removeItem("gingai:next");
      }
    } catch {
      // storage indisponível: usa o fallback.
    }
    const code = params.get("code");
    const errorDescription = params.get("error_description");

    const go = (path: string) => router.replace(path);

    if (errorDescription) {
      go(`/entrar?erro=${encodeURIComponent(errorDescription)}`);
      return;
    }
    if (!code) {
      go("/entrar?erro=sem_codigo");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    void supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) go(`/entrar?erro=${encodeURIComponent(error.message)}`);
      else go(next);
    });
  }, [params, router]);

  return <p className="text-muted">Entrando…</p>;
}
