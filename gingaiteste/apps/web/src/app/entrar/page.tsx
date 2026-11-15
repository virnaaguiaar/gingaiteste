"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { GoogleSignInButton } from "@/components/AuthButton";
import { Card, Header, Page } from "@/components/ui";
import { useAuth } from "@/lib/use-auth";

export default function EntrarPage() {
  return (
    <Page>
      <Header right={<span className="text-sm text-muted">Entrar</span>} />
      <section className="pt-6 text-center">
        <h1 className="text-4xl font-black leading-tight text-brand-2">
          Entrar na <span className="text-ginga">sua conta</span>
        </h1>
        <p className="mt-3 text-muted">
          Entre com o Google para salvar seu histórico, suas festas e seu ranking em qualquer
          aparelho.
        </p>
      </section>

      <Suspense fallback={null}>
        <EntrarCard />
      </Suspense>
    </Page>
  );
}

function EntrarCard() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const rawErro = params.get("erro");
  const next = params.get("next") ?? "/";

  // Já logado? Vai para o destino pretendido.
  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  const erro = rawErro ? friendlyError(rawErro) : null;

  return (
    <>
      {erro && (
        <p className="rounded-2xl bg-brand/15 p-4 text-sm text-brand" role="alert">
          {erro}
        </p>
      )}

      <Card className="flex flex-col gap-3">
        <GoogleSignInButton />
        <p className="text-center text-xs text-muted">
          Ao entrar, você concorda em usar o GingAI para se divertir dançando.
        </p>
      </Card>
    </>
  );
}

/** Traduz erros conhecidos do OAuth para algo acionável. */
function friendlyError(raw: string): string {
  const e = raw.toLowerCase();
  if (e.includes("pkce") || e.includes("code verifier")) {
    return "O login não pôde ser concluído neste navegador. Tente de novo na mesma aba, sem trocar de http/https nem limpar os cookies no meio do caminho.";
  }
  if (e.includes("sem_codigo")) {
    return "O provedor não devolveu um código de login. Tente entrar de novo.";
  }
  return `Não foi possível entrar: ${raw}`;
}
