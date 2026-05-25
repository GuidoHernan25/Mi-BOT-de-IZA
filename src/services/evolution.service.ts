import { env } from "../config/env.js";

type SendTextInput = {
  number: string;
  text: string;
};

export async function sendEvolutionText({ number, text }: SendTextInput) {
  const response = await fetch(
    `${env.EVOLUTION_API_URL}/message/sendText/${env.EVOLUTION_INSTANCE_NAME}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: env.EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number,
        text,
        options: {
          delay: 400,
          presence: "composing",
          linkPreview: false,
        },
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Evolution sendText fallo con ${response.status}: ${body}`
    );
  }

  return response.json();
}

/* 🔥 AGREGAR ESTO */
export function normalizeEvolutionNumber(remoteJidOrNumber: string) {
  if (!remoteJidOrNumber) return "";

  return remoteJidOrNumber
    .split("@")[0]
    .replace(/\D/g, "");
}