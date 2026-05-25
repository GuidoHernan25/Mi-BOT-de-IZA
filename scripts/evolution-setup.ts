import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../src/config/env.js";

const webhookUrl = process.argv[2] ?? "http://host.docker.internal:3000/webhooks/evolution";
const outputPath = path.resolve("outputs", "evolution-qr.png");

async function main() {
  await ensureEvolutionIsUp();
  const createResponse = await createOrConnectInstance();
  const qr = getQrBase64(createResponse) ?? (await fetchQrBase64());

  if (!qr) {
    console.log("Instancia creada/conectada, pero Evolution no devolvio QR. Puede que ya este conectada.");
  } else {
    await saveQr(qr);
    console.log(`QR guardado en: ${outputPath}`);
  }

  console.log(`Webhook configurado: ${webhookUrl}`);
  console.log(`Instancia: ${env.EVOLUTION_INSTANCE_NAME}`);
}

async function ensureEvolutionIsUp() {
  const response = await fetch(env.EVOLUTION_API_URL);
  if (!response.ok) {
    throw new Error(`Evolution API no responde OK en ${env.EVOLUTION_API_URL}: ${response.status}`);
  }
}

async function createOrConnectInstance() {
  const body = {
    instanceName: env.EVOLUTION_INSTANCE_NAME,
    integration: "WHATSAPP-BAILEYS",
    qrcode: true,
    webhook: {
      enabled: true,
      url: webhookUrl,
      webhook_by_events: false,
      webhook_base64: false,
      events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
    },
  };

  const response = await evolutionFetch("/instance/create", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (response.ok) return response.json();

  const errorText = await response.text();

  if (response.status === 403 || response.status === 409 || errorText.toLowerCase().includes("already")) {
    return connectInstance();
  }

  throw new Error(`No se pudo crear instancia: ${response.status} ${errorText}`);
}

async function connectInstance() {
  const response = await evolutionFetch(`/instance/connect/${env.EVOLUTION_INSTANCE_NAME}`);
  if (!response.ok) {
    throw new Error(`No se pudo conectar instancia: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function fetchQrBase64() {
  const response = await evolutionFetch(`/instance/connect/${env.EVOLUTION_INSTANCE_NAME}`);
  if (!response.ok) return null;
  return getQrBase64(await response.json());
}

function evolutionFetch(pathname: string, init: RequestInit = {}) {
  return fetch(`${env.EVOLUTION_API_URL}${pathname}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      apikey: env.EVOLUTION_API_KEY,
      ...init.headers,
    },
  });
}

function getQrBase64(payload: any) {
  return payload?.qrcode?.base64 ?? payload?.base64 ?? payload?.qrCode ?? payload?.data?.Qrcode ?? null;
}

async function saveQr(dataUrlOrBase64: string) {
  const base64 = dataUrlOrBase64.includes(",") ? dataUrlOrBase64.split(",")[1] : dataUrlOrBase64;
  if (!base64) throw new Error("QR base64 vacio");

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, Buffer.from(base64, "base64"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
