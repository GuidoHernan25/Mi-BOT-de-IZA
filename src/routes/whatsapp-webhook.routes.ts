import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../config/env.js";

const verifyQuerySchema = z.object({
  "hub.mode": z.string().optional(),
  "hub.verify_token": z.string().optional(),
  "hub.challenge": z.string().optional(),
});

export async function whatsappWebhookRoutes(app: FastifyInstance) {
  app.get("/whatsapp", async (request, reply) => {
    const query = verifyQuerySchema.parse(request.query);

    if (query["hub.mode"] === "subscribe" && query["hub.verify_token"] === env.WHATSAPP_VERIFY_TOKEN) {
      return reply.code(200).send(query["hub.challenge"]);
    }

    return reply.code(403).send({ error: "Invalid WhatsApp verification token" });
  });

  app.post("/whatsapp", async (request, reply) => {
    request.log.info({ body: request.body }, "WhatsApp webhook recibido");

    // Aca conectaremos el flujo de menus cuando activemos Meta WhatsApp Cloud API.
    return reply.code(200).send({ ok: true });
  });
}
