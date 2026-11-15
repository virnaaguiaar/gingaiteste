import { describe, expect, it } from "vitest";
import {
  CentroidClassifier,
  DanceSession,
  HEURISTIC_MODEL,
  SYNTHETIC_PROFILES,
  checkPlausibility,
  extractFeatures,
  generateEventCode,
  generateSamples,
  isValidEventCode,
  normalizeEventCode,
  rankParticipants,
  sanitizeNickname,
  seededRandom,
  ARENA_HALF,
  CrowdTracker,
  choreoPose,
  formation,
  idlePose,
  ledFrame,
  MUSIC_STEPS,
  musicHits,
  styleBpm,
  mergeModels,
  type ParticipantScore,
  trainCentroidModel,
  type BuiltinStyle,
  type LabeledFeatures,
  type MotionSample,
} from "./index";

function runSession(samples: MotionSample[], session = new DanceSession()) {
  const results = samples.map((s) => session.push(s)).filter((r) => r !== null);
  return { session, results };
}

describe("extractFeatures", () => {
  it("recupera cadência e intensidade de um sinal sintético, qualquer que seja a orientação", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const f = extractFeatures(generateSamples(SYNTHETIC_PROFILES.forro, 4, { seed }))!;
      expect(f.cadenceHz).toBeGreaterThan(1.7);
      expect(f.cadenceHz).toBeLessThan(2.1);
      expect(f.gravity).toBeGreaterThan(9.3);
      expect(f.gravity).toBeLessThan(10.3);
      expect(f.intensity).toBeGreaterThan(2.5);
      expect(f.intensity).toBeLessThan(4);
      expect(f.periodicity).toBeGreaterThan(0.4);
    }
  });

  it("devolve null com poucas leituras", () => {
    expect(extractFeatures(generateSamples(SYNTHETIC_PROFILES.forro, 0.5))).toBeNull();
  });

  it("celular parado tem intensidade quase zero", () => {
    const f = extractFeatures(generateSamples(SYNTHETIC_PROFILES.parado, 4))!;
    expect(f.intensity).toBeLessThan(0.3);
  });
});

describe("classificador heurístico", () => {
  const clf = new CentroidClassifier(HEURISTIC_MODEL);
  it.each(["forro", "samba", "funk"] as BuiltinStyle[])("reconhece %s sintético", (style) => {
    let hits = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const f = extractFeatures(generateSamples(SYNTHETIC_PROFILES[style], 4, { seed }))!;
      if (clf.classify(f).label === style) hits++;
    }
    expect(hits).toBeGreaterThanOrEqual(8);
  });

  it("probabilidades somam 1", () => {
    const f = extractFeatures(generateSamples(SYNTHETIC_PROFILES.samba, 4))!;
    const p = clf.classify(f).probabilities;
    expect(p.forro! + p.samba! + p.funk!).toBeCloseTo(1, 6);
  });
});

