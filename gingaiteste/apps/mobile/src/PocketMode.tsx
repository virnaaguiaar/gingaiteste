import { formatPoints } from '@gingai/core';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';

/**
 * Tela preta que ignora toques acidentais no bolso. Sai segurando 2 s.
 * A tela fica acesa (keep-awake). Na fase seguinte, o app nativo vai poder
 * ler os sensores com a tela apagada (serviço em primeiro plano no Android).
 */
export function PocketMode({
  visible,
  points,
  onExit,
}: {
  visible: boolean;
  points: number;
  onExit: () => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <Pressable style={styles.overlay} delayLongPress={2000} onLongPress={onExit}>
        <Text style={styles.points}>{formatPoints(points)}</Text>
        <Text style={styles.hint}>pontos</Text>
        <Text style={styles.unlock}>Segure 2 s para desbloquear</Text>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  points: { color: '#404040', fontSize: 52, fontWeight: '800', fontVariant: ['tabular-nums'] },
  hint: { color: '#262626', marginTop: 4 },
  unlock: { position: 'absolute', bottom: 64, color: '#404040', fontSize: 12 },
});
