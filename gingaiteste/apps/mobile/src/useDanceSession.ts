import {
  SYNTHETIC_PROFILES,
  DanceSession,
  type SessionSnapshot,
  type SessionSummary,
} from '@gingai/core';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useRef, useState } from 'react';
import { requestMotion, startDeviceMotion, startSimulatedMotion } from './motion';

export type SessionStatus = 'idle' | 'starting' | 'running' | 'ended' | 'error';

const KEEP_AWAKE_TAG = 'gingai-dance';
const NO_DATA_TIMEOUT_MS = 2500;

export function useDanceSession() {
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<DanceSession | null>(null);
  const cleanups = useRef<(() => void)[]>([]);

  const teardown = useCallback(() => {
    cleanups.current.forEach((fn) => fn());
    cleanups.current = [];
  }, []);
  useEffect(() => teardown, [teardown]);

  const start = useCallback(
    async (simulate?: keyof typeof SYNTHETIC_PROFILES) => {
      teardown();
      setError(null);
      setStatus('starting');
      if (!simulate) {
        const permission = await requestMotion();
        if (permission !== 'granted') {
          setStatus('error');
          setError(
            permission === 'denied'
              ? 'Permissão dos sensores negada. Libere em Ajustes para o GingAI.'
              : 'Sensores de movimento indisponíveis neste aparelho. Use a simulação.',
          );
          return;
        }
      }

      const session = new DanceSession();
      sessionRef.current = session;
      let gotData = false;
      const onSample = (s: Parameters<DanceSession['push']>[0]) => {
        gotData = true;
        session.push(s);
      };
      cleanups.current.push(simulate ? startSimulatedMotion(simulate, onSample) : startDeviceMotion(onSample));

      await activateKeepAwakeAsync(KEEP_AWAKE_TAG);
      cleanups.current.push(() => void deactivateKeepAwake(KEEP_AWAKE_TAG));

      const tick = setInterval(() => setSnapshot(session.snapshot()), 250);
      cleanups.current.push(() => clearInterval(tick));

      const watchdog = setTimeout(() => {
        if (gotData) return;
        teardown();
        setStatus('error');
        setError('Nenhuma leitura do sensor chegou. Use a simulação para testar.');
      }, NO_DATA_TIMEOUT_MS);
      cleanups.current.push(() => clearTimeout(watchdog));

      setSnapshot(session.snapshot());
      setStatus('running');
    },
    [teardown],
  );

  const stop = useCallback(() => {
    teardown();
    const session = sessionRef.current;
    sessionRef.current = null;
    if (!session) return;
    const result = session.summary();
    setSummary(result);
    setSnapshot(result);
    setStatus('ended');
  }, [teardown]);

  const reset = useCallback(() => {
    teardown();
    setStatus('idle');
    setSnapshot(null);
    setSummary(null);
    setError(null);
  }, [teardown]);

  return { status, snapshot, summary, error, start, stop, reset };
}
