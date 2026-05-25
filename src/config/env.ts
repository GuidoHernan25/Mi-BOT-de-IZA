import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  WHATSAPP_VERIFY_TOKEN: z.string().default("change-me"),
  WHATSAPP_ACCESS_TOKEN: z.string().default(""),
  WHATSAPP_PHONE_NUMBER_ID: z.string().default(""),
  EVOLUTION_API_URL: z.string().url().default("http://localhost:8080"),
  EVOLUTION_API_KEY: z.string().default("change-this-dev-key"),
  EVOLUTION_INSTANCE_NAME: z.string().default("izaenergy-stock"),
  DEFAULT_ORG_SLUG: z.string().default("izaenergy"),
});

export const env = schema.parse(process.env);
