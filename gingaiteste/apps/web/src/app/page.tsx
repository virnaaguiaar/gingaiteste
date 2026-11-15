import Link from "next/link";
import { Header, LinkButton, Page } from "@/components/ui";
import { HomeClient } from "./HomeClient";

export default function Home() {
  return (
    <Page>
      <Header />
      <section className="pt-4 text-center">
        <h1 className="text-4xl font-black leading-tight text-brand-2">Dance e marque pontos</h1>
        <p className="mt-3 text-muted">
          Coloque o celular no bolso e dance. O app lê o acelerômetro, reconhece o estilo e converte o
          movimento em pontos.
        </p>
      </section>

      <div className="flex flex-col gap-3">
        <LinkButton href="/dancar" className="py-5 text-xl">
          Dançar agora
        </LinkButton>
        <LinkButton href="/eventos/novo" variant="secondary">
          Criar festa com ranking
        </LinkButton>
        <LinkButton href="/eventos" variant="secondary">
          Minhas festas
        </LinkButton>
      </div>

      <HomeClient />

      <footer className="mt-auto flex justify-center gap-4 pt-6 text-xs text-muted">
        <Link href="/coleta" className="underline-offset-4 hover:underline">
          Modo coleta (treinar o modelo)
        </Link>
      </footer>
    </Page>
  );
}
