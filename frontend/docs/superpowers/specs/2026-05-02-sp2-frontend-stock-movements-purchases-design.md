# SP2 — Frontend Design (Stock + Movements + Purchases)

## Visão geral

Frontend do SP2: completa as 3 telas que o backend já suporta — saldo de
estoque (`/stock`), histórico de movimentações com criação de ajustes
(`/stock-movements`), e ordens de compra com workflow PENDING → RECEIVED /
CANCELED (`/purchase-orders`). Tudo numa única rodada de spec/plan/PR,
seguindo os padrões já estabelecidos no SP1 frontend.

**Objetivo:** ao final, o app expõe operação completa de estoque para a
pizzaria — visualizar saldos, registrar ajustes manuais, criar e processar
compras — pareado 1:1 com os endpoints do backend SP2.

**Stack:** sem mudanças. Next.js 16 (App Router), React 19, Tailwind v4,
axios, TanStack Query, RHF, zod, sonner, lucide-react.

---

## Escopo

### Dentro do escopo

- `/stock` — listagem com filtros (unidade, ingrediente, "abaixo do mínimo"),
  badge de alerta e coluna "Mínimo".
- `/stock-movements` — listagem com filtros + criação de ADJUSTMENT via modal.
- `/purchase-orders` — listagem com filtros, rotas dedicadas para criar/editar
  (com `useFieldArray` para itens), página de detalhe com ações
  receive/cancel.
- Atualização da sidebar:
  - `/compras` → `/purchase-orders`
  - `/movments` → `/stock-movements` (corrige typo)
  - `/stock` mantém
- Hooks helper `useAllUnits` (SP1 só tem `useUnits` paginado) e
  `useAllIngredients` (SP1 só tem `useIngredients` paginado). Necessários
  para popular dropdowns de filtro (unidade, ingrediente) em `/stock`,
  `/stock-movements`, `/purchase-orders` e selects no modal de ajuste e no
  form de PO. `createdByName`, `supplierName`, `unitName`, `ingredientName`
  já vêm desnormalizados do backend, então nenhum `useAllUsers` é
  necessário.
- Tests (schemas, hooks, pages) seguindo padrão do `ef22711`.

### Fora do escopo

- Saídas (EXIT) — virão no SP3 com pedidos do cliente.
- RETURN como tipo de movimento — backend usa ADJUSTMENT.
- Partial receipt de PO — backend é tudo-ou-nada.
- Notificações de baixo estoque — fica no SP4.
- Recibo / PDF de PO.
- Dashboard / home com widgets de estoque baixo — home segue placeholder.
- Filtro `?purchaseOrderId=` em `/stock-movements` — só será usado se já
  existir no backend; caso contrário, a seção "Movimentações geradas" no
  detalhe da PO fica oculta (degrada graciosamente).

---

## Premissas e decisões

| # | Decisão | Motivo |
|---|---------|--------|
| 1 | URLs em inglês 1:1 com paths do backend (`/stock`, `/stock-movements`, `/purchase-orders`); labels em português | Coerente com SP1; reduz cognitive load; sidebar ajusta 2 hrefs (corrige typo) |
| 2 | Tela de stock única; "abaixo do mínimo" = filtro toggle + badge na coluna | Sem rota extra; persiste em URL |
| 3 | Movements: criação de ajuste via **modal**; sem rota de detalhe | Form de ajuste tem 5 campos curtos — modal cabe; tabela cobre o resto |
| 4 | POs: rotas dedicadas (`/nova`, `/{id}/editar`, `/{id}` detalhe); items com `useFieldArray` | Único módulo do projeto com complexidade que justifica rotas dedicadas |
| 5 | Form de PO: pré-popula `unitPrice` com `averageCost` do ingrediente; total calculado client-side; ingredientes não filtrados por supplier | Acelera caso comum sem restringir flexibilidade operacional |
| 6 | ConfirmDialog para receive (irreversível, mexe em estoque + custo médio) e cancel | Segurança; especialmente receive |
| 7 | Toast-only para erros de mutation | Mantém consistência com SP1; banners por campo ficam pra rodada futura |
| 8 | Status default no filtro de `/purchase-orders` = PENDING | É o que o usuário quer ver primeiro (compras em aberto) |
| 9 | "Nº" da PO na listagem = primeiros 8 chars do UUID | UUIDs completos poluem; backend não tem `order_number` |
| 10 | Edição de PO bloqueada em rotas se status ≠ PENDING (renderiza `<NoAccess />`) | Espelha a regra do backend; UX preventiva |

