import { Header, Page } from "@/components/ui";
import { MyEvents } from "./MyEvents";

export default function MyEventsPage() {
  return (
    <Page>
      <Header right={<span className="text-sm text-muted">Minhas festas</span>} />
      <h1 className="text-3xl font-black">Minhas festas</h1>
      <p className="text-muted">Crie, edite e remova as festas que você organiza.</p>
      <MyEvents />
    </Page>
  );
}
