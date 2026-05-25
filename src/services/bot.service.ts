import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

export async function buildBotReply(messageText: string) {
  const text = normalizeText(messageText);

  /* ================= MENÚ PRINCIPAL ================= */
  if (!text || ["hola", "menu", "menú", "inicio", "start"].includes(text)) {
    return [
      "👋 Hola! Soy el bot de stock de IZAENERGY",
      "",
      "📦 Estoy acá para ayudarte a consultar el inventario en segundos.",
      "",
      "🔎 Elegí una opción:",
      "",
      "1️⃣ Ver stock resumido",
      "2️⃣ Ver movimientos por evento",
      "3️⃣ Ayuda",
      "",
      "💡 También podés escribir: stock / reporte / ayuda",
      "",
      "— IZAENERGY Bot 🤖"
    ].join("\n");
  }

  /* ================= STOCK ================= */
  if (text === "1" || text.includes("stock")) {
    return buildStockReply();
  }

  /* ================= MOVIMIENTOS ================= */
  if (text === "2" || text.includes("reporte") || text.includes("resumen")) {
    return buildSheetSummaryReply();
  }

  /* ================= AYUDA ================= */
  if (text === "3" || text.includes("ayuda")) {
    return [
      "ℹ️ *Centro de ayuda*",
      "",
      "Puedo ayudarte con:",
      "📦 stock actual",
      "📊 movimientos de materiales",
      "",
      "🔜 Próximamente:",
      "• pedidos automáticos",
      "• reportes en PDF",
      "• integración con logística",
      "",
      "— IZAENERGY Bot 🤖"
    ].join("\n");
  }

  /* ================= DEFAULT ================= */
  return [
    "❌ No entendí tu mensaje",
    "",
    "💬 Escribí *hola* para ver el menú principal",
    "",
    "— IZAENERGY Bot 🤖"
  ].join("\n");
}

/* ================= STOCK ================= */
async function buildStockReply() {
  const organization = await getDefaultOrganization();

  if (!organization) {
    return "⚠️ No hay empresa configurada. Ejecutá el importador de IZAENERGY.";
  }

  const products = await prisma.product.findMany({
    where: { organizationId: organization.id, isActive: true },
    include: {
      stockItems: {
        select: { status: true },
      },
    },
    orderBy: { sku: "asc" },
    take: 12,
  });

  const lines = products.map((product) => {
    const total = product.stockItems.length;
    const available = product.stockItems.filter((i) => i.status === "AVAILABLE").length;
    const outbound = product.stockItems.filter((i) => i.status === "OUTBOUND").length;

    return `📦 ${product.sku} → Total: ${total} | Depósito: ${available} | Afuera: ${outbound}`;
  });

  return [
    "📊 *Stock resumido*",
    "",
    ...lines,
    "",
    "— IZAENERGY Bot 🤖"
  ].join("\n");
}

/* ================= MOVIMIENTOS ================= */
async function buildSheetSummaryReply() {
  const organization = await getDefaultOrganization();

  if (!organization) {
    return "⚠️ No hay empresa configurada. Ejecutá el importador de IZAENERGY.";
  }

  const movements = await prisma.sheetMovement.findMany({
    where: { organizationId: organization.id },
    select: {
      direction: true,
      eventName: true,
      validation: true,
      stockItemId: true,
    },
  });

  if (movements.length === 0) {
    return "📭 No hay movimientos registrados aún.";
  }

  const byEvent = new Map<
    string,
    { outbound: number; returned: number; invalid: number }
  >();

  for (const movement of movements) {
    const eventName = movement.eventName ?? "SIN EVENTO";
    const summary = byEvent.get(eventName) ?? {
      outbound: 0,
      returned: 0,
      invalid: 0,
    };

    if (movement.direction === "OUTBOUND") summary.outbound += 1;
    if (movement.direction === "RETURN") summary.returned += 1;
    if (!movement.stockItemId || movement.validation === "NO ENCONTRADO") {
      summary.invalid += 1;
    }

    byEvent.set(eventName, summary);
  }

  const lines = [...byEvent.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([eventName, summary]) => {
      const missing = Math.max(0, summary.outbound - summary.returned);

      return `📍 ${eventName} → Salidas: ${summary.outbound} | Devoluciones: ${summary.returned} | Faltan: ${missing} | Inválidos: ${summary.invalid}`;
    });

  return [
    "📊 *Resumen de movimientos*",
    "",
    ...lines,
    "",
    "— IZAENERGY Bot 🤖"
  ].join("\n");
}

/* ================= HELPERS ================= */
async function getDefaultOrganization() {
  return prisma.organization.findUnique({
    where: { slug: env.DEFAULT_ORG_SLUG },
  });
}

function normalizeText(text: string) {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}