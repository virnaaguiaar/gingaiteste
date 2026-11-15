"use client";

import { styleBpm } from "@gingai/core";
import mqtt, { type MqttClient } from "mqtt";

// Ponte com os carrinhos do Baile 10D: publica no mesmo broker e no mesmo tópico
// que o site do baile usa. Os carrinhos entendem:
//   DN0EST<estilo>,<bpm>,<t0>   dançar a partir de t0 (ms desde 1970, UTC)
//   DN0EST-                     parar
// Sem NEXT_PUBLIC_MQTT_URL no .env, nada é enviado e o resto do app funciona igual.

const TOPICO = "cmd";
let client: MqttClient | null = null;

function conectar(): MqttClient | null {
  const url = process.env.NEXT_PUBLIC_MQTT_URL;
  if (!url) return null;
  client ??= mqtt.connect(url, {
    username: process.env.NEXT_PUBLIC_MQTT_USER,
    password: process.env.NEXT_PUBLIC_MQTT_PASSWORD,
    clientId: `gingaiteste_${Math.random().toString(16).slice(2, 8)}`,
    reconnectPeriod: 5000,
  });
  return client;
}

export function robosConfigurados(): boolean {
  return !!process.env.NEXT_PUBLIC_MQTT_URL;
}

/** Manda os carrinhos dançarem `style` a partir de `t0`. `style` nulo manda parar. */
export function enviarEstilo(style: string | null, t0: number) {
  const c = conectar();
  if (!c) return;
  const cmd = style ? `DN0EST${style},${styleBpm(style)},${t0}` : "DN0EST-";
  c.publish(TOPICO, cmd, { qos: 0 });
}

/** Ao sair da página: manda parar, se já estava conectado, e fecha a conexão. */
export function desconectarRobos() {
  if (!client) return;
  if (client.connected) client.publish(TOPICO, "DN0EST-");
  client.end();
  client = null;
}
