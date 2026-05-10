# SP4 — Frontend Design (Alerts + Reports + Audit)

## Visão geral

Frontend do SP4: expõe os 3 módulos transversais entregues pelo backend
SP4 — notificações de estoque baixo (`/notifications`), relatórios
operacionais (`/reports/{consumption|sales|waste|stock-status}`) e
auditoria de mutações sensíveis (`/audit-logs`). Tudo numa única rodada
de spec/plan/PR, seguindo os padrões já consolidados em SP1/SP2/SP3
frontend.

**Objetivo:** ao final, o app fecha o ciclo operacional com observabilidade:
operadores enxergam alertas de estoque baixo em tempo quase real (sino +
página dedicada), donos consultam consumo / vendas / desperdício /
status de estoque com export CSV, e o histórico imutável de mudanças
sensíveis fica auditável por OWNER.

**Stack:** sem mudanças. Next.js 16 (App Router), React 19, Tailwind v4,
axios, TanStack Query v5, RHF, zod, sonner, lucide-react.

---

## Escopo

### Dentro do escopo

- **Sino de notificações no header** (badge ACTIVE, popover com últimas
  5, polling 60s) + `/notifications` (lista paginada com filtros) +
  `/notifications/[id]` (detalhe com botão "Resolver" para OWNER).
- **`/reports`** — hub com 4 cards-link + 4 sub-rotas
  (`/reports/consumption`, `/reports/sales`, `/reports/waste`,
  `/reports/stock-status`). Cada uma: filtros, KPIs (3 cards), tabela,
  botão "Exportar CSV".
- **`/audit-logs`** — lista paginada com filtros (entityType,
  entityId, actorId, action, from/to) + `/audit-logs/[id]` (detalhe com
  payload `before/after` pretty-printed). OWNER-only.
- Sidebar: 3 entradas novas — "Alertas" (`/notifications`),
  "Relatórios" (`/reports`), "Auditoria" (`/audit-logs`, só OWNER).
- Topbar: `<NotificationsBell />` à esquerda do menu de usuário.
- Cross-module invalidation: hooks de mutation que mexem estoque
  passam a invalidar `['notifications']`.
- Helper `useAllUsers` (em `lib/users.ts`) para popular o select de ator
  na auditoria.
- Tests (schemas, hooks, pages, csv) seguindo padrão `ef22711`.

### Fora do escopo

- Gráficos nos relatórios (sem Recharts; só KPI cards + tabelas).
- Export PDF (CSV resolve para o caso operacional).
- Histórico embutido por recurso (auditoria fica global; rodada futura).
- WebSocket / SSE para alertas em tempo real (polling 60s resolve).
- Notificações além de LOW_STOCK (backend abre o enum mas só LOW_STOCK
  existe).
- Configuração de canais externos (email/WhatsApp).
- Edição/criação de audit logs ou notificações via API (são
  read-only/sistema).
- KPIs históricos / dashboards consolidados na home — fica para SP5.

---

## Premissas e decisões

| # | Decisão | Motivo |
|---|---------|--------|
| 1 | URLs em inglês 1:1 com paths do backend; labels em português | Coerente com SP1/SP2/SP3 |
| 2 | Hub `/reports` + 4 sub-rotas dedicadas | Reflete estrutura do backend; escala melhor que tabs num único route; não polui sidebar com 4 itens |
| 3 | Sino no header + página `/notifications` dedicada | Padrão SaaS; alta visibilidade dos alertas operacionais sem espremer filtros num popover |
| 4 | Polling 60s no sino (`refetchInterval: 60_000`) | Latência aceitável para alertas operacionais; sem infra extra (WS/SSE); estoque não muda a cada 15s |
| 5 | Mutations de estoque invalidam `['notifications']` | Reação imediata após ação do próprio usuário, sem esperar tick de 60s |
| 6 | Filtros de relatório **não** persistem em URL (exceção SP1/SP2/SP3) | Relatórios são consultas one-shot; período em URL polui histórico do browser |
| 7 | Exportação CSV client-side (encoding UTF-8 + BOM, separador `;`) | Backend SP4 explicitamente delega export para frontend; abre limpo no Excel pt-BR |
| 8 | Sem gráficos no SP4 — só KPI cards + tabelas | YAGNI; zero dependência nova; foco operacional |
| 9 | Auditoria como página global `/audit-logs` (não embutida em recursos) | Visão cronológica + filtro por ator são valor central; histórico contextual fica para rodada futura |
| 10 | OWNER-guard inline (`<NoAccess />`) em `/audit-logs` e `/audit-logs/[id]` | Mesmo padrão de `/ingredients/[id]/editar`; rota direta também é bloqueada |
| 11 | Toast-only para erros de mutation | Mantém consistência com SP1/SP2/SP3 |
| 12 | Validação `from <= to` inline em filtros de relatório | Exceção justificada por densidade do form; evita ida-volta no servidor |
| 13 | Resolver alerta: `<ConfirmDialog>` com texto explícito sobre não recolocar estoque | Evita confusão com "fix" automático; resolução manual é apenas "vou tratar" |
| 14 | Sem rota `/notifications/[id]/editar` | Notificações só nascem do listener; única mutation é resolve |

