# Dashboard BI Gerencial

## 1. Propuesta de arquitectura

### Arquitectura lógica
- `FastAPI BI Service` (lectura analítica):
  - expone endpoints agregados para cada bloque visual.
  - consume vistas materializadas y tablas agregadas en PostgreSQL.
- `DB analítica (PostgreSQL)`:
  - materialized views por granularidad (`día`, `sede`, `ruta`, `unidad`, `cliente`).
  - índices por `(empresa_id, sede_id, fecha)`.
- `Angular Frontend`:
  - `dashboard-bi` como contenedor.
  - subcomponentes reutilizables por tipo de visual.
  - filtros globales (empresa, sede, fecha desde/hasta).
  - estado por bloque (`loading`, `empty`, `error`).

### Flujo recomendado
1. Usuario aplica filtros globales.
2. Frontend dispara consultas en paralelo por bloque.
3. Backend responde sobre agregados materializados.
4. Frontend renderiza cards/charts con fallback de `empty state`.

## 2. Lista de endpoints (FastAPI)

Base: `/bi/dashboard`

- `GET /kpis`
- `GET /envios-trend`
- `GET /distribucion-sede`
- `GET /ruta-finanzas`
- `GET /transporte-unidad`
- `GET /top-clientes`
- `GET /top-rutas`
- `GET /alertas`

### Query params comunes
- `empresa_id: int` (requerido)
- `sede_id: int | null` (opcional)
- `fecha_desde: date | null` (opcional)
- `fecha_hasta: date | null` (opcional)

## 3. Contratos response JSON

### `GET /bi/dashboard/kpis`
```json
{
  "empresa_id": 1,
  "sede_id": 3,
  "fecha_desde": "2026-03-01",
  "fecha_hasta": "2026-03-22",
  "total_envios": 1240,
  "envios_finalizados": 1110,
  "envios_pendientes": 102,
  "envios_incidencia": 28,
  "cumplimiento_pct": 89.52,
  "costo_total": 180420.10,
  "ingreso_total": 239870.40,
  "ticket_promedio": 193.44
}
```

### `GET /bi/dashboard/envios-trend`
```json
[
  { "fecha": "2026-03-16", "total_envios": 57 },
  { "fecha": "2026-03-17", "total_envios": 63 }
]
```

### `GET /bi/dashboard/distribucion-sede`
```json
[
  { "sede_id": 1, "sede_nombre": "Lima", "total_envios": 580 },
  { "sede_id": 2, "sede_nombre": "Arequipa", "total_envios": 420 }
]
```

### `GET /bi/dashboard/ruta-finanzas`
```json
[
  {
    "ruta_id": 12,
    "ruta_nombre": "Lima - Arequipa",
    "costo_total": 35210.4,
    "ingreso_total": 51590.0
  }
]
```

### `GET /bi/dashboard/transporte-unidad`
```json
[
  {
    "unidad_id": 44,
    "unidad_label": "ABC-123",
    "conductor_id": 8,
    "conductor_nombre": "Carlos Rojas",
    "total_envios": 145
  }
]
```

### `GET /bi/dashboard/top-clientes`
```json
[
  {
    "cliente_id": 99,
    "cliente_nombre": "Comercial Norte SAC",
    "total_envios": 122,
    "monto_total": 48520.9
  }
]
```

### `GET /bi/dashboard/top-rutas`
```json
[
  {
    "ruta_id": 4,
    "ruta_nombre": "Lima - Trujillo",
    "total_envios": 210,
    "monto_total": 70210.0
  }
]
```

### `GET /bi/dashboard/alertas`
```json
[
  {
    "tipo": "Retrasos > 24h",
    "severidad": "alta",
    "total": 14,
    "detalle": "Envíos sin confirmación de entrega"
  },
  {
    "tipo": "SUNAT fallidos",
    "severidad": "media",
    "total": 6,
    "detalle": "Guías con rechazo o ticket pendiente"
  }
]
```

## 4. SQL para agregados (PostgreSQL)

> Ajustar nombres de tablas/campos reales según el esquema productivo.

