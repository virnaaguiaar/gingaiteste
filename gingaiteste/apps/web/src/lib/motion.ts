import type { MotionSample } from "@gingai/core";

export type PermissionResult = "granted" | "denied" | "unsupported" | "insecure";

type DeviceMotionWithPermission = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

/**
 * Pede acesso aos sensores. No iOS isso PRECISA ser a primeira coisa chamada dentro
 * de um toque do usuário, e a página precisa estar em HTTPS.
 */
export async function requestMotionPermission(): Promise<PermissionResult> {
  if (typeof window === "undefined" || !("DeviceMotionEvent" in window)) return "unsupported";
  if (!window.isSecureContext) return "insecure";
  const DME = DeviceMotionEvent as DeviceMotionWithPermission;
  if (typeof DME.requestPermission === "function") {
    try {
      return await DME.requestPermission();
    } catch {
      return "denied";
    }
  }
  return "granted";
}

/** Assina o acelerômetro + giroscópio do navegador. Devolve a função para parar. */
export function startWebMotion(onSample: (s: MotionSample) => void): () => void {
  const handler = (e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x === null || a.y === null || a.z === null) return;
    const r = e.rotationRate;
    onSample({
      t: performance.now(),
      ax: a.x,
      ay: a.y,
      az: a.z,
      rx: r?.alpha ?? 0,
      ry: r?.beta ?? 0,
      rz: r?.gamma ?? 0,
    });
  };
  window.addEventListener("devicemotion", handler);
  return () => window.removeEventListener("devicemotion", handler);
}

export function wakeLockSupported(): boolean {
  return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

/** Mantém a tela acesa (o navegador pausa os sensores quando a tela apaga). */
export function keepScreenOn(): () => void {
  let sentinel: WakeLockSentinel | null = null;
  let active = true;
  const acquire = async () => {
    if (!wakeLockSupported() || document.visibilityState !== "visible") return;
    try {
      sentinel = await navigator.wakeLock.request("screen");
    } catch {
      // Recusado (bateria fraca, aba em segundo plano...). A sessão continua.
    }
  };
  const onVisibility = () => {
    if (active && document.visibilityState === "visible") void acquire();
  };
  void acquire();
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    active = false;
    document.removeEventListener("visibilitychange", onVisibility);
    void sentinel?.release();
  };
}