---

## Estrutura de arquivos

```
frontend/
├─ app/(protected)/
│  ├─ notifications/
│  │  ├─ page.tsx                       # lista + filtros (status/unidade/datas)
│  │  └─ [id]/page.tsx                  # detalhe + ação "Resolver" (OWNER)
│  ├─ reports/
│  │  ├─ page.tsx                       # hub: 4 cards explicando cada relatório
│  │  ├─ consumption/page.tsx
│  │  ├─ sales/page.tsx
│  │  ├─ waste/page.tsx
│  │  └─ stock-status/page.tsx
│  ├─ audit-logs/
│  │  ├─ page.tsx                       # lista + filtros (OWNER)
│  │  └─ [id]/page.tsx                  # detalhe payload (OWNER)
│  └─ layout.tsx                        # MODIFICAR: 3 entradas + sino no topbar
├─ components/
│  ├─ notifications/
│  │  └─ notifications-bell.tsx         # sino do header (popover + badge + polling)
│  └─ reports/
│     ├─ kpi-card.tsx                   # card compartilhado de KPI
│     └─ export-csv-button.tsx          # gera CSV do JSON
├─ lib/
│  ├─ notifications.ts                  # types + hooks (CRUD-read + resolve)
│  ├─ reports.ts                        # types + hooks read-only (4 endpoints)
│  ├─ audit-logs.ts                     # types + hooks read-only + helpers
│  ├─ users.ts                          # MODIFICAR: + useAllUsers()
│  ├─ stock-movements.ts                # MODIFICAR: invalidar ['notifications']
│  ├─ orders.ts                         # MODIFICAR: useStartOrder invalida ['notifications']
│  ├─ purchase-orders.ts                # MODIFICAR: useReceivePurchase invalida ['notifications']
│  └─ csv.ts                            # toCsv + downloadCsv helpers
└─ tests/
   ├─ schemas.test.ts                   # MODIFICAR: describe para reports filters
   ├─ notifications-hooks.test.ts
   ├─ notifications-page.test.tsx
   ├─ notifications-bell.test.tsx
   ├─ reports-hooks.test.ts
   ├─ reports-page.test.tsx             # cobre os 4 relatórios em describes
   ├─ audit-logs-hooks.test.ts
   ├─ audit-logs-page.test.tsx
   └─ csv.test.ts
```

---

## Roteamento e guards

| Rota | Acesso | Conteúdo |
|------|--------|----------|
| `/notifications` | autenticado | lista + filtros |
| `/notifications/[id]` | autenticado | detalhe; botão "Resolver" só OWNER + status=ACTIVE |
| `/reports` | autenticado | hub com 4 cards-link |
| `/reports/consumption` | autenticado | tela de relatório |
| `/reports/sales` | autenticado | tela de relatório |
| `/reports/waste` | autenticado | tela de relatório |
| `/reports/stock-status` | autenticado | tela de relatório |
| `/audit-logs` | OWNER | lista + filtros (else `<NoAccess />` inline) |
| `/audit-logs/[id]` | OWNER | detalhe (else `<NoAccess />` inline) |

Guards inline (mesmo padrão SP1/SP2/SP3):
- `/audit-logs` e `/audit-logs/[id]`: se `user.role !== 'OWNER'` →
  `<NoAccess />` inline (`<div>` com mensagem, igual
  `/ingredients/[id]/editar`).
- Botão "Resolver" no detalhe de notification: oculto se
  `user.role !== 'OWNER'` ou `status !== 'ACTIVE'`.
- Item "Auditoria" da sidebar só renderiza para OWNER.

**Sidebar (`app/(protected)/layout.tsx`):** adiciona depois de "Pedidos"
(fluxo: cadastrar → comprar → estocar → vender → **monitorar**):
- "Alertas" → `/notifications` (com badge inline mostrando contador
  ACTIVE).
