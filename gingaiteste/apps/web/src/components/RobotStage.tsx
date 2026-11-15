"use client";

import { ARENA_HALF, LEDS_PER_ROBOT, choreoPose, idlePose, ledFrame, type RobotPose } from "@gingai/core";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const TAU = Math.PI * 2;

// Dimensões do robô (mesmas proporções das fotos: cúpula branca, rodas amarelas e pretas).
const R = 0.38; // raio da cúpula
const AXLE_Y = 0.17; // altura do eixo das rodas
const WHEEL_R = 0.17;
const HALF_TRACK = R + 0.1;
const DOME_CUT = 0.34; // abertura no topo (rad): mostra o disco amarelo dos LEDs
const DOME_Y = 0.22;
const MIX_SECONDS = 0.9; // tempo da transição entre coreografias / parar

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const easeInOut = (u: number) => (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u));

interface Robot {
  group: THREE.Group;
  body: THREE.Group;
  wheelL: THREE.Group;
  wheelR: THREE.Group;
  ledMats: THREE.MeshStandardMaterial[];
  light: THREE.PointLight;
  glow: THREE.Mesh;
  glowMat: THREE.MeshBasicMaterial;
  // Estado da animação
  cur: RobotPose;
  from: RobotPose;
  mix: number;
  wheelAngleL: number;
  wheelAngleR: number;
}

interface Stage {
  /** Relógio da coreografia (segundos): a música usa para cair na batida dos robôs. */
  getTime(): number;
  setCount(n: number): void;
  setStyle(style: string | null): void;
  dispose(): void;
}

function makeGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function makeNumberTexture(n: number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 96;
  c.height = 112;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f5c800";
  g.fillRect(0, 0, 96, 112);
  g.fillStyle = "#2a2410";
  g.font = "bold 80px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(n), 48, 60);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createStage(container: HTMLElement): Stage {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearAlpha(0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.display = "block";

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);

  // Luz: ambiente fria + uma luz principal que faz as sombras.
  scene.add(new THREE.HemisphereLight(0xffd6ea, 0x2b0f1f, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 8, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -6;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -6;
  scene.add(key);

  // Palco.
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x3a1428, roughness: 0.35, metalness: 0.25 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(ARENA_HALF + 0.9, 96), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xf62681 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(ARENA_HALF + 1.3, ARENA_HALF + 0.9, 96), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.002;
  scene.add(ring);
  const grid = new THREE.GridHelper(ARENA_HALF * 2, 16, 0x6b2348, 0x4a1832);
  grid.position.y = 0.003;
  scene.add(grid);

  // Geometrias e materiais compartilhados entre os robôs.
  const domeGeo = new THREE.SphereGeometry(R, 48, 24, 0, TAU, DOME_CUT, Math.PI / 2 - DOME_CUT);
  const lipGeo = new THREE.CylinderGeometry(R * 1.05, R * 1.05, 0.05, 48);
  const hullGeo = new THREE.CylinderGeometry(R * 0.95, R * 0.88, 0.1, 48);
  const discR = R * Math.sin(DOME_CUT) * 0.98;
  const discGeo = new THREE.CylinderGeometry(discR, discR, 0.02, 32);
  const ledGeo = new THREE.SphereGeometry(0.024, 12, 12);
  const mountGeo = new THREE.BoxGeometry(0.12, 0.09, 0.1);
  const tireGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.09, 28);
  const hubGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.096, 20);
  const treadGeo = new THREE.BoxGeometry(0.098, 0.032, 0.05);
  const glowGeo = new THREE.PlaneGeometry(1.9, 1.9);
  const plateGeo = new THREE.PlaneGeometry(0.12, 0.14);
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.55, side: THREE.DoubleSide });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xf5c800, roughness: 0.5 });
  const black = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
  const glowTex = makeGlowTexture();
  const numberTextures: THREE.CanvasTexture[] = [];

  const treads = 14;

  function makeWheel(side: 1 | -1): THREE.Group {
    const wheel = new THREE.Group();
    const spin = new THREE.Group(); // gira em torno do eixo X
    const tire = new THREE.Mesh(tireGeo, black);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    const hub = new THREE.Mesh(hubGeo, yellow);
    hub.rotation.z = Math.PI / 2;
    spin.add(tire, hub);
    for (let k = 0; k < treads; k++) {
      const a = (TAU * k) / treads;
      const tread = new THREE.Mesh(treadGeo, black);
      tread.position.set(0, Math.sin(a) * (WHEEL_R + 0.008), Math.cos(a) * (WHEEL_R + 0.008));
      tread.rotation.x = Math.PI / 2 - a;
      spin.add(tread);
    }
    wheel.add(spin);
    wheel.position.set(side * HALF_TRACK, AXLE_Y, 0);
    return wheel;
  }

  function makeRobot(index: number): Robot {
    const group = new THREE.Group();
    const body = new THREE.Group();

    const dome = new THREE.Mesh(domeGeo, white);
    dome.position.y = DOME_Y;
    dome.castShadow = true;
    const lip = new THREE.Mesh(lipGeo, white);
    lip.position.y = DOME_Y;
    const hull = new THREE.Mesh(hullGeo, white);
    hull.position.y = DOME_Y - 0.07;
    const topY = DOME_Y + R * Math.cos(DOME_CUT);
    const disc = new THREE.Mesh(discGeo, yellow);
    disc.position.y = topY - 0.02;
    body.add(dome, lip, hull, disc);

    // 6 LEDs RGB no disco amarelo do topo.
    const ledMats: THREE.MeshStandardMaterial[] = [];
    for (let k = 0; k < LEDS_PER_ROBOT; k++) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 1 });
      ledMats.push(mat);
      const a = (TAU * k) / LEDS_PER_ROBOT;
      const led = new THREE.Mesh(ledGeo, mat);
      led.position.set(Math.cos(a) * discR * 0.68, topY, Math.sin(a) * discR * 0.68);
      body.add(led);
    }
    const light = new THREE.PointLight(0xffffff, 0, 3, 2);
    light.position.set(0, topY + 0.35, 0);
    body.add(light);

    // Janelinha amarela com o número do robô, na frente (+z).
    const tex = makeNumberTexture(index + 1);
    numberTextures.push(tex);
    const plate = new THREE.Mesh(plateGeo, new THREE.MeshBasicMaterial({ map: tex }));
    const phi = 1.0; // ângulo a partir do topo
    plate.position.set(0, DOME_Y + R * Math.cos(phi) * 1.01, R * Math.sin(phi) * 1.01);
    // Gira a placa para olhar para fora, acompanhando a curva da cúpula.
    plate.lookAt(plate.position.x, plate.position.y + Math.cos(phi) * 2, plate.position.z + Math.sin(phi) * 2);
    body.add(plate);

    for (const side of [1, -1] as const) {
      const mount = new THREE.Mesh(mountGeo, yellow);
      mount.position.set(side * (R + 0.02), AXLE_Y - 0.01, 0);
      body.add(mount);
    }

    const wheelL = makeWheel(1);
    const wheelR = makeWheel(-1);
    group.add(body, wheelL, wheelR);

    // Brilho colorido no chão (a "luz" dos LEDs).
    const glowMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.01;
    group.add(glow);

    group.traverse((o) => {
      if (o instanceof THREE.Mesh && o !== glow) o.castShadow = true;
    });

    const start = idlePose(0, 1);
    return {
      group, body, wheelL, wheelR, ledMats, light, glow, glowMat,
      cur: { ...start }, from: { ...start }, mix: 1, wheelAngleL: 0, wheelAngleR: 0,
    };
  }

  const robots: Robot[] = [];
  let style: string | null = null;
  let disposed = false;
  let elapsed = 0;

  function snapshotFrom(r: Robot) {
    r.from = { ...r.cur };
    r.mix = 0;
  }

  const stage: Stage = {
    getTime: () => elapsed,
    setCount(n) {
      const target = Math.max(0, Math.min(10, Math.round(n)));
      while (robots.length > target) {
        const r = robots.pop()!;
        scene.remove(r.group);
        r.ledMats.forEach((m) => m.dispose());
        r.glowMat.dispose();
        r.group.traverse((o) => {
          if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshBasicMaterial && o.material.map !== glowTex) {
            o.material.dispose();
          }
        });
      }
      while (robots.length < target) {
        const r = makeRobot(robots.length);
        scene.add(r.group);
        robots.push(r);
      }
      // A formação muda com a quantidade: todos deslizam para o novo lugar.
      robots.forEach(snapshotFrom);
    },
    setStyle(next) {
      if (next === style) return;
      style = next;
      robots.forEach(snapshotFrom);
    },
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      stage.setCount(0);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => m.dispose());
        }
      });
      [white, yellow, black].forEach((m) => m.dispose());
      [domeGeo, lipGeo, hullGeo, discGeo, ledGeo, mountGeo, tireGeo, hubGeo, treadGeo, glowGeo, plateGeo].forEach((g) => g.dispose());
      glowTex.dispose();
      numberTextures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };

  const resize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    camera.aspect = w / h;
    // Em telas estreitas (retrato) afasta a câmera para o palco caber inteiro.
    const dist = camera.aspect < 1.2 ? 12 : 9;
    camera.position.set(0, dist * 0.62, dist * 0.8);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  let lastMs = performance.now();
  const color = new THREE.Color();
  renderer.setAnimationLoop(() => {
    if (disposed) return;
    const nowMs = performance.now();
    const dt = Math.min((nowMs - lastMs) / 1000, 0.1);
    lastMs = nowMs;
    elapsed += dt;
    const t = elapsed;
    const n = robots.length;

    robots.forEach((r, i) => {
      const target = style ? choreoPose(style, i, n, t) : idlePose(i, n);
      r.mix = Math.min(1, r.mix + dt / MIX_SECONDS);
      const e = easeInOut(r.mix);
      const prev = r.cur;
      const next: RobotPose =
        r.mix >= 1
          ? target
          : {
              x: r.from.x + (target.x - r.from.x) * e,
              z: r.from.z + (target.z - r.from.z) * e,
              heading: r.from.heading + wrapAngle(target.heading - r.from.heading) * e,
              tilt: r.from.tilt + (target.tilt - r.from.tilt) * e,
            };

      // As rodas giram de acordo com o deslocamento real (anda + gira).
      const dx = next.x - prev.x;
      const dz = next.z - prev.z;
      const dh = wrapAngle(next.heading - prev.heading);
      const fwd = dx * Math.sin(next.heading) + dz * Math.cos(next.heading);
      r.wheelAngleL += (fwd - dh * HALF_TRACK) / WHEEL_R;
      r.wheelAngleR += (fwd + dh * HALF_TRACK) / WHEEL_R;
      (r.wheelL.children[0] as THREE.Group).rotation.x = r.wheelAngleL;
      (r.wheelR.children[0] as THREE.Group).rotation.x = r.wheelAngleR;

      r.cur = next;
      r.group.position.set(next.x, 0, next.z);
      r.group.rotation.y = next.heading;
      r.body.rotation.x = next.tilt;

      const led = ledFrame(style, i, t);
      for (let k = 0; k < r.ledMats.length; k++) {
        color.setHSL((led.hues[k] ?? 0) / 360, led.sat, 0.5);
        r.ledMats[k]!.color.copy(color).multiplyScalar(0.3);
        r.ledMats[k]!.emissive.copy(color);
        r.ledMats[k]!.emissiveIntensity = 0.2 + led.level * 2.4;
      }
      color.setHSL((led.hues[0] ?? 0) / 360, led.sat, 0.55);
      r.light.color.copy(color);
      r.light.intensity = led.level * 2.2;
      r.glowMat.color.copy(color);
      r.glowMat.opacity = led.level * 0.55;
    });

    // Câmera com um balanço lento, para dar sensação de profundidade.
    const sway = Math.sin(t * 0.12) * 1.4;
    camera.position.x = sway;
    camera.lookAt(0, 0.2, 0);
    renderer.render(scene, camera);
  });

  return stage;
}

