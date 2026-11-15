"use client";

import { DanceScreen } from "@/components/DanceScreen";
import { Header, Page } from "@/components/ui";
import { saveSession } from "@/lib/session-store";

export default function DancarPage() {
  return (
    <Page>
      <Header right={<span className="text-sm text-muted">Dança livre</span>} />
      <DanceScreen onFinish={(summary) => void saveSession(summary)} />
    </Page>
  );
}
