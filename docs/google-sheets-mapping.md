# Mapeo de Google Sheets actual

Fuente revisada: `Copia de Operacion Logistica.xlsx`.

## Hojas detectadas

- `INVENTARIO`: maestro de codigos fisicos.
- `SALIDAS`: escaneos de salida por evento.
- `DEVOLUCIONES`: escaneos de retorno por evento.
- `CONTROL`: comparacion por evento entre salidas y devoluciones.
- `RESUMEN`: estado por evento.
- `STOCK EN VIVO`: total, afuera y deposito por tipo.
- `REMITO DIGITAL`: plantilla de remito.
- `GUARDAR REMITO`: hoja con instruccion/boton.
- `HISTORIAL`: remitos guardados.
- `Hoja 19`: prueba o auxiliar de etiquetas.

## Columnas principales

### INVENTARIO

| Columna | Uso actual | Modelo backend |
| --- | --- | --- |
| `Código` | Codigo unico escaneable, ejemplo `GEN9KVA-001` | `StockItem.barcode` |
| `Tipo` | Tipo/SKU agrupador, ejemplo `GEN-9KVA` | `Product.sku` |
| `Descripción` | Nombre legible del producto | `Product.name` |
| `Estado` | Estado actual, mayormente `Disponible` | `StockItem.status` |

### SALIDAS

| Columna | Uso actual | Modelo backend |
| --- | --- | --- |
| `Fecha` | Fecha/hora del escaneo | `Scan.createdAt` |
| `Evento` | Evento destino | `Order.eventName` |
| `Código` | Codigo escaneado | `StockItem.barcode` |
| `Tipo` | Tipo encontrado o `No válido` | Validacion contra `Product.sku` |

### DEVOLUCIONES

| Columna | Uso actual | Modelo backend |
| --- | --- | --- |
| `Fecha` | Fecha/hora del retorno | `Scan.createdAt` |
| `Evento` | Evento origen | `Order.eventName` |
| `Código` | Codigo devuelto | `StockItem.barcode` |
| `Validacion` | `OK` u otro estado | Resultado de validacion |
| `Tipo` | Tipo encontrado | `Product.sku` |

## Observaciones de datos

- `INVENTARIO` tiene 1410 filas con codigo.
- No se detectaron codigos duplicados en `INVENTARIO`.
- `SALIDAS` tiene 26 registros con codigo en la copia.
- `DEVOLUCIONES` tiene 3 registros reales con codigo en la copia.
- En `SALIDAS` aparecen codigos invalidos como `GEN-002` y `GEN-003`; el inventario usa formato `GEN9KVA-001`, por eso quedan como `No válido`.
- En `SALIDAS` hay escaneos repetidos de algunos codigos, por ejemplo `MNG53210-048`, `GEN9KVA-008` y `GEN9KVA-009`.
- `DEVOLUCIONES` exportada a Excel muestra errores `#NAME?` en formulas de tipo. Esto parece venir de formulas propias de Google Sheets como `ARRAYFORMULA`, que Excel exporta como funciones no nativas.
- `STOCK EN VIVO` ya expresa el resumen que el backend debe calcular: `TOTAL`, `AFUERA`, `EN DEPOSITO`.

## Encaje recomendado

El backend debe usar `INVENTARIO` como carga inicial de productos y codigos fisicos:

- Cada `Tipo` unico crea un `Product`.
- Cada `Código` crea un `StockItem`.
- `Descripción` alimenta el nombre del producto.
- `Estado = Disponible` se traduce a `AVAILABLE`.

Despues, `SALIDAS` y `DEVOLUCIONES` no deberian ser la fuente principal del producto nuevo; deberian quedar como integracion o historico. El flujo nuevo debe generar pedidos y escaneos en PostgreSQL, y luego sincronizar vistas/resumen hacia Sheets si hace falta.

## Pendiente para integracion

- Normalizar filas de `INVENTARIO` donde `Tipo` o `Descripción` esten vacios.
- Definir si cada evento actual equivale a un pedido o si un evento puede tener varios pedidos.
- Definir si el remito debe salir desde el backend en PDF o seguir usando la plantilla `REMITO DIGITAL` al principio.
- Agregar importador de `INVENTARIO` desde Google Sheets API o desde `.xlsx`.
