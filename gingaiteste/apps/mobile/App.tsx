import {
  DANCE_STYLES,
  labelInfo,
  formatDuration,
  formatPoints,
  styleName,
} from '@gingai/core';
import { StatusBar } from 'expo-status-bar';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PocketMode } from './src/PocketMode';
import { colors } from './src/theme';
import { useDanceSession } from './src/useDanceSession';

type SimLabel = (typeof DANCE_STYLES)[number] | 'parado';

const SIM_LABELS: SimLabel[] = [...DANCE_STYLES, 'parado'];

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.logo}>
            Ging<Text style={{ color: colors.brand }}>AI</Text>
          </Text>
          <DanceScreen />
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function DanceScreen() {
  const { status, snapshot, summary, error, start, stop, reset } = useDanceSession();
  const [pocket, setPocket] = useState(false);
  const [simulate, setSimulate] = useState(false);
  const [simLabel, setSimLabel] = useState<SimLabel>('forro');

  if (status === 'idle' || status === 'starting' || status === 'error') {
    return (
      <View style={styles.gap}>
        <Text style={styles.title}>
          Dance e <Text style={{ color: colors.brand }}>marque pontos</Text>
        </Text>
        <Card>
          <Text style={styles.h2}>Como funciona</Text>
          <Text style={styles.muted}>1. Toque em “Começar a dançar”.</Text>
          <Text style={styles.muted}>2. Ative o modo bolso e guarde o celular no bolso da frente.</Text>
          <Text style={styles.muted}>3. Dance! A tela fica escura e não aceita toques.</Text>
        </Card>
        {error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.row}>
          <Switch value={simulate} onValueChange={setSimulate} trackColor={{ true: colors.brand }} />
          <Text style={styles.muted}>Simular movimento (simulador/teste)</Text>
        </View>
        {simulate && (
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            {SIM_LABELS.map((l) => (
              <Chip key={l} active={simLabel === l} onPress={() => setSimLabel(l)}>
                {labelInfo(l).emoji} {labelInfo(l).name}
              </Chip>
            ))}
          </View>
        )}
        <BigButton
          disabled={status === 'starting'}
          onPress={() => void start(simulate ? simLabel : undefined)}
        >
          {status === 'starting' ? 'Ligando sensores…' : 'Começar a dançar'}
        </BigButton>
      </View>
    );
  }

  const snap = snapshot!;

  if (status === 'ended' && summary) {
    return (
      <View style={styles.gap}>
        <Card center>
          <Text style={styles.muted}>FIM DA SESSÃO</Text>
          <Text style={styles.points}>{formatPoints(summary.points)}</Text>
          <Text style={styles.muted}>pontos</Text>
          <View style={styles.stats}>
            <Stat label="dançando" value={formatDuration(summary.danceSeconds)} />
            <Stat label="combo máx." value={`x${summary.maxComboMultiplier.toFixed(2)}`} />
            <Stat label="estilo" value={summary.topStyle ? labelInfo(summary.topStyle).emoji : '—'} />
          </View>
          {summary.topStyle && (
            <Text style={[styles.muted, { marginTop: 12, textAlign: 'center' }]}>
              Seu ritmo pareceu mais com {styleName(summary.topStyle)} (beta)
            </Text>
          )}
        </Card>
        <BigButton onPress={reset}>Dançar de novo</BigButton>
      </View>
    );
  }

  return (
    <View style={styles.gap}>
      <PocketMode visible={pocket} points={snap.points} onExit={() => setPocket(false)} />
      <Card center>
        <Text style={styles.points}>{formatPoints(snap.points)}</Text>
        <Text style={styles.muted}>pontos</Text>
        <Text style={styles.styleChip}>
          {snap.style
            ? `${labelInfo(snap.style).emoji} ${styleName(snap.style)} ${Math.round(snap.confidence * 100)}%`
            : snap.elapsedSeconds < 4
              ? 'Analisando…'
              : 'Parado — bora dançar!'}
        </Text>
        <View style={styles.stats}>
          <Stat label="tempo" value={formatDuration(snap.elapsedSeconds)} />
          <Stat label="BPM" value={snap.cadenceBpm ? String(snap.cadenceBpm) : '—'} />
          <Stat label="combo" value={`x${snap.comboMultiplier.toFixed(2)}`} />
        </View>
        <View style={styles.bar}>
          <View
            style={[styles.barFill, { width: `${Math.min(100, (snap.intensity / 6) * 100)}%` }]}
          />
        </View>
        <Text style={[styles.muted, { fontSize: 12 }]}>intensidade</Text>
        {snap.rejectedNow && <Text style={styles.warn}>⚠️ {snap.lastRejectReason}</Text>}
      </Card>
      <View style={styles.row}>
        <BigButton secondary style={{ flex: 1 }} onPress={() => setPocket(true)}>
          🌙 Modo bolso
        </BigButton>
        <BigButton
          secondary
          style={{ flex: 1 }}
          onPress={() => {
            setPocket(false);
            stop();
          }}
        >
          ⏹ Parar
        </BigButton>
      </View>
    </View>
  );
}

function Card({ children, center }: { children: ReactNode; center?: boolean }) {
  return <View style={[styles.card, center && { alignItems: 'center' }]}>{children}</View>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={[styles.muted, { fontSize: 12 }]}>{label}</Text>
    </View>
  );
}

function Chip({ children, active, onPress }: { children: ReactNode; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && { backgroundColor: colors.brand }]}>
      <Text style={styles.chipText}>{children}</Text>
    </Pressable>
  );
}

function BigButton({
  children,
  onPress,
  disabled,
  secondary,
  style,
}: {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  style?: object;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: secondary ? colors.surface2 : colors.brand },
        (pressed || disabled) && { opacity: 0.7 },
        style,
      ]}
    >
      <Text style={styles.buttonText}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, gap: 20 },
  gap: { gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { color: colors.foreground, fontSize: 28, fontWeight: '900' },
  title: { color: colors.foreground, fontSize: 40, fontWeight: '900', textAlign: 'center' },
  h2: { color: colors.foreground, fontSize: 18, fontWeight: '700', marginBottom: 6 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  error: { color: colors.brand, backgroundColor: '#f6268120', padding: 14, borderRadius: 16 },
  warn: { color: colors.brand2, fontSize: 12, marginTop: 10 },
  card: { backgroundColor: colors.surface, borderRadius: 24, padding: 20 },
  points: {
    color: colors.brand2,
    fontSize: 72,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  styleChip: {
    color: colors.foreground,
    backgroundColor: colors.surface2,
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: 14,
    fontSize: 16,
    fontWeight: '600',
  },
  stats: { flexDirection: 'row', gap: 8, marginTop: 18, alignSelf: 'stretch' },
  stat: { flex: 1, backgroundColor: colors.surface2, borderRadius: 16, paddingVertical: 12, alignItems: 'center' },
  statValue: { color: colors.foreground, fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  bar: {
    height: 8,
    alignSelf: 'stretch',
    backgroundColor: colors.surface2,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 16,
    marginBottom: 4,
  },
  barFill: { height: '100%', backgroundColor: colors.brand },
  chip: { backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { color: colors.foreground, fontWeight: '600' },
  button: { borderRadius: 18, paddingVertical: 18, paddingHorizontal: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '800' },
});