- "Relatórios" → `/reports`.
- "Auditoria" → `/audit-logs` (renderizada **só** se
  `user.role === 'OWNER'`).

**Topbar:** adiciona à esquerda do menu de usuário existente:
- `<NotificationsBell />` — ícone de sino, badge com contagem ACTIVE,
  popover com últimas 5 ativas + link "Ver todas → /notifications".

Ambos (sidebar badge + bell badge + lista do popover) compartilham o
mesmo `useActiveNotificationsBell()` (TanStack com
`refetchInterval: 60_000`, `staleTime: 30_000`,
`refetchOnWindowFocus: true`) — uma única query no DOM.

---

## Módulo: Notifications

### Tela `/notifications`

**Header:** título "Alertas", descrição curta. Sem botão de criar
(notificações nascem só do listener no backend).

**Filtros (URL-persisted):**
- Status — `<Select>` ACTIVE / RESOLVED / Todos. **Default = ACTIVE**.
- Unidade — `<Select>` ativas + "Todas" (`useAllUnits`).
- De / Até — date inputs (envia hora 00:00 / 23:59 antes do request,
  padrão SP2).

**Tabela:**
- Colunas:
  - Ingrediente (`ingredientName`).
  - Unidade (`unitName`).
  - Mensagem (truncada com tooltip — 1 linha).
  - Saldo / Mínimo (`triggeredQuantity` / `minQuantity`, com
    `unitOfMeasure` extraído da `message` via regex; ver "Pontos a
    validar" #2).
  - Status (badge: ACTIVE=âmbar/vermelho, RESOLVED=cinza).
  - Disparado em (`dd/MM/yyyy HH:mm`).
  - Resolvido em (vazio se ACTIVE).
  - Ações: 👁 Ver detalhes → `/notifications/[id]`.
- Paginação 20/pg.
- Estados padrão (loading skeleton, erro com retry, vazio "Nenhum
  alerta no período.").

### Detalhe `/notifications/[id]`

**Layout:** card único com 2 seções.

**Seção "Alerta":** tipo (LOW_STOCK), status (badge), ingrediente (link
→ `/ingredients/[id]`), unidade, mensagem completa, disparado em,
resolvido em, resolvido por (nome do user ou "Resolução automática" se
`resolvedBy === null && status === 'RESOLVED'`).

**Seção "Saldo no disparo":**
- "Quantidade no momento: `{triggeredQuantity}` `{unitOfMeasure}`"
- "Mínimo configurado: `{minQuantity}` `{unitOfMeasure}`"
- Link "Ver estoque atual deste ingrediente nesta unidade" →
  `/stock?ingredient={id}&unit={id}`.

**Ação topo direito:** botão "Resolver" — só visível se
`user.role === 'OWNER'` **e** `status === 'ACTIVE'`. Clicar abre
`<ConfirmDialog>`:

> "Marcar este alerta como resolvido? A resolução manual não recoloca
> estoque — confirme apenas se o problema já foi tratado (compra
> recebida, ajuste lançado, etc.)."

Submit: `POST /notifications/{id}/resolve` → toast verde + invalida
`['notifications']` → permanece na página (status muda para RESOLVED,
botão some).

### `<NotificationsBell />`

**Visual:** ícone `Bell` (lucide), badge **vermelho** com contagem
ACTIVE se `total > 0` (`9+` se ≥10).

**Comportamento:**
- Clique abre popover (`max-w-sm`):
  - Header: "Alertas ativos (`{total}`)" + link "Ver todos →"
    `/notifications`.
  - Lista das 5 mais recentes ACTIVE: ingrediente + unidade + mensagem
    (1 linha truncada) + tempo relativo ("há 2h").
  - Cada item é um link → `/notifications/[id]`.
  - Vazio: "Nenhum alerta ativo no momento."
  - Loading: 3 skeletons.
  - Erro: "Não foi possível carregar alertas. Tentar novamente." (botão
    refetch).

**Polling:** `useActiveNotificationsBell()` (wrapper sobre
`useNotifications({ status: 'ACTIVE', size: 5 })`) com
`refetchInterval: 60_000`, `refetchOnWindowFocus: true`. O badge da
sidebar consome o **mesmo cache** (lê `total`).

### Hooks (`lib/notifications.ts`)

```ts
useNotifications(filters?: {
  status?: NotificationStatus     // default UI: ACTIVE
  unit?: string
  from?: string
  to?: string
  page?: number
  size?: number
})
useNotification(id: string)
useResolveNotification()           // POST /notifications/{id}/resolve (OWNER)
useActiveNotificationsBell()       // wrapper: status='ACTIVE', size=5
                                   // expõe { total, items, isLoading, error }
                                   // refetchInterval 60s, staleTime 30s
                                   // refetchOnWindowFocus: true
```

Query keys: `['notifications', filters]`, `['notifications', id]`. O
sino e o badge da sidebar consomem o **mesmo cache** via
`useActiveNotificationsBell()` — uma única chamada HTTP no DOM.

**Invalidações:**
- `useResolveNotification`: invalida `['notifications']`.
- **Cross-module:** `useApplyEntry/Exit/Adjustment` (`lib/stock-movements.ts`),
  `useStartOrder` (`lib/orders.ts`), `useReceivePurchase`
  (`lib/purchase-orders.ts`) passam a invalidar `['notifications']`
  adicionalmente.

---

## Módulo: Reports

### Tela `/reports` (hub)

**Header:** título "Relatórios", descrição curta.

**Conteúdo:** grid 2x2 de cards-link, cada um com ícone (lucide) +
título + 1 linha descritiva:
- `TrendingDown` **Consumo** — "Total de saídas por ingrediente no
  período." → `/reports/consumption`
- `DollarSign` **Vendas** — "Pedidos concluídos por produto e receita
  gerada." → `/reports/sales`
- `Trash2` **Desperdício** — "Ajustes negativos (perdas, quebras) por
  ingrediente." → `/reports/waste`
- `Package` **Status de estoque** — "Visão atual de saldos vs. mínimos
  por unidade." → `/reports/stock-status`

### Estrutura comum das 4 telas de relatório

Cada tela segue o **mesmo esqueleto**:

1. **Header:** breadcrumb "Relatórios › {nome}", título, descrição.
2. **Card "Filtros":** form RHF+zod, layout horizontal. Filtros **não
   são URL-persisted** — relatórios são consultas one-shot. Botão
   "Aplicar" (submit).
3. **3 Cards de KPI** (`grid-cols-3` desktop / `grid-cols-1` mobile):
   computados client-side a partir de `data`.
4. **Botão "Exportar CSV"** (topo direito da tabela, só renderiza se
   `data.length > 0`).
5. **Tabela** ordenada conforme cada relatório (já vem ordenada do
   backend; frontend respeita a ordem).
6. **Estados:**
   - **Inicial** (`from`/`to` vazios em consumption/sales/waste):
     "Selecione um período e clique em Aplicar."
   - Loading: skeleton da tabela.
   - Erro: retry.
   - Vazio: "Nenhum dado para os filtros selecionados."

### Detalhes por relatório

**`/reports/consumption`**
- Filtros: De / Até / Unidade / Ingrediente.
- Defaults: De = início do mês corrente, Até = hoje.
- KPIs: Total geral / Itens distintos / Ingrediente mais consumido.
- Tabela: Ingrediente | UoM | Total (qty) | # movimentos.

**`/reports/sales`**
- Filtros: De / Até / Unidade / Produto (`useAllProducts`).
- Defaults: De = início do mês, Até = hoje.
- KPIs: Receita total / Pedidos distintos / Produto top.
- Tabela: Produto + Tamanho (badge) | Unidades vendidas | Receita
  (`R$ X,XX`) | # pedidos.

**`/reports/waste`**
- Filtros: De / Até / Unidade / Ingrediente.
- Defaults: De = início do mês, Até = hoje.
- KPIs: Volume desperdiçado / Ajustes registrados / Ingrediente mais
  afetado.
- Tabela: Ingrediente | UoM | Volume desperdiçado | # ajustes.
- **Nota informativa abaixo do título:** "Apenas ajustes do tipo
  DECREASE entram aqui. Ajustes anteriores ao SP4 (sem direção
  registrada) são ignorados."

**`/reports/stock-status`**
- Filtros: Unidade (apenas). Sem datas — é snapshot atual.
- KPIs: Total de itens / Em alerta (LOW) / Em atenção (WARNING).
- Tabela: Ingrediente | UoM | Saldo atual | Mínimo | Nível (badge:
  LOW=vermelho, WARNING=âmbar, OK=verde).

### Hooks (`lib/reports.ts`)

```ts
useConsumptionReport(filters: { from: string; to: string; unit?: string; ingredient?: string })
useSalesReport      (filters: { from: string; to: string; unit?: string; product?: string })
useWasteReport      (filters: { from: string; to: string; unit?: string; ingredient?: string })
useStockStatusReport(filters: { unit?: string })
```

Query keys: `['reports', 'consumption', filters]`, etc. Read-only — sem
invalidações próprias. `enabled: !!from && !!to` para os 3 com período.

Resposta do backend: `{ data: Row[] }` (sem paginação) — interceptor
desembrulha.

### Helper `lib/csv.ts`

```ts
export function toCsv(headers: string[], rows: (string | number)[][]): string
export function downloadCsv(filename: string, csv: string): void
```

**Decisões:**
- Separador: `;` (padrão Excel pt-BR).
- Encoding: UTF-8 com BOM (`﻿` prefixado).
- Escape: aspas duplas + escape de aspas internas (`"` → `""`) quando
  o valor contém `;`, `"` ou `\n`.
- Números: `Number.toLocaleString('pt-BR')` para a planilha humana
  (formato `1.234,56`).

**Componente `<ExportCsvButton />`:**
- Props: `{ filename: string, headers: string[], rows: (string | number)[][] }`.
- `<Button variant="outline">` com ícone `Download`. Disabled se
  `rows.length === 0`.
- Filename padrão: `{relatorio}_{YYYY-MM-DD}.csv`.

---

## Módulo: Audit logs

### Tela `/audit-logs`

**Guard:** se `user.role !== 'OWNER'` → renderiza `<NoAccess />` inline
(`<div>` com mensagem, mesmo padrão de `/ingredients/[id]/editar`).

**Header:** título "Auditoria", descrição "Histórico imutável de
mutações sensíveis no sistema."

**Filtros (URL-persisted):**
- Tipo de entidade — `<Select>` `AUDIT_ENTITY_TYPES` + "Todos".
- ID da entidade — `<Input>` text livre (UUID); validação inline com
  regex se preenchido.
- Ação — `<Select>` `AUDIT_ACTIONS` agrupadas visualmente por entidade
  ("Usuário ›", "Produto ›", etc.) + "Todas". Labels em pt:
  `PRODUCT_PRICE_CHANGED` → "Produto: preço alterado",
  `STOCK_ENTRY` → "Estoque: entrada", etc. Helper
  `formatAuditAction(action): string` em `lib/audit-logs.ts`.
- Ator — `<Select>` usuários (`useAllUsers` — criar em `lib/users.ts`)
  + "Todos".
- De / Até — date inputs (00:00 / 23:59).

**Tabela:**
- Colunas:
  - Data (`dd/MM/yyyy HH:mm`).
  - Ação (badge colorido por categoria: criação=verde, alteração=azul,
    desativação=cinza, ações de estoque/pedido=âmbar).
  - Entidade (`{entityType}` + primeiros 8 chars de `entityId` em
    font-mono).
  - Ator (`actorName`).
  - Detalhes (preview: 1 linha do `details` JSON pretty-resumido — ex:
    `"price: 45.90 → 49.90"` para `PRODUCT_PRICE_CHANGED`; fallback
    `"…"`).
  - Ações: 👁 Ver detalhes → `/audit-logs/[id]`.
- Paginação 20/pg.

**Helper `summarizeAuditDetails(action, details): string`:**
- Casos curados:
  - `*_PRICE_CHANGED` / `*_MIN_UPDATED` → `"X → Y"`.
  - `*_ROLE_CHANGED` → `"OWNER → EMPLOYEE"`.
  - `STOCK_ENTRY/EXIT/ADJUSTMENT` → `"{quantity} {uom}"`.
  - `ORDER_CREATED/UPDATED` → `"{itemsCount} itens, R$ {totalPrice}"`.
- Default: `Object.keys(details).slice(0,2).join(', ')` ou `"—"` se
  `null`.

### Detalhe `/audit-logs/[id]`

**Guard:** OWNER (mesmo `<NoAccess />`).

**Header:** breadcrumb "Auditoria › {action}", título com label em pt.

**Card "Informações":**
- Data completa (`dd/MM/yyyy HH:mm:ss`).
- Ação (badge + label pt).
- Tipo de entidade.
- ID da entidade (`<code>` font-mono + botão copiar). Se `entityType`
  for um recurso navegável (`Product`, `Ingredient`, `Order`,
  `PurchaseOrder`, `User`, `Unit`), mostra link "Ver recurso →"
  (best-effort).
- Ator: `actorName` + link `/usuarios/[actorId]` (se rota existir).

**Card "Payload":**
- Se `details` tem `before` e `after` → renderiza **diff lado a lado**
  (2 colunas: "Antes" / "Depois", chaves alinhadas, valores
  diferentes destacados em âmbar). Helper simples client-side, sem
  lib externa.
- Caso contrário → JSON pretty-printed
  (`JSON.stringify(details, null, 2)`) num `<pre>` com fonte mono +
  botão "Copiar JSON".
- Se `details === null` → "Sem detalhes adicionais."

**Sem ações** — logs são read-only por design.

### Hooks (`lib/audit-logs.ts`)

```ts
export const AUDIT_ACTIONS = [
  'USER_CREATED','USER_UPDATED','USER_DEACTIVATED','USER_ROLE_CHANGED',
  'UNIT_CREATED','UNIT_UPDATED','UNIT_DEACTIVATED',
  'INGREDIENT_CREATED','INGREDIENT_UPDATED','INGREDIENT_MIN_UPDATED','INGREDIENT_DEACTIVATED',
  'PRODUCT_CREATED','PRODUCT_UPDATED','PRODUCT_PRICE_CHANGED','PRODUCT_RECIPE_CHANGED','PRODUCT_DEACTIVATED',
  'STOCK_ENTRY','STOCK_EXIT','STOCK_ADJUSTMENT',
  'PURCHASE_ORDER_CREATED','PURCHASE_ORDER_RECEIVED','PURCHASE_ORDER_CANCELED',
  'ORDER_CREATED','ORDER_UPDATED','ORDER_STARTED','ORDER_COMPLETED','ORDER_CANCELED',
] as const

useAuditLogs(filters?: {
  entityType?: AuditEntityType
  entityId?: string
  actorId?: string
  action?: AuditAction
  from?: string
  to?: string
  page?: number
  size?: number
})
useAuditLog(id: string)
```

Query keys: `['audit-logs', filters]`, `['audit-logs', id]`. Read-only
— sem mutations.

---

## Tipos e schemas

### `lib/notifications.ts`

```ts
export const NOTIFICATION_TYPES = ['LOW_STOCK'] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const NOTIFICATION_STATUSES = ['ACTIVE', 'RESOLVED'] as const
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number]

export type Notification = {
  id: string
  type: NotificationType
  status: NotificationStatus
  ingredientId: string
  ingredientName: string
  unitId: string
  unitName: string
  message: string
  triggeredQuantity: number
  minQuantity: number
  createdAt: string
  resolvedAt: string | null
  resolvedBy: { id: string; name: string } | null  // ver "Pontos a validar" #1
}
```

### `lib/reports.ts`

```ts
export type ConsumptionReportRow = {
  ingredientId: string
  ingredientName: string
  unitOfMeasure: string
  totalQuantity: number
  movementCount: number
}

export type SalesReportRow = {
  productId: string
  productName: string
  size: 'P' | 'M' | 'G' | 'GG'
  unitsSold: number
  revenue: number
  ordersCount: number
}

export type WasteReportRow = {
  ingredientId: string
  ingredientName: string
  unitOfMeasure: string
  wasteQuantity: number
  adjustmentCount: number
}

export type StockStatusRow = {
  ingredientId: string
  ingredientName: string
  unitOfMeasure: string
  currentQuantity: number
  minQuantity: number
  level: 'LOW' | 'WARNING' | 'OK'
}

// Validação de filtros (client-side; from <= to)
export const reportsFiltersSchema = z.object({
  from: z.string().min(1, 'Informe a data inicial'),
  to: z.string().min(1, 'Informe a data final'),
  unit: z.string().optional(),
  ingredient: z.string().optional(),
  product: z.string().optional(),
}).refine(
  (v) => new Date(v.from) <= new Date(v.to),
  { path: ['to'], message: '"Até" deve ser ≥ "De"' }
)
```

### `lib/audit-logs.ts`

```ts
export const AUDIT_ENTITY_TYPES = [
  'User','Unit','Ingredient','Product','StockMovement','PurchaseOrder','Order',
] as const
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number]

export type AuditLog = {
  id: string
  action: AuditAction
  entityType: AuditEntityType | string   // string fallback para extensão futura
  entityId: string
  actorId: string
  actorName: string                       // ver "Pontos a validar" #3
  details: Record<string, unknown> | null // JSONB livre
  createdAt: string
}
```

### Convenções compartilhadas

- Strings vazias em filtros opcionais → omitidas do querystring (mesma
  convenção SP1/SP2/SP3).
- Tratamento de erro 400/409 reaproveita o `ApiError` normalizado pelo
  interceptor do axios.
- `staleTime` para listas usadas em selects (usuários ativos, etc):
  5 minutos.
- Polling do sino: `refetchInterval: 60_000`, `staleTime: 30_000`,
  `refetchOnWindowFocus: true`.

---

## Tratamento de erros (UX)

Mantém **toast-only** (consistência SP1/SP2/SP3). Validações de filtro
de relatório são exceção (inline) por densidade do form.

| Cenário | Tratamento |
|---|---|
| `POST /notifications/{id}/resolve` em alerta já RESOLVED (race) | Toast vermelho com `err.message`; refetch automático |
| `POST /notifications/{id}/resolve` sem permissão (EMPLOYEE direto) | UI já oculta botão; backend 403 → toast genérico |
| `GET /reports/*` com `from > to` | Validação client-side (zod `.refine`) — erro inline em "Até" |
| `GET /reports/*` lista vazia | Estado "Nenhum dado para os filtros selecionados." |
| `GET /audit-logs` com EMPLOYEE | UI oculta sidebar; rota direta → `<NoAccess />` |
| `GET /audit-logs/[id]` inexistente | Toast vermelho + redirect para `/audit-logs` |
| Polling do sino falha | Silencioso; badge fica congelado; próximo tick tenta de novo |
| Listeners do backend gerarem alerta entre tela load e refresh | Polling 60s + invalidação após mutations cobrem |

---

## Testes

Vitest + RTL, padrão `ef22711`.

**Schema tests** (`tests/schemas.test.ts` — adicionar describes):
- `reportsFiltersSchema`: `from > to` falha; campos obrigatórios para
  consumption/sales/waste; opcionais para stock-status; UUIDs em
  ingredient/product/unit.

**Hooks/API tests:**
- `tests/notifications-hooks.test.ts`:
  - `useNotifications({ status, unit, from, to, page, size })` monta
    querystring esperada.
  - `useResolveNotification` envia `POST /notifications/{id}/resolve`
    sem body e invalida `['notifications']`.
  - `useActiveNotificationsBell` faz uma chamada com `status: 'ACTIVE'`
    e `size: 5`, expondo `{ total, items }` para badge + popover.
  - Polling: assert `refetchInterval` configurado (sem rodar timers).
  - **Cross-module:** `useApplyEntry/Exit/Adjustment`, `useStartOrder`,
    `useReceivePurchase` invalidam `['notifications']`.
- `tests/reports-hooks.test.ts`:
  - Cada hook monta querystring com filtros opcionais omitidos.
  - `enabled: false` quando `from`/`to` faltam (consumption/sales/
    waste).
  - `useStockStatusReport` chama mesmo sem unit.
- `tests/audit-logs-hooks.test.ts`:
  - `useAuditLogs(filters)` monta querystring com todos opcionais.
  - `useAuditLog(id)` consome envelope `{ data: ... }`.

**Page/Component tests:**
- `tests/notifications-page.test.tsx`:
  - Filtro de status persiste em URL (default ACTIVE).
  - Tabela renderiza colunas corretas.
  - EMPLOYEE não vê botão "Resolver"; OWNER vê.
  - ConfirmDialog em "Resolver" → POST + toast.
- `tests/notifications-bell.test.tsx`:
  - Badge mostra contagem; `9+` para ≥10.
  - Popover abre com 5 itens; vazio mostra mensagem neutra.
  - Link "Ver todas" navega para `/notifications`.
- `tests/reports-page.test.tsx` (cobre 4 sub-rotas em describes):
  - Estado inicial (sem from/to) renderiza "Selecione um período…".
  - Aplicar filtros dispara fetch e mostra tabela + KPIs.
  - KPIs computados client-side conferem com data mockada.
  - `<ExportCsvButton />` desabilitado se vazio; clique gera Blob com
    BOM + `;`.
  - Stock-status não exige período; renderiza imediatamente.
- `tests/audit-logs-page.test.tsx`:
  - EMPLOYEE → `<NoAccess />`.
  - OWNER vê filtros + tabela.
  - `summarizeAuditDetails` para `PRODUCT_PRICE_CHANGED` mostra
    `"X → Y"`.
  - Detalhe renderiza diff before/after quando ambos existem; JSON
    puro caso contrário.
- `tests/csv.test.ts`:
  - `toCsv` escapa aspas, separadores e quebras de linha.
  - Output começa com BOM (`﻿`).
  - Números formatados em pt-BR.
  - `downloadCsv` chama `URL.createObjectURL` (mock) + cria/clica/
    remove `<a>`.

Sem coverage gates novos.

---

## Critérios de pronto

- [ ] Sidebar leva às 3 rotas novas sem 404 (Auditoria só visível para
      OWNER).
- [ ] Sino renderiza no topbar autenticado, com badge consistente entre
      sidebar e popover.
- [ ] **Notifications:**
  - [ ] `/notifications` lista filtrada por status (default ACTIVE),
        unidade, datas; filtros persistem em URL.
  - [ ] Detalhe renderiza dados + link para estoque do ingrediente.
  - [ ] OWNER consegue resolver alerta ACTIVE; status muda para
        RESOLVED + `resolvedBy` aparece.
  - [ ] EMPLOYEE não tem botão "Resolver".
  - [ ] Resolução automática (saldo subiu acima do mínimo) reflete no
        sino sem refresh manual após mutation de estoque.
- [ ] **Reports:**
  - [ ] `/reports` mostra hub com 4 cards-link.
  - [ ] Cada relatório aceita filtros, valida `from <= to` inline,
        mostra KPIs e tabela.
  - [ ] Botão "Exportar CSV" baixa arquivo que abre limpo no Excel
        pt-BR (acentos OK, separador `;`).
  - [ ] Stock-status renderiza sem precisar de período.
- [ ] **Audit logs:**
  - [ ] EMPLOYEE recebe `<NoAccess />` em `/audit-logs` e
        `/audit-logs/[id]`.
  - [ ] OWNER vê listagem com filtros funcionais; preview de detalhes
        resumido por action.
  - [ ] Detalhe mostra diff before/after pretty-printed quando
        aplicável.
- [ ] Toasts em sucesso/erro de todas as mutations.
- [ ] Tests novos passam.
- [ ] `npm run build` sem warnings; `npm run test` verde.

---

## Pontos de atenção a validar na fase de plano

1. **`NotificationResponse.resolvedBy`** — design do backend mostra
   `"resolvedBy": null` no exemplo, comportamento manual deveria
   preencher com user. Plano confirma o shape real (string ID? objeto
   `{id,name}`? só nome?). Default no design: objeto `{id, name}`. Se o
   backend devolver só `id`, hook resolve via `useUsers` map; se
   devolver string nome, ajuste cosmético.
2. **`unitOfMeasure` na listagem de notifications** —
   `NotificationResponse` do backend não inclui (só
   `triggeredQuantity`/`minQuantity` numéricos). Default: extrair da
   `message` via regex (mensagem é determinística:
   `"<ingredientName> abaixo do mínimo na unidade <unitName>: <qty> <uom> ≤ <min> <uom>"`).
   Alternativa: enriquecer client-side via `useAllIngredients` map.
   Plano decide qual é mais barato.
3. **`AuditLogResponse.actorName`** — backend desnormaliza? Spec mostra
   `"actorName": "guilherme"` no exemplo. Se sim, sem trabalho no
   front. Se vier só `actorId`, resolve via `useAllUsers` map (mesmo
   padrão SP2/SP3).
4. **Listagem de notifications shape** — design assume
   `Page<NotificationResponse>` (mesma convenção SP1/SP2/SP3). Plano
   confirma com `GET /notifications`.
5. **`useAllUsers` helper** — não existe ainda; plano cria em
   `lib/users.ts` (mesmo padrão de `useAllIngredients`/`useAllUnits`).
   Cuidado: backend pode exigir OWNER para `GET /users` listing —
   neste caso o helper só é chamado dentro de `/audit-logs` (que já é
   OWNER).
6. **Cross-module invalidation** — modificar
   `useApplyEntry/Exit/Adjustment` (`lib/stock-movements.ts`),
   `useStartOrder` (`lib/orders.ts`), `useReceivePurchase`
   (`lib/purchase-orders.ts`) para invalidar `['notifications']`.
   Plano lista os arquivos exatos com line numbers.
7. **CSV pt-BR vs análise programática** — design optou por números
   formatados pt-BR (`1.234,56`) para "abrir no Excel". Análise em
   Python/R precisaria pós-processamento. Aceito como tradeoff.
8. **Backend pagination param para `/notifications` e `/audit-logs`** —
   `?page=&size=` (padrão SP1/SP2 da maioria) ou `?page=&pageSize=`
   (que `/products` usa). Plano confirma e ajusta o hook.
9. **`AUDIT_ENTITY_TYPES` literais** — spec do backend lista exemplos
   (`'Product'`, `'Ingredient'`, `'Order'`, `'StockMovement'`); plano
   confirma se backend grava capitalizado ou diferente, e ajusta o
   enum/select do front.