---

## Estrutura de arquivos

```
frontend/
├─ app/(protected)/
│  ├─ stock/
│  │  └─ page.tsx                    # listagem + filtros
│  ├─ stock-movements/
│  │  ├─ page.tsx                    # listagem + filtros
│  │  └─ adjustment-dialog.tsx       # modal "novo ajuste" (OWNER)
│  └─ purchase-orders/
│     ├─ page.tsx                    # listagem + filtros
│     ├─ purchase-order-form.tsx     # form compartilhado (criar/editar)
│     ├─ nova/page.tsx
│     ├─ [id]/page.tsx               # detalhe + ações
│     └─ [id]/editar/page.tsx
├─ lib/
│  ├─ stock.ts                       # types + hooks (read-only)
│  ├─ stock-movements.ts             # types + zod + hooks (read + createAdjustment)
│  ├─ purchase-orders.ts             # types + zod + hooks (CRUD + actions)
│  ├─ ingredients.ts                 # extend: + useAllIngredients()
│  └─ units.ts                       # extend: + useAllUnits()
└─ tests/
   ├─ lib/
   │  ├─ stock.test.ts
   │  ├─ stock-movements.schema.test.ts
   │  ├─ stock-movements.test.ts
   │  ├─ purchase-orders.schema.test.ts
   │  └─ purchase-orders.test.ts
   └─ app/
      ├─ stock.test.tsx
      ├─ stock-movements.test.tsx
      ├─ purchase-orders.test.tsx
      └─ purchase-order-form.test.tsx
```

---

## Roteamento e guards

| Rota | Acesso | Conteúdo |
|------|--------|----------|
| `/stock` | autenticado | lista com filtros |
| `/stock-movements` | autenticado (leitura), OWNER (criar ajuste) | lista + modal de ajuste |
| `/purchase-orders` | autenticado (leitura), OWNER (criar/editar/receive/cancel) | lista |
| `/purchase-orders/nova` | OWNER | form de criação |
| `/purchase-orders/[id]` | autenticado | detalhe com ações condicionais |
| `/purchase-orders/[id]/editar` | OWNER + status=PENDING | form de edição |

Guards inline (mesmo padrão `/ingredients`):
- Listagens: botões mutativos só renderizam para OWNER.
- Rotas dedicadas (`/nova`, `/{id}/editar`): se `user.role !== 'OWNER'` →
  `<NoAccess />`.
- `/purchase-orders/[id]/editar`: se PO já não está PENDING (carregado),
  `<NoAccess />` com mensagem específica e link "Voltar para a compra".

**Sidebar (`app/(protected)/layout.tsx`):** atualizar 2 hrefs:
- `/compras` → `/purchase-orders`
- `/movments` → `/stock-movements`
- `/stock` mantém

---

## Módulo: Stock

### Tela `/stock`

**Header:** título "Estoque", descrição curta. Sem botão de ação (não tem
mutações públicas).

**Barra de filtros (URL-persisted):**
- "Unidade": dropdown de unidades ativas + "Todas".
- "Ingrediente": dropdown de ingredientes ativos + "Todos".
- "Apenas abaixo do mínimo": toggle/checkbox (URL key `?belowMin=true`).
  Quando ativo, a página passa a consumir `useLowStock()` em vez de
  `useStock()` — ou seja, swapa a query para `GET /stock/low` e ignora os
  outros filtros (backend não combina).

