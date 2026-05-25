import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const paramsSchema = z.object({
  organizationId: z.string().min(1),
});

const createProductSchema = z.object({
  categoryCode: z.string().min(1),
  sku: z.string().min(1),
  name: z.string().min(1),
  unit: z.string().min(1).default("unidad"),
  isSerialized: z.boolean().default(true),
});

export async function productRoutes(app: FastifyInstance) {
  app.get("/organizations/:organizationId/products", async (request) => {
    const { organizationId } = paramsSchema.parse(request.params);

    return prisma.product.findMany({
      where: { organizationId, isActive: true },
      include: {
        category: true,
        _count: { select: { stockItems: true } },
      },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    });
  });

  app.post("/organizations/:organizationId/products", async (request, reply) => {
    const { organizationId } = paramsSchema.parse(request.params);
    const input = createProductSchema.parse(request.body);

    const category = await prisma.category.upsert({
      where: { organizationId_code: { organizationId, code: input.categoryCode } },
      update: {},
      create: {
        organizationId,
        code: input.categoryCode,
        name: input.categoryCode,
      },
    });

    const product = await prisma.product.create({
      data: {
        organizationId,
        categoryId: category.id,
        sku: input.sku,
        name: input.name,
        unit: input.unit,
        isSerialized: input.isSerialized,
      },
    });

    return reply.code(201).send(product);
  });
}
