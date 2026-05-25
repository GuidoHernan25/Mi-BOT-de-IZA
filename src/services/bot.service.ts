import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

export async function buildBotReply(messageText: string) {
  const text = normalizeText(messageText);

  // 🔥 limpieza fuerte para evitar fallos con emojis / botones
  const clean = text
    .replace(/[^a-z0-9]/gi, "")
    .trim();

  /* ================= MENÚ PRINCIPAL ================= */
  if (!clean || ["hola", "menu", "menú", "inicio", "start"].includes(clean)) {
    return [
      "👋 Hola! Soy el bot de stock de IZAENERGY",
      "",
      "📦 Sistema de inventario automático",
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

  /* ================= OPCIÓN 1 - STOCK ================= */
  if (clean === "1" || clean.includes("stock")) {
    return buildStockReply();
  }

  /* ================= OPCIÓN 2 - MOVIMIENTOS ================= */
  if (clean === "2" || clean.includes("reporte") || clean.includes("movimientos")) {
    return buildSheetSummaryReply();
  }

  /* ================= OPCIÓN 3 - AYUDA ================= */
  if (clean === "3" || clean.includes("ayuda")) {
    return [
      "ℹ️ *Centro de ayuda IZAENERGY*",
      "",
      "📦 1 → Ver stock",
      "📊 2 → Movimientos por evento",
      "ℹ️ 3 → Ayuda",
      "",
      "🔜 Próximamente:",
      "• alertas automáticas",
      "• reportes PDF",
      "• integración logística completa",
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
    return "⚠️ No hay empresa configurada.";
  }

  const products = await prisma.product.findMany({
    where: { organizationId: organization.id, isActive: true },
    include: {
      stockItems: { select: { status: true } },
    },
    orderBy: { sku: "asc" },
    take: 12,
  });

  return [
    "📊 *Stock resumido*",
    "",
    ...products.map((p) => {
      const total = p.stockItems.length;
      const available = p.stockItems.filter(i => i.status === "AVAILABLE").length;
      const outbound = p.stockItems.filter(i => i.status === "OUTBOUND").length;

      return `📦 ${p.sku} → Total: ${total} | Depósito: ${available} | Afuera: ${outbound}`;
    }),
    "",
    "— IZAENERGY Bot 🤖"
  ].join("\n");
}

/* ================= MOVIMIENTOS ================= */
async function buildSheetSummaryReply() {
  const organization = await getDefaultOrganization();

  if (!organization) {
    return "⚠️ No hay empresa configurada.";
  }

  const movements = await prisma.sheetMovement.findMany({
    where: { organizationId: organization.id },
  });

  if (movements.length === 0) {
    return "📭 No hay movimientos registrados.";
  }

  const byEvent = new Map<string, any>();

  for (const m of movements) {
    const event = m.eventName ?? "SIN EVENTO";

    const current = byEvent.get(event) ?? {
      outbound: 0,
      returned: 0,
      invalid: 0,
    };

    if (m.direction === "OUTBOUND") current.outbound++;
    if (m.direction === "RETURN") current.returned++;
    if (!m.stockItemId || m.validation === "NO ENCONTRADO") current.invalid++;

    byEvent.set(event, current);
  }

  return [
    "📊 *Movimientos por evento*",
    "",
    ...[...byEvent.entries()].map(([event, s]) => {
      const missing = Math.max(0, s.outbound - s.returned);

      return `📍 ${event} → Salidas: ${s.outbound} | Devoluciones: ${s.returned} | Faltan: ${missing} | Inválidos: ${s.invalid}`;
    }),
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
  return (text ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}