**Tabela:**
- Colunas:
  - Ingrediente (`ingredientName`, vem desnormalizado do backend).
  - Unidade (`unitName`).
  - Quantidade (`{quantity} {unitOfMeasure}`).
  - Mínimo (`{minimumQty} {unitOfMeasure}`).
  - Custo médio (`R$ {averageCost}`, 4 casas).
  - Status (badge "Abaixo" vermelho se `belowMinimum`, "OK" verde caso
    contrário).
  - Atualizado em (`updatedAt`).
- Paginação 20/pg.
- Estados: loading skeleton (5 linhas), erro com retry, vazio
  ("Nenhum saldo registrado.").

**Observação:** o `unitOfMeasure` mostrado vem do `ingredient` referenciado
(SP1). O `StockResponse` não inclui esse campo — confirmar no plano: ou (a)
o backend passa a expor `unitOfMeasure` no `StockResponse`, ou (b) front
resolve via `useAllIngredients()` map. **Default do design:** opção (b)
(menos invasiva no backend).

### Hooks (`lib/stock.ts`)

```ts
useStock(filters?: { unit?: string; ingredient?: string; page?: number; size?: number })
useStockItem(id: string)
useLowStock(params?: { page?: number; size?: number })
```

Sem mutations. Query keys: `['stock', { unit, ingredient, page, size }]`,
`['stock', id]`, `['stock', 'low', { page, size }]`.

---

## Módulo: Stock Movements

### Tela `/stock-movements`

**Header:** título "Movimentações", descrição. Botão "+ Novo ajuste" (só
OWNER) → abre `<AdjustmentDialog>`.

**Barra de filtros (URL-persisted):**
- Ingrediente, Unidade, Tipo (Todos / ENTRY / EXIT / ADJUSTMENT), De (date),
  Até (date).

**Tabela:**
- Colunas:
  - Data/hora (`createdAt`, formato `dd/MM/yyyy HH:mm`).
  - Tipo (badge colorido — ENTRY=verde, EXIT=vermelho, ADJUSTMENT=amarelo).
  - Ingrediente (`ingredientName`).
  - Unidade (`unitName`).
  - Quantidade (com sinal derivado do tipo: `+5,000` para ENTRY/INCREASE,
    `−2,000` para EXIT/DECREASE; cor verde/vermelha respectivamente).
  - Preço unit. (só ENTRY: `R$ {unitPrice}`; "—" para outros).
  - Origem/Motivo:
    - Se `purchaseOrderId`: link "Compra #{8-chars-uuid}" → `/purchase-orders/{id}`.
    - Se ADJUSTMENT: `reason` (truncado com ellipsis se longo).
    - Senão: "—".
  - Por (`createdByName`).
- Paginação 20/pg.
- Estados padrão (loading/erro/vazio).

### `adjustment-dialog.tsx`

Modal de "Novo ajuste". Reutiliza `<Modal>` de `components/overlays/`.

**Campos:**
| Campo | UI | Validação |
|-------|-----|-----------|
| `ingredientId` | `<Select>` ingredientes ativos | UUID, obrigatório |
| `unitId` | `<Select>` unidades ativas | UUID, obrigatório |
| `quantity` | input number step=0.001 | > 0, obrigatório |
| `direction` | radio "Aumentar" / "Diminuir" | enum INCREASE/DECREASE |
| `reason` | textarea | 1-255, obrigatório |

**Submit:** `POST /stock-movements` com `CreateAdjustmentRequest`. Sucesso
→ fecha modal, invalida `['stock-movements']` e `['stock']` (saldo mudou),
toast verde. Erro → toast vermelho com `err.message` (saldo insuficiente em
DECREASE, ingrediente/unidade inexistente, etc).

### Hooks (`lib/stock-movements.ts`)

