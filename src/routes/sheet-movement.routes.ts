import { ScanDirection } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const paramsSchema = z.object({
  organizationId: z.string().min(1),
});

const querySchema = z.object({
  eventName: z.string().optional(),
  direction: z.nativeEnum(ScanDirection).optional(),
  barcode: z.string().optional(),
});

export async function sheetMovementRoutes(app: FastifyInstance) {
  app.get("/organizations/:organizationId/sheet-movements", async (request) => {
    const { organizationId } = paramsSchema.parse(request.params);
    const query = querySchema.parse(request.query);

    return prisma.sheetMovement.findMany({
      where: {
        organizationId,
        eventName: query.eventName,
        direction: query.direction,
        barcode: query.barcode,
      },
      include: {
        stockItem: {
          include: {
            product: true,
          },
        },
      },
      orderBy: [{ sourceSheet: "asc" }, { sourceRow: "asc" }],
    });
  });

  app.get("/organizations/:organizationId/sheet-summary", async (request) => {
    const { organizationId } = paramsSchema.parse(request.params);

    const movements = await prisma.sheetMovement.findMany({
      where: { organizationId },
      select: {
        direction: true,
        eventName: true,
        barcode: true,
        validation: true,
        stockItemId: true,
      },
    });

    const byEvent = new Map<
      string,
      {
        eventName: string;
        outbound: number;
        returned: number;
        invalid: number;
        missing: number;
      }
    >();

    for (const movement of movements) {
      const eventName = movement.eventName ?? "SIN EVENTO";
      const summary =
        byEvent.get(eventName) ??
        {
          eventName,
          outbound: 0,
          returned: 0,
          invalid: 0,
          missing: 0,
        };

      if (movement.direction === ScanDirection.OUTBOUND) summary.outbound += 1;
      if (movement.direction === ScanDirection.RETURN) summary.returned += 1;
      if (!movement.stockItemId || movement.validation === "NO ENCONTRADO") summary.invalid += 1;

      summary.missing = Math.max(0, summary.outbound - summary.returned);
      byEvent.set(eventName, summary);
    }

    return [...byEvent.values()].sort((a, b) => a.eventName.localeCompare(b.eventName));
  });
}