describe("treino de centróides", () => {
  const examples = (style: BuiltinStyle, n: number): LabeledFeatures[] =>
    Array.from({ length: n }, (_, i) => ({
      label: style,
      features: extractFeatures(generateSamples(SYNTHETIC_PROFILES[style], 4, { seed: 100 + i }))!,
    }));

  it("treina e classifica com o modelo treinado", () => {
    const model = trainCentroidModel([...examples("forro", 8), ...examples("funk", 8)]);
    expect(model.source).toBe("trained");
    expect(model.counts).toEqual({ forro: 8, funk: 8 });
    const clf = new CentroidClassifier(model);
    const f = extractFeatures(generateSamples(SYNTHETIC_PROFILES.funk, 4, { seed: 7 }))!;
    expect(clf.classify(f).label).toBe("funk");
  });

  it("recusa dados insuficientes", () => {
    expect(() => trainCentroidModel(examples("forro", 4))).toThrow(/insuficientes/);
    expect(() => trainCentroidModel(examples("forro", 8), 5, 2)).toThrow(/insuficientes/);
  });

  it("aceita um único estilo e aprende estilos novos (ex.: reggae)", () => {
    const reggae = examples("forro", 6).map((e) => ({ ...e, label: "reggae" }));
    const model = trainCentroidModel(reggae);
    expect(Object.keys(model.centroids)).toEqual(["reggae"]);
  });

  it("mergeModels: estilo gravado usa o pessoal; os demais caem no global/heurístico", () => {
    const personal = trainCentroidModel(examples("forro", 8).map((e) => ({ ...e, label: "samba" })));
    const global = { ...HEURISTIC_MODEL, source: "trained" as const, centroids: { funk: [9, 0.9, 200, 3, 0.9], reggae: [2.5, 0.46, 60, 1.2, 0.46] } };
    const merged = mergeModels(HEURISTIC_MODEL, global, personal);
    expect(merged.centroids.samba).toEqual(personal.centroids.samba); // pessoal vence o heurístico
    expect(merged.centroids.funk).toEqual(global.centroids.funk); // global vence o heurístico
    expect(merged.centroids.reggae).toEqual(global.centroids.reggae); // só no global
    expect(merged.centroids.forro).toEqual(HEURISTIC_MODEL.centroids.forro); // só no heurístico
    expect(() => new CentroidClassifier(merged)).not.toThrow();
  });

  it("modelo treinado sobrevive a JSON", () => {
    const model = trainCentroidModel([...examples("forro", 5), ...examples("samba", 5)]);
    expect(() => new CentroidClassifier(JSON.parse(JSON.stringify(model)))).not.toThrow();
  });
});

describe("antifraude", () => {
  it("recusa celular sacudido na mão", () => {
    const f = extractFeatures(generateSamples(SYNTHETIC_PROFILES.sacudindo, 4))!;
    expect(checkPlausibility(f).ok).toBe(false);
  });

  it("aceita dança normal", () => {
    const f = extractFeatures(generateSamples(SYNTHETIC_PROFILES.funk, 4))!;
    expect(checkPlausibility(f)).toEqual({ ok: true });
  });

  it("recusa sensor lento", () => {
    const f = extractFeatures(generateSamples(SYNTHETIC_PROFILES.forro, 4, { hz: 10 }))!;
    expect(checkPlausibility(f).ok).toBe(false);
  });
});

describe("DanceSession", () => {
  it("1 minuto de forró rende pontos, tempo e estilo", () => {
    const { session, results } = runSession(generateSamples(SYNTHETIC_PROFILES.forro, 60));
    const s = session.summary();
    // 1ª janela aos 4 s e depois a cada 2 s
    expect(results.length).toBeGreaterThanOrEqual(27);
    expect(s.danceSeconds).toBeGreaterThan(55);
    expect(s.danceSeconds).toBeLessThanOrEqual(60);
    expect(s.points).toBeGreaterThan(600);
    expect(s.topStyle).toBe("forro");
    expect(s.maxComboMultiplier).toBeGreaterThan(1);
    expect(s.cadenceBpm).toBeGreaterThan(100);
    expect(s.cadenceBpm).toBeLessThan(130);
  });

  it("parado não pontua", () => {
    const { session } = runSession(generateSamples(SYNTHETIC_PROFILES.parado, 30));
    expect(session.summary().points).toBe(0);
    expect(session.summary().topStyle).toBeNull();
  });

  it("sacudir o celular não pontua e registra o motivo", () => {
    const { session } = runSession(generateSamples(SYNTHETIC_PROFILES.sacudindo, 20));
    const s = session.summary();
    expect(s.points).toBe(0);
    expect(s.rejectedWindows).toBeGreaterThan(0);
    expect(s.lastRejectReason).toBeTruthy();
  });

  it("dançar mais forte rende mais pontos que dançar leve", () => {
    const leve = runSession(generateSamples(SYNTHETIC_PROFILES.forro, 30)).session.summary();
    const forte = runSession(generateSamples(SYNTHETIC_PROFILES.funk, 30)).session.summary();
    expect(forte.points).toBeGreaterThan(leve.points);
  });

  it("não paga o tempo em que o sensor ficou sem leituras (tela apagada)", () => {
    const a = generateSamples(SYNTHETIC_PROFILES.samba, 20, { seed: 1 });
    const b = generateSamples(SYNTHETIC_PROFILES.samba, 20, { seed: 2, startT: 120_000 });
    const { session } = runSession([...a, ...b]);
    expect(session.summary().danceSeconds).toBeLessThanOrEqual(40);
  });

  it("ignora leituras fora de ordem", () => {
    const session = new DanceSession();
    session.push({ t: 100, ax: 0, ay: 0, az: 9.8, rx: 0, ry: 0, rz: 0 });
    expect(session.push({ t: 50, ax: 0, ay: 0, az: 9.8, rx: 0, ry: 0, rz: 0 })).toBeNull();
  });
});