```ts
useStockMovements(filters?: {
  ingredient?: string; unit?: string; type?: MovementType
  from?: string; to?: string; page?: number; size?: number
})
useStockMovement(id: string)
useCreateAdjustment()       // POST /stock-movements
```

Query keys: `['stock-movements', { ingredient, unit, type, from, to, page, size }]`.
`useCreateAdjustment` invalida `['stock-movements']` e `['stock']`.

---

## Módulo: Purchase Orders

### Listagem `/purchase-orders`

**Header:** título "Compras", descrição, botão "+ Nova compra" (só OWNER) →
`/purchase-orders/nova`.

**Filtros (URL-persisted):**
- Status (default = PENDING; opções PENDING/RECEIVED/CANCELED/Todos).
- Fornecedor (dropdown, todos os fornecedores ativos + "Todos").
- Unidade (dropdown, ativas + "Todas").
- De (date), Até (date).

**Tabela:**
- Colunas:
  - Nº (primeiros 8 chars do UUID, com `font-mono`).
  - Fornecedor (`supplierName`).
  - Unidade (`unitName`).
  - Status (badge: PENDING=amarelo, RECEIVED=verde, CANCELED=cinza).
  - Data esperada (`expectedAt`, "—" se null).
  - Total (`R$ {totalCost}`, 2 casas).
  - Criado em.
  - Ações:
    - `👁` Ver detalhes (todos) → `/purchase-orders/{id}`.
    - `✏️` Editar (OWNER + status=PENDING) → `/purchase-orders/{id}/editar`.
- Paginação 20/pg.
- Estados padrão.

### Form (`purchase-order-form.tsx`)

Componente compartilhado consumido por `nova/page.tsx` e
`[id]/editar/page.tsx`. Recebe modo (`create` | `edit`), `defaultValues` e
callback de submit.

**Layout:** card `max-w-3xl` centrado, breadcrumb leve no topo
("Compras › Nova" ou "Compras › Editar #abc12345"), título, form em duas
seções.

**Seção 1 — Dados da compra:**
- `supplierId`: `<Select>` fornecedores ativos, obrigatório.
- `unitId`: `<Select>` unidades ativas, obrigatório.
- `expectedAt`: input date, opcional.
- `notes`: textarea, ≤500, opcional.

**Seção 2 — Itens (gerenciada por `useFieldArray` do RHF):**
- Tabela editável; uma linha por item:
  - **Ingrediente** (`<Select>` de ingredientes ativos, obrigatório).
    `onChange`: se `unitPrice` da linha está vazio, popula com
    `ingredient.averageCost`.
  - **Quantidade** (`number` step=0.001, > 0).
  - **Preço unit.** (`number` step=0.0001, > 0).
  - **Subtotal** (calculado, read-only: `qty × unitPrice`).
  - Botão `🗑` remover linha (desabilitado se for a única linha).
- Botão "+ Adicionar item" abaixo da tabela.
- Linha de "**Total: R$ X,XX**" abaixo (Σ subtotais).

**Validação client-side:** ≥1 item, sem ingredientes duplicados (zod
`.refine`), todos os campos obrigatórios. Erros do RHF aparecem inline
(label vermelho + helper text) — exceção à regra "toast-only", que vale só
para erros do servidor.

**Rodapé:** "Cancelar" (volta para `/purchase-orders` no modo create, ou
`/purchase-orders/{id}` no modo edit) e "Salvar".

**Submit:**
- Criar: `POST /purchase-orders` → toast verde → `router.replace('/purchase-orders/{id}')`.
- Editar: `PUT /purchase-orders/{id}` → toast verde → `router.replace('/purchase-orders/{id}')`.
- Erro: toast vermelho com `err.message`. Casos típicos: ingrediente
  inativo, supplier inativo, item duplicado (caso a validação client-side
  seja burlada), PO não-PENDING para editar.

**Página de edição (`/purchase-orders/[id]/editar`):**
- Pre-fetch via `usePurchaseOrder(id)` para popular `defaultValues`.
- Se `status !== 'PENDING'` → `<NoAccess />` específico:
  > "Esta compra já está {status} e não pode mais ser editada."
