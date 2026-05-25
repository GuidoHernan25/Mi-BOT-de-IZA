import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createOrder, getOrder, registerOutboundScan } from "../services/order.service.js";

const organizationParamsSchema = z.object({
  organizationId: z.string().min(1),
});

const orderParamsSchema = z.object({
  organizationId: z.string().min(1),
  orderId: z.string().min(1),
});

const createOrderSchema = z.object({
  eventName: z.string().min(1),
  eventDate: z.string().datetime().optional(),
  requesterName: z.string().min(1),
  requesterPhone: z.string().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});

const outboundScanSchema = z.object({
  barcode: z.string().min(1),
  scannedBy: z.string().optional(),
});

export async function orderRoutes(app: FastifyInstance) {
  app.post("/organizations/:organizationId/orders", async (request, reply) => {
    const { organizationId } = organizationParamsSchema.parse(request.params);
    const input = createOrderSchema.parse(request.body);
    const order = await createOrder(organizationId, input);

    return reply.code(201).send(order);
  });

  app.get("/organizations/:organizationId/orders/:orderId", async (request) => {
    const { organizationId, orderId } = orderParamsSchema.parse(request.params);
    return getOrder(organizationId, orderId);
  });

  app.post("/organizations/:organizationId/orders/:orderId/outbound-scans", async (request, reply) => {
    const { organizationId, orderId } = orderParamsSchema.parse(request.params);
    const input = outboundScanSchema.parse(request.body);
    const result = await registerOutboundScan(organizationId, orderId, input);

    return reply.code(201).send(result);
  });
}
