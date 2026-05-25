import type { FastifyInstance } from "fastify";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { buildBotReply } from "../services/bot.service.js";
import {
  normalizeEvolutionNumber,
  sendEvolutionText,
} from "../services/evolution.service.js";

const webhookPayloadSchema = z
  .object({
    event: z.string().optional(),
    instance: z.string().optional(),
    data: z.any().optional(),
  })
  .passthrough();

export async function evolutionWebhookRoutes(app: FastifyInstance) {
  app.post("/evolution", async (request, reply) => {
    console.log("🔥 HIT WEBHOOK:", request.body);

    try {
      const payload = webhookPayloadSchema.parse(request.body);

      // 🔥 DEBUG correcto (ya existe payload acá)
      console.log(
        "📩 RAW DATA:",
        JSON.stringify(payload.data, null, 2)
      );

      request.log.info(
        { event: payload.event, instance: payload.instance },
        "Evolution webhook recibido"
      );

      const event = normalizeEvolutionEvent(payload.event);

      /* ================= QR ================= */
      if (event === "QRCODE_UPDATED") {
        const qr = extractQrBase64(payload.data);

        if (qr) {
          const outputPath = path.resolve("outputs", "evolution-qr.png");
          const base64 = qr.includes(",") ? qr.split(",")[1] : qr;

          await fs.mkdir(path.dirname(outputPath), { recursive: true });
          await fs.writeFile(outputPath, Buffer.from(base64, "base64"));
        }

        return reply.code(200).send({
          ok: true,
          qrSaved: Boolean(qr),
        });
      }

      /* ================= IGNORAR EVENTOS ================= */
      if (event !== "MESSAGES_UPSERT") {
        return reply.code(200).send({ ok: true, ignored: true });
      }

      /* ================= MENSAJE ================= */
      const message = extractIncomingMessage(payload.data);

      if (!message) {
        return reply.code(200).send({ ok: true, ignored: true });
      }

      if (message.fromMe) {
        return reply.code(200).send({ ok: true, ignored: true });
      }

      /* ================= BOT ================= */
      const answerRaw = await buildBotReply(message.text);

      const answer =
        (answerRaw ?? "").toString().trim() ||
        "No pude generar respuesta.";

      /* ================= SEND ================= */
      await sendEvolutionText({
        number: normalizeEvolutionNumber(message.remoteJid),
        text: answer,
      });

      return reply.code(200).send({ ok: true });
    } catch (err) {
      console.error("❌ Webhook error:", err);
      return reply.code(200).send({ ok: false });
    }
  });
}

/* ================= HELPERS ================= */

function extractQrBase64(data: any) {
  const item = Array.isArray(data) ? data[0] : data;

  return (
    item?.qrcode?.base64 ??
    item?.base64 ??
    item?.qrCode ??
    item?.Qrcode ??
    item?.qrcode ??
    null
  );
}

function normalizeEvolutionEvent(event: string | undefined) {
  return event?.replace(".", "_").toUpperCase() ?? "";
}

/* ================= EXTRACTOR MENSAJES ================= */

function extractIncomingMessage(data: any) {
  const item = Array.isArray(data) ? data[0] : data;

  const key = item?.key ?? item?.message?.key;
  const message = item?.message ?? item?.data?.message;

  const remoteJid =
    key?.remoteJid ?? item?.remoteJid ?? null;

  const fromMe = key?.fromMe === true;

  const text =
    message?.conversation ??
    message?.extendedTextMessage?.text ??
    message?.imageMessage?.caption ??
    message?.videoMessage?.caption ??
    message?.buttonsResponseMessage?.selectedButtonId ?? // botones
    message?.listResponseMessage?.singleSelectReply?.selectedRowId ?? // listas
    "";

  const finalText = (text ?? "").toString().trim();

  if (!remoteJid || !finalText) return null;

  return {
    remoteJid: String(remoteJid),
    fromMe,
    text: finalText,
  };
}