- Loading: skeleton do form.
- Erro de carregamento: mensagem com retry/voltar (igual `/ingredients/[id]/editar`).

### Detalhe `/purchase-orders/[id]`

**Header:** breadcrumb "Compras › #abc12345", título, badge de status
grande.

**Ações no topo direito (condicionais e só OWNER):**
- Se `status === 'PENDING'`:
  - "Editar" (link → `/{id}/editar`).
  - "Receber" (button → `<ConfirmDialog>` → `POST /{id}/receive`).
  - "Cancelar" (button → `<ConfirmDialog>` → `POST /{id}/cancel`).
- Se `status === 'RECEIVED'` ou `'CANCELED'`: nenhuma ação (só visualização).

**ConfirmDialog "Receber":**
> "Confirmar recebimento desta compra? Esta ação adiciona os itens ao
> estoque, atualiza o custo médio dos ingredientes e **não pode ser
> desfeita**."

**ConfirmDialog "Cancelar":**
> "Cancelar esta compra? Esta ação não pode ser desfeita."

**Conteúdo:**
- **Card "Dados da compra":** supplier, unit, status, datas (esperada,
  recebida, cancelada — só as preenchidas), criador, notes.
- **Card "Itens":** tabela read-only — ingrediente, qty, unitPrice,
  subtotal. Footer com **Total: R$ X,XX**.
- **Card "Movimentações geradas"** (condicional):
  - Aparece **apenas se `status === 'RECEIVED'`** E o backend suportar
    filtro `?purchaseOrderId=` em `/stock-movements`.
  - Se o filtro não existir no backend (a confirmar na fase de plano), o
    card é **omitido** desta entrega — graceful degradation; pode ser
    adicionado em rodada futura quando o filtro for adicionado ao backend.

### Hooks (`lib/purchase-orders.ts`)

```ts
usePurchaseOrders(filters?: {
  status?: PurchaseOrderStatus; supplier?: string; unit?: string
  from?: string; to?: string; page?: number; size?: number
})
usePurchaseOrder(id: string)
useCreatePurchaseOrder()
useUpdatePurchaseOrder()    // só funciona se backend aceitar (status=PENDING)
useReceivePurchaseOrder()   // POST /{id}/receive
useCancelPurchaseOrder()    // POST /{id}/cancel
```

**Invalidação após mutations:**
- `useCreate` / `useUpdate` / `useCancel`: invalidam `['purchase-orders']`.
- `useReceive`: invalida `['purchase-orders']`, `['stock']`,
  `['stock-movements']` (todos os 3 mudam de fato).

---

## Tipos e schemas

### `lib/stock.ts`

```ts
export type Stock = {
  id: string
  ingredientId: string
  ingredientName: string
  unitId: string
  unitName: string
  quantity: number
  minimumQty: number
  belowMinimum: boolean
  averageCost: number
  updatedAt: string
}
```

Sem schemas zod (read-only).

### `lib/stock-movements.ts`

```ts
export const MOVEMENT_TYPES = ['ENTRY', 'EXIT', 'ADJUSTMENT'] as const
export type MovementType = (typeof MOVEMENT_TYPES)[number]

export const ADJUSTMENT_DIRECTIONS = ['INCREASE', 'DECREASE'] as const
export type AdjustmentDirection = (typeof ADJUSTMENT_DIRECTIONS)[number]

export type StockMovement = {
  id: string
  ingredientId: string
  ingredientName: string
  unitId: string
  unitName: string
  type: MovementType
  quantity: number          // sempre positivo; sinal derivado de `type`
  unitPrice: number | null  // só ENTRY
  reason: string | null     // só ADJUSTMENT
  purchaseOrderId: string | null
  createdById: string
  createdByName: string
  createdAt: string
}

export const createAdjustmentSchema = z.object({
  ingredientId: z.string().regex(UUID_REGEX, 'Selecione um ingrediente'),
  unitId: z.string().regex(UUID_REGEX, 'Selecione uma unidade'),
  quantity: z.coerce.number().positive('Informe uma quantidade positiva'),
  direction: z.enum(ADJUSTMENT_DIRECTIONS),
  reason: z.string().min(1, 'Informe o motivo').max(255),
})
export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>
```

