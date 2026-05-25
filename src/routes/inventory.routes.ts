import { StockItemStatus } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const organizationParamsSchema = z.object({
  organizationId: z.string().min(1),
});

const createStockItemSchema = z.object({
  productId: z.string().min(1),
  barcode: z.string().min(1),
  locationCode: z.string().min(1).optional(),
  status: z.nativeEnum(StockItemStatus).default(StockItemStatus.AVAILABLE),
});

export async function inventoryRoutes(app: FastifyInstance) {
  app.get("/organizations/:organizationId/availability", async (request) => {
    const { organizationId } = organizationParamsSchema.parse(request.params);

    const products = await prisma.product.findMany({
      where: { organizationId, isActive: true },
      include: {
        category: true,
        stockItems: {
          select: { status: true },
        },
      },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    });

    return products.map((product) => {
      const byStatus = product.stockItems.reduce<Record<StockItemStatus, number>>(
        (totals, item) => {
          totals[item.status] += 1;
          return totals;
        },
        {
          AVAILABLE: 0,
          RESERVED: 0,
          OUTBOUND: 0,
          RETURNED: 0,
          MAINTENANCE: 0,
          LOST: 0,
        },
      );

      return {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        category: product.category.name,
        total: product.stockItems.length,
        available: byStatus.AVAILABLE,
        reserved: byStatus.RESERVED,
        outbound: byStatus.OUTBOUND,
        maintenance: byStatus.MAINTENANCE,
        lost: byStatus.LOST,
      };
    });
  });

  app.get("/organizations/:organizationId/stock-items", async (request) => {
    const { organizationId } = organizationParamsSchema.parse(request.params);

    return prisma.stockItem.findMany({
      where: { organizationId },
      include: {
        product: { include: { category: true } },
        location: true,
      },
      orderBy: { barcode: "asc" },
    });
  });

  app.post("/organizations/:organizationId/stock-items", async (request, reply) => {
    const { organizationId } = organizationParamsSchema.parse(request.params);
    const input = createStockItemSchema.parse(request.body);

    const product = await prisma.product.findFirstOrThrow({
      where: { id: input.productId, organizationId },
    });

    const location = input.locationCode
      ? await prisma.location.findUniqueOrThrow({
          where: { organizationId_code: { organizationId, code: input.locationCode } },
        })
      : null;

    const stockItem = await prisma.stockItem.create({
      data: {
        organizationId,
        productId: product.id,
        locationId: location?.id,
        barcode: input.barcode,
        status: input.status,
      },
      include: {
        product: { include: { category: true } },
        location: true,
      },
    });

    return reply.code(201).send(stockItem);
  });
}
