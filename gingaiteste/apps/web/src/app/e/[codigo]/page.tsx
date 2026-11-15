import { Suspense } from "react";
import { Header, Page } from "@/components/ui";
import { EventJoin } from "./EventJoin";

export default function EventPage({ params }: PageProps<"/e/[codigo]">) {
  return (
    <Page>
      <Header />
      <Suspense fallback={<p className="text-muted">Carregando festa…</p>}>
        {params.then(({ codigo }) => (
          <EventJoin code={codigo} />
        ))}
      </Suspense>
    </Page>
  );
}