### `lib/purchase-orders.ts`

```ts
export const PURCHASE_ORDER_STATUSES = ['PENDING', 'RECEIVED', 'CANCELED'] as const
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number]

export type PurchaseOrderItem = {
  id: string
  ingredientId: string
  ingredientName: string
  quantity: number
  unitPrice: number
}

export type PurchaseOrder = {
  id: string
  supplierId: string
  supplierName: string
  unitId: string
  unitName: string
  status: PurchaseOrderStatus
  totalCost: number
  notes: string | null
  expectedAt: string | null
  receivedAt: string | null
  canceledAt: string | null
  createdById: string
  createdByName: string
  createdAt: string
  items: PurchaseOrderItem[]   // presente em GET /{id}; ausente nas listas
}

export const purchaseOrderItemSchema = z.object({
  ingredientId: z.string().regex(UUID_REGEX, 'Selecione um ingrediente'),
  quantity: z.coerce.number().positive('Quantidade > 0'),
  unitPrice: z.coerce.number().positive('Preço > 0'),
})

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().regex(UUID_REGEX, 'Selecione um fornecedor'),
  unitId: z.string().regex(UUID_REGEX, 'Selecione uma unidade'),
  expectedAt: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'), z.literal('')])
    .optional(),
  notes: z.string().max(500).optional().or(z.literal('')),
  items: z
    .array(purchaseOrderItemSchema)
    .min(1, 'Adicione ao menos 1 item')
    .refine(
      (arr) => new Set(arr.map((i) => i.ingredientId)).size === arr.length,
      'Ingredientes duplicados não são permitidos'
    ),
})
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>

export const updatePurchaseOrderSchema = createPurchaseOrderSchema  // mesmo shape
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>
```

### Convenções compartilhadas

- Strings vazias em campos opcionais → `null` antes de enviar (mesma
  convenção SP1 — função `normalize*Payload` por módulo).
- Tratamento de erro 400/409 reaproveita o `ApiError` normalizado pelo
  interceptor do axios.
- `staleTime` para listas usadas em selects (ingredientes ativos, suppliers
  ativos, unidades ativas, todos os usuários): 5 minutos.

---

## Tratamento de erros (UX)

Mantém o **toast-only** já consolidado no SP1.

| Cenário | Tratamento |
|---|---|
| `POST /stock-movements` saldo insuficiente em DECREASE | Toast vermelho com `err.message` do backend |
| `POST /purchase-orders/{id}/receive` qualquer falha (item duplicado, ingrediente inativo, etc) | Toast com `err.message`; PO permanece PENDING (rollback do backend) |
| Editar PO que mudou de status entre load e submit | Backend retorna 400 → toast; usuário recarrega |
| Ingrediente/fornecedor inativo no submit | Toast com `err.message` do backend |
| Erros de validação client-side no form de PO (RHF) | Inline (label vermelho + helper text) — exceção justificada por densidade do form |

---

## Testes

Vitest + RTL, padrão `ef22711`.

**Schema tests** (`tests/lib/<recurso>.schema.test.ts`):
- `createAdjustmentSchema`: enum direction; reason 1-255; quantity > 0.
- `createPurchaseOrderSchema`: items ≥1; rejeita ingredientes duplicados;
  notes ≤500; date format; quantity/unitPrice > 0.

**Hooks/API tests** (`tests/lib/<recurso>.test.ts`):
- `useStock` / `useLowStock` montam querystring esperada (e `useLowStock`
  bate em `/stock/low`).
