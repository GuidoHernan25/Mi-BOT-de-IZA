# Stockbot

Backend base para convertir pedidos de stock por WhatsApp en pedidos estructurados, reservas, remitos y validacion contra escaneos de salida.

## Requisitos

- Node.js LTS
- Docker Desktop
- Git
- ngrok cuando conectemos WhatsApp

## Primer arranque local

```powershell
Copy-Item .env.example .env
docker compose up -d
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

La API queda en `http://localhost:3000`.

Endpoints utiles:

- `GET /health`
- `GET /api/organizations`
- `GET /api/organizations/:organizationId/availability`
- `GET /api/organizations/:organizationId/stock-items`
- `POST /api/organizations/:organizationId/stock-items`
- `GET /api/organizations/:organizationId/products`
- `POST /api/organizations/:organizationId/products`
- `POST /api/organizations/:organizationId/orders`
- `GET /api/organizations/:organizationId/orders/:orderId`
- `POST /api/organizations/:organizationId/orders/:orderId/outbound-scans`
- `GET /api/organizations/:organizationId/sheet-movements`
- `GET /api/organizations/:organizationId/sheet-summary`
- `GET /webhooks/whatsapp`
- `POST /webhooks/whatsapp`

## Idea de flujo

1. Un encargado arma un pedido desde WhatsApp.
2. El backend crea un pedido y reserva cantidades.
3. Deposito separa materiales.
4. Al escanear salidas, el backend valida si el codigo pertenece al pedido y actualiza cantidades escaneadas.
5. Cuando conectemos PDF, el pedido podra generar un remito automatico.

## Simular un pedido sin WhatsApp

Con la API corriendo:

```powershell
npm.cmd run simulate:order
```

El script toma la organizacion demo, crea un pedido para un evento de prueba y escanea codigos existentes.

## Importar la hoja IZAENERGY

Con PostgreSQL levantado:

```powershell
npm.cmd run import:izaenergy -- "C:\Users\guido\Downloads\IZAENERGY.xlsx"
```

El importador lee:

- `INVENTARIO` como productos y codigos fisicos.
- `SALIDAS` como movimientos historicos de salida.
- `DEVOLUCIONES` como movimientos historicos de retorno.

La importacion es repetible: si se corre de nuevo, actualiza las mismas filas por hoja/fila de origen.

## Evolution API local

Levantar Evolution API:

```powershell
docker compose -f docker-compose.evolution.yml up -d
```

Crear/conectar la instancia y generar QR:

```powershell
npm.cmd run evolution:setup "http://172.28.96.1:3000/webhooks/evolution"
```

El QR queda en `outputs/evolution-qr.png`. Escanearlo desde WhatsApp Business con el numero del bot.

Para que el bot responda, el backend debe estar corriendo:

```powershell
npm.cmd run dev
```

Mensajes de prueba:

- `hola`
- `stock`
- `reporte`
