import { Suspense } from "react";
import { RobotBall } from "./RobotBall";

export default function RobotBallPage({ params }: PageProps<"/e/[codigo]/robos">) {
  return (
    <Suspense fallback={<p className="p-10 text-muted">Carregando baile de robôs…</p>}>
      {params.then(({ codigo }) => (
        <RobotBall code={codigo} />
      ))}
    </Suspense>
  );
}