/**
 * Palco 3D do "Baile de robôs": `count` robôs-carrinho (cúpula branca, rodas amarelas,
 * 6 LEDs RGB no topo) dançando a coreografia de `style`; com `style` nulo ficam parados.
 */
export function RobotStage({
  count,
  style,
  onClock,
}: {
  count: number;
  style: string | null;
  /** Recebe o relógio da coreografia (ou null ao desmontar). */
  onClock?: (getTime: (() => number) | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let stage: Stage;
    try {
      stage = createStage(el);
    } catch {
      // Sem WebGL (ex.: navegador antigo ou aceleração desligada).
      const id = setTimeout(() => setFailed(true), 0);
      return () => clearTimeout(id);
    }
    stageRef.current = stage;
    onClock?.(stage.getTime);
    return () => {
      onClock?.(null);
      stage.dispose();
      stageRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- o palco é criado uma única vez
  }, []);

  useEffect(() => {
    stageRef.current?.setCount(count);
  }, [count]);

  useEffect(() => {
    stageRef.current?.setStyle(style);
  }, [style]);

  if (failed) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-muted">
        Este navegador não conseguiu iniciar o 3D (WebGL). Tente outro navegador ou ative a
        aceleração de hardware.
      </div>
    );
  }
  return <div ref={containerRef} className="h-full w-full" />;
}
