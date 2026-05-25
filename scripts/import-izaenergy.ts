import { ScanDirection, StockItemStatus, UserRole } from "@prisma/client";
import ExcelJS from "exceljs";
import { prisma } from "../src/lib/prisma.js";

type InventoryRow = {
  code: string;
  type: string;
  description: string;
  status: StockItemStatus;
};

type MovementRow = {
  direction: ScanDirection;
  sourceSheet: "SALIDAS" | "DEVOLUCIONES";
  sourceRow: number;
  occurredAt: Date | null;
  eventName: string | null;
  barcode: string;
  detectedType: string | null;
  validation: string | null;
};

const workbookPath = process.argv[2] ?? "C:\\Users\\guido\\Downloads\\IZAENERGY.xlsx";
const organizationSlug = process.env.ORG_SLUG ?? "izaenergy";
const organizationName = process.env.ORG_NAME ?? "IZAENERGY";

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);

  const inventoryRows = readInventory(workbook);
  const salidaRows = readMovements(workbook, "SALIDAS", ScanDirection.OUTBOUND);
  const devolucionRows = readMovements(workbook, "DEVOLUCIONES", ScanDirection.RETURN);

  const result = await prisma.$transaction(
    async (tx) => {
      const organization = await tx.organization.upsert({
        where: { slug: organizationSlug },
        update: { name: organizationName },
        create: {
          name: organizationName,
          slug: organizationSlug,
          users: {
            create: {
              name: "Administrador",
              role: UserRole.OWNER,
            },
          },
          locations: {
            create: {
              name: "Deposito Central",
              code: "DEP",
            },
          },
        },
        include: { locations: true },
      });

      const defaultLocation =
        organization.locations.find((location) => location.code === "DEP") ??
        (await tx.location.create({
          data: {
            organizationId: organization.id,
            name: "Deposito Central",
            code: "DEP",
          },
        }));

      const productsByType = new Map<string, string>();
      const stockByCode = new Map<string, string>();

      for (const row of inventoryRows) {
        const categoryCode = categoryFromType(row.type);
        const category = await tx.category.upsert({
          where: { organizationId_code: { organizationId: organization.id, code: categoryCode } },
          update: {},
          create: {
            organizationId: organization.id,
            code: categoryCode,
            name: categoryCode,
          },
        });

        const product = await tx.product.upsert({
          where: { organizationId_sku: { organizationId: organization.id, sku: row.type } },
          update: {
            name: row.description || row.type,
            categoryId: category.id,
            isActive: true,
          },
          create: {
            organizationId: organization.id,
            categoryId: category.id,
            sku: row.type,
            name: row.description || row.type,
            unit: "unidad",
            isSerialized: true,
            isActive: true,
          },
        });

        productsByType.set(row.type, product.id);

        const stockItem = await tx.stockItem.upsert({
          where: { organizationId_barcode: { organizationId: organization.id, barcode: row.code } },
          update: {
            productId: product.id,
            locationId: defaultLocation.id,
            status: row.status,
          },
          create: {
            organizationId: organization.id,
            productId: product.id,
            locationId: defaultLocation.id,
            barcode: row.code,
            status: row.status,
          },
        });

        stockByCode.set(row.code, stockItem.id);
      }

      let importedMovements = 0;
      const movements = [...salidaRows, ...devolucionRows];

      for (const row of movements) {
        const stockItemId = stockByCode.get(row.barcode) ?? null;

        await tx.sheetMovement.upsert({
          where: {
            organizationId_sourceSheet_sourceRow: {
              organizationId: organization.id,
              sourceSheet: row.sourceSheet,
              sourceRow: row.sourceRow,
            },
          },
          update: {
            stockItemId,
            direction: row.direction,
            occurredAt: row.occurredAt,
            eventName: row.eventName,
            barcode: row.barcode,
            detectedType: row.detectedType,
            validation: row.validation,
          },
          create: {
            organizationId: organization.id,
            stockItemId,
            direction: row.direction,
            occurredAt: row.occurredAt,
            eventName: row.eventName,
            barcode: row.barcode,
            detectedType: row.detectedType,
            validation: row.validation,
            sourceSheet: row.sourceSheet,
            sourceRow: row.sourceRow,
          },
        });

        importedMovements += 1;
      }

      return {
        organizationId: organization.id,
        inventoryRows: inventoryRows.length,
        productTypes: productsByType.size,
        salidaRows: salidaRows.length,
        devolucionRows: devolucionRows.length,
        importedMovements,
      };
    },
    { timeout: 60_000 },
  );

  console.log(JSON.stringify(result, null, 2));
}

function readInventory(workbook: ExcelJS.Workbook): InventoryRow[] {
  const sheet = requiredSheet(workbook, "INVENTARIO");
  const rows: InventoryRow[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const code = cellText(row.getCell(1));
    if (!code) return;

    const type = cellText(row.getCell(2)) || "SIN-TIPO";
    const description = cellText(row.getCell(3)) || type;
    const status = stockStatusFromSheet(cellText(row.getCell(4)));

    rows.push({ code, type, description, status });
  });

  return rows;
}

function readMovements(
  workbook: ExcelJS.Workbook,
  sourceSheet: "SALIDAS" | "DEVOLUCIONES",
  direction: ScanDirection,
): MovementRow[] {
  const sheet = requiredSheet(workbook, sourceSheet);
  const rows: MovementRow[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const barcode = cellText(row.getCell(3));
    if (!barcode) return;

    rows.push({
      direction,
      sourceSheet,
      sourceRow: rowNumber,
      occurredAt: cellDate(row.getCell(1)),
      eventName: cellText(row.getCell(2)) || null,
      barcode,
      detectedType: sourceSheet === "SALIDAS" ? cellText(row.getCell(4)) || null : cellText(row.getCell(5)) || null,
      validation: sourceSheet === "DEVOLUCIONES" ? cellText(row.getCell(4)) || null : null,
    });
  });

  return rows;
}

function requiredSheet(workbook: ExcelJS.Workbook, name: string) {
  const sheet = workbook.getWorksheet(name);
  if (!sheet) throw new Error(`No existe la hoja ${name}`);
  return sheet;
}

function cellText(cell: ExcelJS.Cell) {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("result" in value && value.result !== undefined && value.result !== null) return String(value.result).trim();
    if ("text" in value && value.text !== undefined && value.text !== null) return String(value.text).trim();
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
    return "";
  }
  return String(value).trim();
}

function cellDate(cell: ExcelJS.Cell) {
  const value = cell.value;
  if (value instanceof Date) return value;
  if (typeof value === "number") return excelSerialToDate(value);
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function excelSerialToDate(serial: number) {
  return new Date(Math.round((serial - 25569) * 86400 * 1000));
}

function stockStatusFromSheet(status: string): StockItemStatus {
  const normalized = status.toLowerCase();
  if (normalized.includes("afuera")) return StockItemStatus.OUTBOUND;
  if (normalized.includes("reserv")) return StockItemStatus.RESERVED;
  if (normalized.includes("mant")) return StockItemStatus.MAINTENANCE;
  if (normalized.includes("perd")) return StockItemStatus.LOST;
  return StockItemStatus.AVAILABLE;
}

function categoryFromType(type: string) {
  return type.split("-")[0] || "GENERAL";
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
