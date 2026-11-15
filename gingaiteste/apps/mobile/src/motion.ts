import {
  SYNTHETIC_PROFILES,
  createSyntheticSource,
  type MotionSample,
} from '@gingai/core';
import { DeviceMotion } from 'expo-sensors';

export type MotionPermission = 'granted' | 'denied' | 'unavailable';

/** ~50 Hz: suficiente para cadências até 4 Hz e econômico de bateria. */
const INTERVAL_MS = 20;

export async function requestMotion(): Promise<MotionPermission> {
  if (!(await DeviceMotion.isAvailableAsync())) return 'unavailable';
  const { granted } = await DeviceMotion.requestPermissionsAsync();
  return granted ? 'granted' : 'denied';
}

/** Assina o DeviceMotion do aparelho. Devolve a função para parar. */
export function startDeviceMotion(onSample: (s: MotionSample) => void): () => void {
  DeviceMotion.setUpdateInterval(INTERVAL_MS);
  const sub = DeviceMotion.addListener((m) => {
    const a = m.accelerationIncludingGravity;
    if (!a) return;
    const r = m.rotationRate;
    onSample({
      t: performance.now(),
      ax: a.x,
      ay: a.y,
      az: a.z,
      rx: r?.alpha ?? 0,
      ry: r?.beta ?? 0,
      rz: r?.gamma ?? 0,
    });
  });
  return () => sub.remove();
}

/** Movimento sintético, para o simulador (que não tem sensores reais). */
export function startSimulatedMotion(
  label: keyof typeof SYNTHETIC_PROFILES,
  onSample: (s: MotionSample) => void,
): () => void {
  const next = createSyntheticSource(SYNTHETIC_PROFILES[label], Math.floor(Math.random() * 1e9));
  let t = performance.now();
  const id = setInterval(() => {
    const now = performance.now();
    while (t < now) {
      onSample(next(t));
      t += INTERVAL_MS;
    }
  }, 100);
  return () => clearInterval(id);
}
