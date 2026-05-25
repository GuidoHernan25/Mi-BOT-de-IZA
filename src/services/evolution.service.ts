import { env } from "../config/env.js";

type SendTextInput = {
  number: string;
  text: string;
};

export async function sendEvolutionText({ number, text }: SendTextInput) {
  const cleanNumber = number.split("@")[0].replace(/\D/g, "");

  const response = await fetch(
    `${env.EVOLUTION_API_URL}/message/sendText/${env.EVOLUTION_INSTANCE_NAME}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: cleanNumber,
        text: text?.toString()?.trim(),
      }),
    }
  );

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Evolution error ${response.status}: ${body}`);
  }

  return body;
}

/* normalizador */
export function normalizeEvolutionNumber(remoteJid: string) {
  return remoteJid?.split("@")[0].replace(/\D/g, "") ?? "";
}