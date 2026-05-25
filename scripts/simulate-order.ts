const baseUrl = process.env.API_URL ?? "http://localhost:3000";

type Organization = {
  id: string;
  slug: string;
};

type Product = {
  id: string;
  sku: string;
  name: string;
};

type StockItem = {
  barcode: string;
  status: string;
  reservedForOrderId: string | null;
  product: Product;
};

type Order = {
  id: string;
  code: string;
  status: string;
  items: Array<{
    quantity: number;
    scannedQuantity: number;
    product: Product;
  }>;
};

async function main() {
  const organizations = await request<Organization[]>("/api/organizations");
  const organization = organizations.find((item) => item.slug === "demo") ?? organizations[0];

  if (!organization) {
    throw new Error("No hay organizaciones cargadas. Ejecuta npm.cmd run db:seed primero.");
  }

  const products = await request<Product[]>(`/api/organizations/${organization.id}/products`);
  const cableMacho = requireProduct(products, "CAB-M");
  const cableHembra = requireProduct(products, "CAB-H");
  const runId = Date.now();
  const stockToCreate = [
    { productId: cableMacho.id, barcode: `SIM-CAB-M-${runId}-001` },
    { productId: cableMacho.id, barcode: `SIM-CAB-M-${runId}-002` },
    { productId: cableHembra.id, barcode: `SIM-CAB-H-${runId}-001` },
  ];

  for (const item of stockToCreate) {
    await request(`/api/organizations/${organization.id}/stock-items`, {
      method: "POST",
      body: {
        ...item,
        locationCode: "DEP",
      },
    });
  }

  console.log(`Stock demo creado: ${stockToCreate.map((item) => item.barcode).join(", ")}`);

  const order = await request<Order>(`/api/organizations/${organization.id}/orders`, {
    method: "POST",
    body: {
      eventName: "Evento demo",
      requesterName: "Encargado demo",
      requesterPhone: "+5491100000001",
      notes: "Pedido generado por script de simulacion.",
      items: [
        { productId: cableMacho.id, quantity: 2 },
        { productId: cableHembra.id, quantity: 1 },
      ],
    },
  });

  console.log(`Pedido creado: ${order.code} (${order.id})`);

  const stockItems = await request<StockItem[]>(`/api/organizations/${organization.id}/stock-items`);
  const scanBarcodes = [
    ...barcodesFor(stockItems, order.id, "CAB-M", 2),
    ...barcodesFor(stockItems, order.id, "CAB-H", 1),
  ];

  let latestOrder = order;

  for (const barcode of scanBarcodes) {
    latestOrder = await request<Order>(`/api/organizations/${organization.id}/orders/${order.id}/outbound-scans`, {
      method: "POST",
      body: {
        barcode,
        scannedBy: "Deposito demo",
      },
    });

    console.log(`Escaneado: ${barcode}`);
  }

  console.log(`Estado final: ${latestOrder.status}`);
  for (const item of latestOrder.items) {
    console.log(`- ${item.product.name}: ${item.scannedQuantity}/${item.quantity}`);
  }
}

async function request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: options.body ? { "content-type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${options.method ?? "GET"} ${path} fallo con ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

function requireProduct(products: Product[], sku: string) {
  const product = products.find((item) => item.sku === sku);

  if (!product) {
    throw new Error(`No existe producto demo con SKU ${sku}. Ejecuta npm.cmd run db:seed primero.`);
  }

  return product;
}

function barcodesFor(stockItems: StockItem[], orderId: string, sku: string, quantity: number) {
  const matches = stockItems
    .filter((item) => item.product.sku === sku && item.status === "RESERVED" && item.reservedForOrderId === orderId)
    .slice(0, quantity)
    .map((item) => item.barcode);

  if (matches.length < quantity) {
    throw new Error(`No hay suficientes codigos reservados para ${sku}.`);
  }

  return matches;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
