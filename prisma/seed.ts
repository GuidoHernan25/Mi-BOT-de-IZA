import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      name: "Demo Stockbot",
      slug: "demo",
      users: {
        create: [
          { name: "Deposito", role: UserRole.WAREHOUSE, phone: "+5491100000000" },
          { name: "Encargado Evento", role: UserRole.REQUESTER, phone: "+5491100000001" },
        ],
      },
      locations: {
        create: [{ name: "Deposito Central", code: "DEP" }],
      },
      categories: {
        create: [
          { name: "Generadores", code: "GEN" },
          { name: "Cables", code: "CAB" },
        ],
      },
    },
    include: {
      categories: true,
      locations: true,
    },
  });

  const generatorCategory = organization.categories.find((category) => category.code === "GEN");
  const cableCategory = organization.categories.find((category) => category.code === "CAB");
  const deposito = organization.locations.find((location) => location.code === "DEP");

  if (!generatorCategory || !cableCategory || !deposito) {
    throw new Error("Seed incompleto: faltan categorias o ubicacion.");
  }

  const generator = await prisma.product.upsert({
    where: { organizationId_sku: { organizationId: organization.id, sku: "GEN" } },
    update: {},
    create: {
      organizationId: organization.id,
      categoryId: generatorCategory.id,
      sku: "GEN",
      name: "Generador",
      unit: "unidad",
      isSerialized: true,
    },
  });

  const cableMacho = await prisma.product.upsert({
    where: { organizationId_sku: { organizationId: organization.id, sku: "CAB-M" } },
    update: {},
    create: {
      organizationId: organization.id,
      categoryId: cableCategory.id,
      sku: "CAB-M",
      name: "Cable macho",
      unit: "unidad",
      isSerialized: true,
    },
  });

  const cableHembra = await prisma.product.upsert({
    where: { organizationId_sku: { organizationId: organization.id, sku: "CAB-H" } },
    update: {},
    create: {
      organizationId: organization.id,
      categoryId: cableCategory.id,
      sku: "CAB-H",
      name: "Cable hembra",
      unit: "unidad",
      isSerialized: true,
    },
  });

  const stock = [
    { productId: generator.id, barcode: "GEN-001" },
    { productId: generator.id, barcode: "GEN-002" },
    { productId: cableMacho.id, barcode: "CAB-M-001" },
    { productId: cableMacho.id, barcode: "CAB-M-002" },
    { productId: cableMacho.id, barcode: "CAB-M-003" },
    { productId: cableHembra.id, barcode: "CAB-H-001" },
    { productId: cableHembra.id, barcode: "CAB-H-002" },
  ];

  for (const item of stock) {
    await prisma.stockItem.upsert({
      where: { organizationId_barcode: { organizationId: organization.id, barcode: item.barcode } },
      update: {},
      create: {
        organizationId: organization.id,
        productId: item.productId,
        locationId: deposito.id,
        barcode: item.barcode,
      },
    });
  }

  console.log(`Seed listo. Organization demo: ${organization.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