- `useStockMovements` aceita todos os filtros.
- `useCreateAdjustment` envia body certo, invalida `['stock-movements']` e
  `['stock']`.
- `usePurchaseOrders({status, supplier, unit, from, to})` monta querystring.
- `useCreatePurchaseOrder` / `useUpdate` enviam body correto (incluindo
  itens).
- `useReceivePurchaseOrder` invalida 3 queries.
- `useCancelPurchaseOrder` invalida só `['purchase-orders']`.

**Page tests** (`tests/app/<recurso>.test.tsx`):
- `/stock`: render, filtro toggle "abaixo do mínimo" troca a query (de
  `/stock` para `/stock/low`); badge "Abaixo" só em itens críticos.
- `/stock-movements`: filtros atualizam URL; modal "novo ajuste" abre só
  pra OWNER, valida campos, fecha em sucesso e dispara refetch.
- `/purchase-orders` (lista): filtro de status persiste na URL; ações
  condicionais (editar só se PENDING + OWNER).
- `/purchase-orders/nova`:
  - Adicionar/remover items via `useFieldArray`.
  - Pré-popula `unitPrice` ao escolher ingrediente (se vazio).
  - Total calculado client-side reflete mudanças.
  - Rejeita ingredientes duplicados.
- `/purchase-orders/[id]`: ações receive/cancel exibem `<ConfirmDialog>`;
  em RECEIVED/CANCELED não aparecem.
- `/purchase-orders/[id]/editar`: PO não-PENDING → `<NoAccess />` com
  mensagem específica.
- EMPLOYEE acessando rotas OWNER por URL direta → `<NoAccess />`.

Sem coverage gates novos.

---

## Critérios de pronto

- [ ] Sidebar leva às 3 rotas sem 404; hrefs em inglês alinhados com
      backend; typo `/movments` corrigido.
- [ ] `/stock`: filtros (unidade, ingrediente, abaixo do mínimo) persistem
      em URL e sobrevivem a refresh; badge "Abaixo" e coluna "Mínimo"
      visíveis; toggle troca corretamente entre `/stock` e `/stock/low`.
- [ ] `/stock-movements`: lista exibe sinal correto por type; link para PO
      funciona; modal de ajuste abre/fecha; OWNER cria ajuste e a lista
      atualiza; saldo no `/stock` reflete a mudança.
- [ ] `/purchase-orders`:
  - [ ] Lista filtrada por status (default PENDING).
  - [ ] Criar PO redireciona para detalhe.
  - [ ] Editar só funciona em PENDING (UI bloqueia + backend valida).
  - [ ] Receive adiciona ENTRY ao histórico, atualiza saldo + custo médio.
  - [ ] Cancel muda status sem mexer estoque.
- [ ] Form de PO: `useFieldArray` com adicionar/remover; pré-popula preço
      com `averageCost`; total client-side; validação client-side coincide
      com backend (≥1 item, sem duplicados); inline errors do RHF.
- [ ] EMPLOYEE: leitura nos 3 módulos; bloqueado em rotas OWNER e ações
      mutativas.
- [ ] Toasts em sucesso/erro de todas as mutations.
- [ ] Tests novos passam.
- [ ] `npm run build` sem warnings; `npm run test` verde.

---

## Pontos de atenção a validar na fase de plano

1. **`StockResponse.unitOfMeasure`:** o backend SP2 não documenta que esse
   campo está no DTO de stock. Default do design: front resolve via
   `useAllIngredients()` map. Se descobrirmos que o backend já entrega,
   simplifica.
2. **Filtro `?purchaseOrderId=` em `/stock-movements`:** se existir, o card
   "Movimentações geradas" no detalhe da PO entra na entrega. Se não
   existir, fica fora (graceful degradation).
3. **`/purchase-orders` na listagem inclui ou não `items`?** O design assume
   **não** (só em GET `/{id}`). Confirmar — se vier inflado, simplifica
   render mas paga peso desnecessário.