describe("eventos", () => {
  it("gera códigos válidos e sem caracteres ambíguos", () => {
    const rand = seededRandom(42);
    for (let i = 0; i < 100; i++) {
      const code = generateEventCode(6, rand);
      expect(code).toHaveLength(6);
      expect(code).not.toMatch(/[01OIL]/);
      expect(isValidEventCode(code)).toBe(true);
    }
  });

  it("normaliza o código digitado", () => {
    expect(normalizeEventCode(" ab-c2 3x ")).toBe("ABC23X");
  });

  it("ordena o ranking com desempate", () => {
    const base = { nickname: "x", topStyle: null };
    const ranked = rankParticipants([
      { ...base, id: "a", points: 10, danceSeconds: 5, updatedAt: 1 },
      { ...base, id: "b", points: 20, danceSeconds: 5, updatedAt: 1 },
      { ...base, id: "c", points: 10, danceSeconds: 9, updatedAt: 1 },
    ]);
    expect(ranked.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("limpa apelidos", () => {
    expect(sanitizeNickname("   Rei   do   Forró  ")).toBe("Rei do Forró");
    expect(sanitizeNickname("x".repeat(50))).toHaveLength(24);
  });
});

describe("baile de robôs", () => {
  const styles = ["forro", "samba", "funk", "reggae", "xaxado"];

  it("robôs ficam sempre dentro do palco", () => {
    for (const style of styles) {
      for (let n = 1; n <= 10; n++) {
        for (let t = 0; t < 40; t += 0.25) {
          const poses = Array.from({ length: n }, (_, i) => choreoPose(style, i, n, t));
          for (const p of poses) {
            expect(Math.abs(p.x)).toBeLessThanOrEqual(ARENA_HALF);
            expect(Math.abs(p.z)).toBeLessThanOrEqual(ARENA_HALF);
            expect(Number.isFinite(p.heading)).toBe(true);
          }
        }
      }
    }
  });

  it("robôs não se sobrepõem (distância mínima entre centros)", () => {
    for (const style of [...styles, null]) {
      for (let n = 2; n <= 10; n++) {
        for (let t = 0; t < 64; t += 0.1) {
          const poses = Array.from({ length: n }, (_, i) => choreoPose(style, i, n, t));
          for (let a = 0; a < n; a++)
            for (let b = a + 1; b < n; b++) {
              const d = Math.hypot(poses[a]!.x - poses[b]!.x, poses[a]!.z - poses[b]!.z);
              expect(d, `${style} n=${n} t=${t.toFixed(1)} ${a}-${b}`).toBeGreaterThanOrEqual(0.8);
            }
        }
      }
    }
  });

  it("estilos diferentes geram movimentos diferentes; parado não se move", () => {
    const at = (style: string | null) => choreoPose(style, 0, 4, 3.3);
    expect(at("samba")).not.toEqual(at("funk"));
    expect(at("forro")).not.toEqual(at("reggae"));
    expect(at(null)).toEqual(idlePose(0, 4));
    expect(choreoPose(null, 0, 4, 1)).toEqual(choreoPose(null, 0, 4, 99));
  });

  it("formação tem um lugar por robô", () => {
    for (let n = 0; n <= 10; n++) expect(formation(n).slots).toHaveLength(n);
  });

  it("luzes: 6 LEDs com valores válidos", () => {
    for (const style of [null, ...styles]) {
      const f = ledFrame(style, 2, 1.7);
      expect(f.hues).toHaveLength(6);
      expect(f.level).toBeGreaterThanOrEqual(0);
      expect(f.level).toBeLessThanOrEqual(1);
    }
  });

  const score = (id: string, currentStyle: string | null, updatedAt: number): ParticipantScore => ({
    id, nickname: id, points: 0, danceSeconds: 0, topStyle: null, currentStyle, updatedAt,
  });

  it("maioria manda; empate mantém o estilo anterior; parar faz os robôs pararem", () => {
    const c = new CrowdTracker(8000);
    c.observe([score("a", "forro", 1000), score("b", "forro", 1000), score("c", "samba", 1000)], 1000);
    expect(c.mood(1000).style).toBe("forro");

    // Todos mudam de estilo: agora é 2×2 → mantém forró.
    c.observe([score("a", "forro", 2000), score("b", "samba", 2000), score("c", "samba", 2000), score("d", "forro", 2000)], 2000);
    expect(c.mood(2000).style).toBe("forro");

    // Samba passa a maioria.
    c.observe([score("a", "samba", 3000), score("b", "samba", 3000), score("c", "samba", 3000), score("d", "forro", 3000)], 3000);
    expect(c.mood(3000).style).toBe("samba");

    // Todos param de dançar (currentStyle null).
    c.observe([score("a", null, 4000), score("b", null, 4000), score("c", null, 4000), score("d", null, 4000)], 4000);
    expect(c.mood(4000)).toMatchObject({ style: null, dancers: 0, total: 4 });
  });

  it("quem some (sem novas atualizações) deixa de contar; relógio do celular não importa", () => {
    const c = new CrowdTracker(8000);
    // updatedAt do celular está 1 hora atrasado, mas muda a cada publicação.
    c.observe([score("a", "funk", 100)], 50_000);
    expect(c.mood(50_000).style).toBeNull(); // primeira leitura com marca antiga = não conta
    c.observe([score("a", "funk", 102)], 52_000);
    expect(c.mood(52_000).style).toBe("funk");
    expect(c.mood(61_000).style).toBeNull(); // 9 s sem atualizar
  });
});

describe("música do baile de robôs", () => {
  const styles = ["forro", "samba", "funk", "reggae", "xaxado"];

  it("cada estilo tem batida e baixo/harmonia em todo o ciclo, com valores válidos", () => {
    for (const style of styles) {
      let rhythm = 0;
      let tonal = 0;
      for (let step = 0; step < MUSIC_STEPS; step++) {
        for (const h of musicHits(style, step)) {
          expect(h.velocity).toBeGreaterThan(0);
          expect(h.velocity).toBeLessThanOrEqual(1);
          if (h.notes) {
            tonal++;
            for (const n of h.notes) expect(n).toBeGreaterThanOrEqual(30), expect(n).toBeLessThanOrEqual(90);
            expect(h.steps ?? 1).toBeGreaterThan(0);
          } else rhythm++;
        }
      }
      expect(rhythm, style).toBeGreaterThan(8);
      expect(tonal, style).toBeGreaterThan(8);
    }
  });

  it("é determinística, cíclica e diferente entre estilos", () => {
    expect(musicHits("samba", 5)).toEqual(musicHits("samba", 5 + MUSIC_STEPS));
    const sig = (st: string) => JSON.stringify(Array.from({ length: 16 }, (_, i) => musicHits(st, i)));
    expect(new Set(styles.map(sig)).size).toBe(styles.length);
  });

  it("andamento da música é o da coreografia", () => {
    expect(styleBpm("forro")).toBe(120);
    expect(styleBpm("reggae")).toBe(76);
    expect(styleBpm("xaxado")).toBe(100);
  });
});
