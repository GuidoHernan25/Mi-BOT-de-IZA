import { env } from "../config/env.js";

type SendTextInput = {
  number: string;
  text: string;
};

export async function sendEvolutionText({ number, text }: SendTextInput) {
  // 🔥 formato correcto para Evolution (jid)
  const jid = number.includes("@")
    ? number
    : `${number}@s.whatsapp.net`;

  const response = await fetch(
    `${env.EVOLUTION_API_URL}/message/sendText/${env.EVOLUTION_INSTANCE_NAME}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        jid,
        message: {
          text: text?.toString()?.trim(),
        },
      }),
    }
  );

  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `Evolution sendText fallo con ${response.status}: ${body}`
    );
  }

  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

/* =========================
   NORMALIZADOR WHATSAPP
========================= */
export function normalizeEvolutionNumber(remoteJidOrNumber: string) {
  if (!remoteJidOrNumber) return "";

  return remoteJidOrNumber
    .split("@")[0]
    .replace(/\D/g, "");
}