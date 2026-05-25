import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify from "fastify";
import { evolutionWebhookRoutes } from "./routes/evolution-webhook.routes.js";
import { healthRoutes } from "./routes/health.routes.js";
import { inventoryRoutes } from "./routes/inventory.routes.js";
import { orderRoutes } from "./routes/order.routes.js";
import { organizationRoutes } from "./routes/organization.routes.js";
import { productRoutes } from "./routes/product.routes.js";
import { sheetMovementRoutes } from "./routes/sheet-movement.routes.js";
import { whatsappWebhookRoutes } from "./routes/whatsapp-webhook.routes.js";

export function buildApp() {
  const app = Fastify({
    logger: {
      level: "info",
      transport:
        process.env.NODE_ENV === "development"
          ? {
              target: "pino-pretty",
              options: { colorize: true },
            }
          : undefined,
    },
  });

  app.register(helmet);
  app.register(cors, { origin: true });

  app.register(healthRoutes);
  app.register(organizationRoutes, { prefix: "/api" });
  app.register(inventoryRoutes, { prefix: "/api" });
  app.register(productRoutes, { prefix: "/api" });
  app.register(orderRoutes, { prefix: "/api" });
  app.register(sheetMovementRoutes, { prefix: "/api" });
  app.register(evolutionWebhookRoutes, { prefix: "/webhooks" });
  app.register(whatsappWebhookRoutes, { prefix: "/webhooks" });

  return app;
}
