import { OrderStatus, ScanDirection, StockItemStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

type CreateOrderInput = {
  eventName: string;
  eventDate?: string;
  requesterName: string;
  requesterPhone?: string;
  notes?: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
};

type OutboundScanInput = {
  barcode: string;
  scannedBy?: string;
};

export async function createOrder(organizationId: string, input: CreateOrderInput) {
  const code = await nextOrderCode(organizationId);

  return prisma.$transaction(async (tx) => {
    for (const item of input.items) {
      const availableCount = await tx.stockItem.count({
        where: {
          organizationId,
          productId: item.productId,
          status: StockItemStatus.AVAILABLE,
        },
      });

      if (availableCount < item.quantity) {
        throw new Error(`Stock insuficiente para producto ${item.productId}. Disponible: ${availableCount}`);
      }
    }

    const order = await tx.order.create({
      data: {
        organizationId,
        code,
        eventName: input.eventName,
        eventDate: input.eventDate ? new Date(input.eventDate) : null,
        requesterName: input.requesterName,
        requesterPhone: input.requesterPhone,
        notes: input.notes,
        status: OrderStatus.CONFIRMED,
        items: {
          create: input.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        },
      },
      include: orderInclude,
    });

    for (const item of input.items) {
      const stockToReserve = await tx.stockItem.findMany({
        where: {
          organizationId,
          productId: item.productId,
          status: StockItemStatus.AVAILABLE,
        },
        take: item.quantity,
        orderBy: { barcode: "asc" },
      });

      await tx.stockItem.updateMany({
        where: { id: { in: stockToReserve.map((stockItem) => stockItem.id) } },
        data: { status: StockItemStatus.RESERVED, reservedForOrderId: order.id },
      });
    }

    return order;
  });
}

export async function getOrder(organizationId: string, orderId: string) {
  return prisma.order.findFirstOrThrow({
    where: { id: orderId, organizationId },
    include: orderInclude,
  });
}

export async function registerOutboundScan(organizationId: string, orderId: string, input: OutboundScanInput) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirstOrThrow({
      where: { id: orderId, organizationId },
      include: { items: true },
    });

    const stockItem = await tx.stockItem.findFirstOrThrow({
      where: { organizationId, barcode: input.barcode },
      include: { product: true },
    });

    const orderItem = order.items.find((item) => item.productId === stockItem.productId);

    if (!orderItem) {
      throw new Error(`El codigo ${input.barcode} no pertenece a ningun producto pedido.`);
    }

    if (orderItem.scannedQuantity >= orderItem.quantity) {
      throw new Error(`El producto ${stockItem.product.name} ya completo la cantidad pedida.`);
    }

    const scannableStatuses: StockItemStatus[] = [StockItemStatus.RESERVED, StockItemStatus.AVAILABLE];

    if (!scannableStatuses.includes(stockItem.status)) {
      throw new Error(`El codigo ${input.barcode} no esta disponible para salir. Estado: ${stockItem.status}`);
    }

    if (stockItem.status === StockItemStatus.RESERVED && stockItem.reservedForOrderId !== orderId) {
      throw new Error(`El codigo ${input.barcode} esta reservado para otro pedido.`);
    }

    await tx.scan.create({
      data: {
        orderId,
        stockItemId: stockItem.id,
        direction: ScanDirection.OUTBOUND,
        scannedBy: input.scannedBy,
      },
    });

    await tx.stockItem.update({
      where: { id: stockItem.id },
      data: { status: StockItemStatus.OUTBOUND, reservedForOrderId: null },
    });

    await tx.orderItem.update({
      where: { id: orderItem.id },
      data: { scannedQuantity: { increment: 1 } },
    });

    const refreshedItems = await tx.orderItem.findMany({ where: { orderId } });
    const allComplete = refreshedItems.every((item) => item.scannedQuantity >= item.quantity);

    if (allComplete) {
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.DISPATCHED },
      });
    } else if (order.status === OrderStatus.CONFIRMED) {
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PREPARING },
      });
    }

    return tx.order.findFirstOrThrow({
      where: { id: orderId, organizationId },
      include: orderInclude,
    });
  });
}

async function nextOrderCode(organizationId: string) {
  const today = new Date();
  const datePart = today.toISOString().slice(0, 10).replaceAll("-", "");
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);

  const countToday = await prisma.order.count({
    where: {
      organizationId,
      createdAt: { gte: startOfDay },
    },
  });

  return `PED-${datePart}-${String(countToday + 1).padStart(3, "0")}`;
}

const orderInclude = {
  items: {
    include: {
      product: {
        include: { category: true },
      },
    },
    orderBy: { createdAt: "asc" },
  },
  scans: {
    include: {
      stockItem: {
        include: { product: true },
      },
    },
    orderBy: { createdAt: "asc" },
  },
} as const;
