import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export async function organizationRoutes(app: FastifyInstance) {
  app.get("/organizations", async () => {
    return prisma.organization.findMany({
      orderBy: { name: "asc" },
    });
  });
}