```sql
-- 1) Base diaria para KPIs y trend
CREATE MATERIALIZED VIEW IF NOT EXISTS bi_mv_envios_diario AS
SELECT
  e.compania_id AS empresa_id,
  e.punto_origen_id AS sede_id,
  DATE(e.fecha_envio) AS fecha,
  COUNT(*) AS total_envios,
  COUNT(*) FILTER (WHERE COALESCE(e.estado_entrega, false) = true) AS envios_finalizados,
  COUNT(*) FILTER (WHERE COALESCE(e.estado_entrega, false) = false) AS envios_pendientes,
  COUNT(*) FILTER (WHERE e.estado_envio IN ('ANULADO', 'INCIDENCIA')) AS envios_incidencia,
  COALESCE(SUM(e.costo_envio), 0) AS costo_total,
  COALESCE(SUM(e.precio_envio), 0) AS ingreso_total
FROM envios e
GROUP BY e.compania_id, e.punto_origen_id, DATE(e.fecha_envio);

CREATE INDEX IF NOT EXISTS idx_bi_mv_envios_diario_filtros
ON bi_mv_envios_diario (empresa_id, sede_id, fecha);

-- 2) Distribución por sede
CREATE MATERIALIZED VIEW IF NOT EXISTS bi_mv_envios_sede AS
SELECT
  e.compania_id AS empresa_id,
  e.punto_origen_id AS sede_id,
  p.nombre AS sede_nombre,
  DATE(e.fecha_envio) AS fecha,
  COUNT(*) AS total_envios
FROM envios e
LEFT JOIN puntos p ON p.id = e.punto_origen_id
GROUP BY e.compania_id, e.punto_origen_id, p.nombre, DATE(e.fecha_envio);

CREATE INDEX IF NOT EXISTS idx_bi_mv_envios_sede_filtros
ON bi_mv_envios_sede (empresa_id, sede_id, fecha);

-- 3) Finanzas por ruta
CREATE MATERIALIZED VIEW IF NOT EXISTS bi_mv_ruta_finanzas AS
SELECT
  e.compania_id AS empresa_id,
  e.punto_origen_id AS sede_id,
  DATE(e.fecha_envio) AS fecha,
  r.id AS ruta_id,
  r.nombre AS ruta_nombre,
  COALESCE(SUM(e.costo_envio), 0) AS costo_total,
  COALESCE(SUM(e.precio_envio), 0) AS ingreso_total,
  COUNT(*) AS total_envios
FROM envios e
LEFT JOIN rutas r ON r.id = e.ruta_id
GROUP BY e.compania_id, e.punto_origen_id, DATE(e.fecha_envio), r.id, r.nombre;

CREATE INDEX IF NOT EXISTS idx_bi_mv_ruta_finanzas_filtros
ON bi_mv_ruta_finanzas (empresa_id, sede_id, fecha);

-- 4) Transporte / unidad / conductor
CREATE MATERIALIZED VIEW IF NOT EXISTS bi_mv_transporte_unidad AS
SELECT
  e.compania_id AS empresa_id,
  e.punto_origen_id AS sede_id,
  DATE(e.fecha_envio) AS fecha,
  v.id AS unidad_id,
  v.placa AS unidad_label,
  c.id AS conductor_id,
  CONCAT_WS(' ', pe.nombre, pe.apellido) AS conductor_nombre,
  COUNT(*) AS total_envios
FROM envios e
LEFT JOIN vehiculos v ON v.id = e.vehiculo_id
LEFT JOIN conductores c ON c.id = e.conductor_id
LEFT JOIN personas pe ON pe.id = c.persona_id
GROUP BY e.compania_id, e.punto_origen_id, DATE(e.fecha_envio), v.id, v.placa, c.id, pe.nombre, pe.apellido;

CREATE INDEX IF NOT EXISTS idx_bi_mv_transporte_unidad_filtros
ON bi_mv_transporte_unidad (empresa_id, sede_id, fecha);

-- 5) Top clientes
CREATE MATERIALIZED VIEW IF NOT EXISTS bi_mv_top_clientes AS
SELECT
  e.compania_id AS empresa_id,
  e.punto_origen_id AS sede_id,
  DATE(e.fecha_envio) AS fecha,
  e.destinatario AS cliente_id,
  COALESCE(p.razon_social, CONCAT_WS(' ', p.nombre, p.apellido)) AS cliente_nombre,
  COUNT(*) AS total_envios,
  COALESCE(SUM(e.precio_envio), 0) AS monto_total
FROM envios e
LEFT JOIN personas p ON p.id = e.destinatario
GROUP BY e.compania_id, e.punto_origen_id, DATE(e.fecha_envio), e.destinatario, p.razon_social, p.nombre, p.apellido;

CREATE INDEX IF NOT EXISTS idx_bi_mv_top_clientes_filtros
ON bi_mv_top_clientes (empresa_id, sede_id, fecha);

-- 6) Top rutas
CREATE MATERIALIZED VIEW IF NOT EXISTS bi_mv_top_rutas AS
SELECT
  e.compania_id AS empresa_id,
  e.punto_origen_id AS sede_id,
  DATE(e.fecha_envio) AS fecha,
  r.id AS ruta_id,
  r.nombre AS ruta_nombre,
  COUNT(*) AS total_envios,
  COALESCE(SUM(e.precio_envio), 0) AS monto_total
FROM envios e
LEFT JOIN rutas r ON r.id = e.ruta_id
GROUP BY e.compania_id, e.punto_origen_id, DATE(e.fecha_envio), r.id, r.nombre;

CREATE INDEX IF NOT EXISTS idx_bi_mv_top_rutas_filtros
ON bi_mv_top_rutas (empresa_id, sede_id, fecha);

-- Refresh recomendado (cron / scheduler)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY bi_mv_envios_diario;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY bi_mv_envios_sede;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY bi_mv_ruta_finanzas;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY bi_mv_transporte_unidad;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY bi_mv_top_clientes;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY bi_mv_top_rutas;
```

## 5. Estructura Angular de componentes

```text
src/app/features/dashboard-bi/
  dashboard-bi.ts
  dashboard-bi.html
  dashboard-bi.css
  components/
    kpi-card/
      kpi-card.component.ts
      kpi-card.component.html
    line-chart/
      line-chart.component.ts
      line-chart.component.html
    donut-chart/
      donut-chart.component.ts
      donut-chart.component.html
    ranking-list/
      ranking-list.component.ts
      ranking-list.component.html
    alerts-list/
      alerts-list.component.ts
      alerts-list.component.html
```

## 6. Implementación inicial del dashboard

- Endpoint route frontend: `/bi`
- Servicio `core/services/bi.ts` extendido con métodos específicos de dashboard.
- Manejo de estado por bloque (`DataState<T>`) con:
  - loading state
  - empty state
  - error state
- Filtros globales:
  - `fecha_desde`, `fecha_hasta`, `sede_id`
  - siempre envía `empresa_id` obtenido del contexto autenticado.
- Fallback temporal para datos existentes:
  - KPIs: `getDashboardKpis` -> fallback `getResumen`
  - Trend: `getDashboardEnviosTrend` -> fallback `getEnviosDia`
  - Top clientes: `getDashboardTopClientes` -> fallback `getClientesTop`
  - Transporte: `getDashboardTransporteUnidad` -> fallback `getRankingConductores`

