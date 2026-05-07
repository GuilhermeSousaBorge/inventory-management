# SP3 — Frontend Design (Products + Orders)

## Visão geral

Frontend do SP3: completa as 2 telas que o backend já suporta — cardápio
com fichas técnicas (`/products`) e pedidos de cliente com state machine
de 4 estados (`/orders`), incluindo ação que dispara baixa automática de
estoque (`POST /orders/{id}/start`). Tudo numa única rodada de
spec/plan/PR, seguindo os padrões já estabelecidos no SP1/SP2 frontend.

**Objetivo:** ao final, o app expõe operação completa do ciclo de
pedido — cadastrar produtos com receita, registrar pedidos, iniciar
preparo (descontando ingredientes do estoque automaticamente), concluir
ou cancelar — pareado 1:1 com os endpoints do backend SP3.

**Stack:** sem mudanças. Next.js 16 (App Router), React 19, Tailwind v4,
axios, TanStack Query, RHF, zod, sonner, lucide-react.

---

## Escopo

### Dentro do escopo

- `/products` — listagem com filtros (categoria, tamanho, ativo), CRUD
  via rotas dedicadas (`/nova`, `/{id}/editar`, `/{id}`); form com
  `useFieldArray` para ficha técnica.
- `/orders` — listagem com filtros (unidade, status, datas), CRUD via
  rotas dedicadas (`/novo`, `/{id}/editar`, `/{id}`); detalhe com ações
  condicionais por status (Editar / Iniciar / Concluir / Cancelar).
- Atualização da sidebar: 2 entradas novas — "Produtos" → `/products` e
  "Pedidos" → `/orders` (posicionadas entre "Compras" e "Estoque").
- Hook helper `useAllProducts` (não paginado, ativos) para popular o
  select de produto no form de pedido. `useAllCategories` para popular o
  select de categoria no form de produto.
- Tests (schemas, hooks, pages) seguindo padrão do `ef22711`.

### Fora do escopo

- Home / dashboard com widgets — placeholder mantido; SP4 trará dados
  agregados.
- Filtro `?orderId=` ou `?reason=` em `/stock-movements` para listar
  movements gerados por um pedido — backend SP3 não suporta; mesma
  postura do SP2 (graceful degradation).
- Preview client-side de "ingredientes a consumir" antes de iniciar o
  pedido — duplicaria regra de negócio do backend.
- Cards de status agregado no detalhe (KPIs por pedido) — não pedidos.
- EMPLOYEE criando pedidos — backend SP3 é OWNER-only para mutações.

---

## Premissas e decisões

| # | Decisão | Motivo |
|---|---------|--------|
| 1 | URLs em inglês 1:1 com paths do backend (`/products`, `/orders`); labels em português | Coerente com SP1/SP2 |
| 2 | Forms com `useFieldArray` em rotas dedicadas (não modal) | Ficha técnica e items precisam de espaço; espelha decisão de PO no SP2 |
| 3 | Detalhe de produto e pedido = páginas read-only com ações no header | Consistente com `/purchase-orders/[id]`; bom para print/share |
| 4 | Iniciar pedido = ConfirmDialog simples + toast em erro | Mesma postura do "Receber compra" no SP2; backend dá `err.message` informativo; preview duplicaria regra |
| 5 | Default de `/orders` listing = `status=PENDING` | Backend só aceita `status=` valor único; rotina prioriza fila de "novos"; espelha PO listing |
| 6 | Detalhe `/orders/[id]` mínimo: 2 cards (Dados + Itens) | Sem assumir filtros backend novos; sem agregação client-side |
| 7 | ConfirmDialog para iniciar (irreversível, mexe estoque), concluir e cancelar | Segurança; especialmente iniciar |
| 8 | Toast-only para erros de mutation | Mantém consistência com SP1/SP2; banners por campo ficam pra rodada futura |
| 9 | "Nº" do pedido na listagem = primeiros 8 chars do UUID | Mesma convenção do PO no SP2 |
| 10 | Edição de pedido bloqueada se status ≠ PENDING (renderiza `<NoAccess />`) | Espelha regra do backend; UX preventiva |
| 11 | `unitPrice` do pedido é snapshot (capturado pelo backend) | Frontend não envia preço; só `productId` + `quantity` |

---

## Estrutura de arquivos

```
frontend/
├─ app/(protected)/
│  ├─ products/
│  │  ├─ page.tsx                       # listagem + filtros
│  │  ├─ product-form.tsx               # form compartilhado (criar/editar)
│  │  ├─ nova/page.tsx
│  │  ├─ [id]/page.tsx                  # detalhe (read-only) com ações
│  │  └─ [id]/editar/page.tsx
│  └─ orders/
│     ├─ page.tsx                       # listagem + filtros
│     ├─ order-form.tsx                 # form compartilhado (criar/editar)
│     ├─ novo/page.tsx
│     ├─ [id]/page.tsx                  # detalhe + ações de transição
│     └─ [id]/editar/page.tsx
├─ lib/
│  ├─ products.ts                       # types + zod + hooks (CRUD + actions auxiliares)
│  ├─ orders.ts                         # types + zod + hooks (CRUD + state actions)
│  └─ categories.ts                     # extend: + useAllCategories()
└─ tests/
   ├─ lib/
   │  ├─ products.schema.test.ts
   │  ├─ products.test.ts
   │  ├─ orders.schema.test.ts
   │  └─ orders.test.ts
   └─ app/
      ├─ products.test.tsx
      ├─ product-form.test.tsx
      ├─ orders.test.tsx
      └─ order-form.test.tsx
```

---

## Roteamento e guards

| Rota | Acesso | Conteúdo |
|------|--------|----------|
| `/products` | autenticado | lista + filtros |
| `/products/nova` | OWNER | form de criação |
| `/products/[id]` | autenticado | detalhe read-only com ficha técnica |
| `/products/[id]/editar` | OWNER | form de edição |
| `/orders` | autenticado | lista + filtros |
| `/orders/novo` | OWNER | form de criação |
| `/orders/[id]` | autenticado | detalhe + ações condicionais por status |
| `/orders/[id]/editar` | OWNER + status=PENDING | form de edição |

Guards inline (mesmo padrão SP1/SP2):
- Listagens: botões mutativos só renderizam para OWNER.
- Rotas dedicadas (`/nova`, `/{id}/editar`): se `user.role !== 'OWNER'` →
  `<NoAccess />`.
- `/orders/[id]/editar`: se pedido já não está PENDING (carregado),
  `<NoAccess />` específico ("Este pedido já está {status} e não pode
  mais ser editado.") com link "Voltar para o pedido".

**Sidebar (`app/(protected)/layout.tsx`):** adiciona 2 entradas:
- "Produtos" → `/products`
- "Pedidos" → `/orders`

Posição sugerida: depois de "Compras", antes de "Estoque" (fluxo natural:
cadastra produto → faz compra → controla estoque → registra pedido).

---

## Módulo: Products

### Tela `/products`

**Header:** título "Produtos", descrição curta, botão "+ Novo produto"
(só OWNER) → `/products/nova`.

**Filtros (URL-persisted):**
- Categoria — `<Select>` ativas + "Todas" (usa `useAllCategories`).
- Tamanho — `<Select>` enum P/M/G/GG + "Todos".
- Ativo — `<Select>` Sim/Não/Todos (default = Sim).

**Tabela:**
- Colunas:
  - Nome (`name`).
  - Tamanho (badge — P/M/G/GG).
  - Categoria (`categoryName` ou "—").
  - Preço (`R$ X,XX`).
  - Status (badge "Ativo" verde / "Inativo" cinza).
  - Ações:
    - 👁 Ver detalhes (todos) → `/products/[id]`.
    - ✏️ Editar (OWNER) → `/products/[id]/editar`.
    - 🗑 Desativar (OWNER + active=true) → ConfirmDialog → `DELETE /products/[id]`.
- Paginação 20/pg.
- Estados padrão (loading skeleton, erro com retry, vazio
  "Nenhum produto cadastrado.").

### Form `product-form.tsx`

Componente compartilhado consumido por `nova/page.tsx` e
`[id]/editar/page.tsx`. Recebe modo (`create` | `edit`), `defaultValues`
e callback de submit.

**Layout:** card `max-w-3xl` centrado, breadcrumb leve no topo
("Produtos › Novo" ou "Produtos › Editar {name} {size}"), título, form
em duas seções.

**Seção 1 — Dados do produto:**
- `name` — input text, 1-150, obrigatório.
- `size` — `<Select>` P/M/G/GG, obrigatório.
- `categoryId` — `<Select>` categorias ativas + "Sem categoria",
  opcional.
- `price` — input number step=0.01, > 0, obrigatório.
- `description` — textarea, ≤255, opcional.

**Seção 2 — Ficha técnica (`useFieldArray`):**
- Tabela editável; uma linha por ingrediente:
  - **Ingrediente** (`<Select>` ativos, obrigatório).
  - **Quantidade** (number step=0.001, > 0).
  - **Unidade de medida** (read-only, derivada de
    `ingredient.unitOfMeasure` quando o ingrediente é selecionado —
    mostra "kg", "g", "L", etc).
  - 🗑 remover linha (desabilitado se for a única linha).
- Botão "+ Adicionar ingrediente" abaixo da tabela.

**Validação client-side:** ≥1 ingrediente, sem ingredientes duplicados
(zod `.refine`), todos os campos obrigatórios. Erros do RHF aparecem
inline (label vermelho + helper text) — exceção à regra "toast-only",
que vale só para erros do servidor.

**Rodapé:** "Cancelar" (volta para `/products` no modo create, ou
`/products/{id}` no modo edit) e "Salvar".

**Submit:**
- Criar: `POST /products` → toast verde → `router.replace('/products/{id}')`.
- Editar: `PUT /products/{id}` → toast verde → `router.replace('/products/{id}')`.
- Erro: toast vermelho com `err.message`. Casos típicos: UNIQUE
  name+size, ingrediente inativo, ingrediente duplicado (caso
  validação client-side seja burlada), categoria inexistente.

**Página de edição (`/products/[id]/editar`):**
- Pre-fetch via `useProduct(id)` para popular `defaultValues`.
- Loading: skeleton do form.
- Erro de carregamento: mensagem com retry/voltar (igual
  `/ingredients/[id]/editar`).

### Detalhe `/products/[id]`

**Header:** breadcrumb "Produtos › {name} {size}", título, badge de
status (Ativo/Inativo).

**Ações topo direito (só OWNER):**
- "Editar" (link → `/{id}/editar`).
- "Desativar" (button → `<ConfirmDialog>` → `DELETE /products/{id}`).
- Ocultas se `active === false`.

**Conteúdo:**
- **Card "Dados do produto":** nome, tamanho, categoria, preço,
  descrição, criado em.
- **Card "Ficha técnica":** tabela read-only — ingrediente, quantidade,
  unidade de medida. Vazio improvável (backend exige ≥1 ingrediente).

### Hooks (`lib/products.ts`)

```ts
useProducts(filters?: {
  category?: string; size?: ProductSize; active?: boolean
  page?: number; pageSize?: number
})
useProduct(id: string)
useAllProducts()                        // não paginado, ativos — usado pelo select do order-form
useCreateProduct()
useUpdateProduct()
useDeactivateProduct()                  // DELETE → soft delete
```

Query keys: `['products', { category, size, active, page, pageSize }]`,
`['products', id]`, `['products', 'all']`. Mutations invalidam
`['products']`.

---

## Módulo: Orders

### Listagem `/orders`

**Header:** título "Pedidos", descrição, botão "+ Novo pedido" (só
OWNER) → `/orders/novo`.

**Filtros (URL-persisted):**
- Status — default = PENDING; opções PENDING / IN_PROGRESS /
  COMPLETED / CANCELED / Todos.
- Unidade — `<Select>` ativas + "Todas".
- De / Até — date inputs (envia `from`/`to` com hora 00:00 / 23:59
  antes de bater no backend, igual `/stock-movements` no SP2).

**Tabela:**
- Colunas:
  - Nº (primeiros 8 chars do UUID, `font-mono`).
  - Unidade (`unitName`).
  - Status (badge: PENDING=amarelo, IN_PROGRESS=azul, COMPLETED=verde,
    CANCELED=cinza).
  - Itens (`{n} itens`); tooltip mostra primeiros 3 nomes,
    "...e mais X" se houver. **Bloqueio:** depende de `items` vir na
    listagem; se backend só devolver em `GET /{id}`, exibe "—" e
    remove o tooltip (graceful degradation).
  - Total (`R$ X,XX`).
  - Criado em (`dd/MM/yyyy HH:mm`).
  - Ações:
    - 👁 Ver detalhes (todos) → `/orders/[id]`.
    - ✏️ Editar (OWNER + status=PENDING) → `/orders/[id]/editar`.
- Paginação 20/pg.
- Estados padrão.

### Form `order-form.tsx`

Componente compartilhado consumido por `novo/page.tsx` e
`[id]/editar/page.tsx`.

**Layout:** card `max-w-3xl` centrado, breadcrumb "Pedidos › Novo" ou
"Pedidos › Editar #abc12345", título, form em duas seções.

**Seção 1 — Dados do pedido:**
- `unitId` — `<Select>` unidades ativas, obrigatório.
- `notes` — textarea, ≤500, opcional.

**Seção 2 — Itens (`useFieldArray`):**
- Tabela editável; uma linha por item:
  - **Produto** — `<Select>` ativos (label `"{name} {size}"`, com
    `R$ price` à direita), obrigatório.
    `onChange`: atualiza display de `unitPrice` da linha.
  - **Quantidade** (number step=1, ≥1, integer).
  - **Preço unit.** (read-only, derivado de `product.price` — captura
    pelo backend; não enviado no payload).
  - **Subtotal** (calculado, read-only: `qty × price`).
  - 🗑 remover linha (desabilitado se for a única).
- Botão "+ Adicionar item".
- Linha "**Total: R$ X,XX**" abaixo (Σ subtotais, client-side).

**Validação client-side:** ≥1 item, sem produtos duplicados (zod
`.refine` — backend tem `UNIQUE(order_id, product_id)`), `quantity`
inteiro ≥1.

**Rodapé:** "Cancelar" / "Salvar" (mesma convenção do product-form).

**Submit:**
- Envia só `{ unitId, notes, items: [{ productId, quantity }] }`.
- Backend captura `unitPrice` do produto e calcula `totalPrice`.
- Sucesso → `router.replace('/orders/[id]')` + toast verde.
- Erro → toast vermelho com `err.message`. Casos típicos: produto
  inativo, produto duplicado, unidade inexistente.

**Página de edição (`/orders/[id]/editar`):**
- Pre-fetch via `useOrder(id)`.
- Se `status !== 'PENDING'` → `<NoAccess />` específico:
  > "Este pedido já está {status} e não pode mais ser editado."
- Loading: skeleton do form.

### Detalhe `/orders/[id]`

**Header:** breadcrumb "Pedidos › #abc12345", título, badge de status
grande, datas relevantes ao lado (criado em, iniciado em, concluído em,
cancelado em — só as preenchidas).

**Ações topo direito (só OWNER, condicionais por status):**

| Status | Ações disponíveis |
|---|---|
| PENDING | "Editar" (link), "Iniciar" (ConfirmDialog → `POST /start`), "Cancelar" (ConfirmDialog → `POST /cancel`) |
| IN_PROGRESS | "Concluir" (ConfirmDialog → `POST /complete`) |
| COMPLETED | nenhuma (só visualização) |
| CANCELED | nenhuma (só visualização) |

**ConfirmDialogs:**
- **Iniciar:**
  > "Iniciar este pedido? Os ingredientes serão descontados do estoque
  > conforme as fichas técnicas, e a ação **não pode ser desfeita**."
- **Concluir:**
  > "Marcar este pedido como concluído?"
- **Cancelar:**
  > "Cancelar este pedido? A ação não pode ser desfeita."

**Conteúdo:**
- **Card "Dados do pedido":** unidade, status, datas (created/started/
  completed/canceled — só as preenchidas), criador (resolvido client-
  side via `useUsers` map se backend não desnormalizar — ver
  "Pontos a validar"), notes.
- **Card "Itens":** tabela read-only — produto, qty, unitPrice
  (snapshot do momento do pedido), subtotal. Footer **Total: R$ X,XX**.

### Hooks (`lib/orders.ts`)

```ts
useOrders(filters?: {
  unit?: string; status?: OrderStatus
  from?: string; to?: string; page?: number; pageSize?: number
})
useOrder(id: string)
useCreateOrder()
useUpdateOrder()                        // só PENDING (backend valida)
useStartOrder()                         // POST /{id}/start
useCompleteOrder()                      // POST /{id}/complete
useCancelOrder()                        // POST /{id}/cancel
```

**Invalidação após mutations:**
- `useCreate` / `useUpdate` / `useComplete` / `useCancel`: invalidam
  `['orders']`.
- `useStart`: invalida `['orders']`, `['stock']`,
  `['stock-movements']` (todos os 3 mudam de fato).

---

## Tipos e schemas

### `lib/products.ts`

```ts
export const PRODUCT_SIZES = ['P', 'M', 'G', 'GG'] as const
export type ProductSize = (typeof PRODUCT_SIZES)[number]

export type ProductIngredient = {
  id: string
  ingredientId: string
  ingredientName: string
  quantity: number
  unitOfMeasure: string                 // já vem desnormalizado do backend
}

export type Product = {
  id: string
  name: string
  size: ProductSize
  categoryId: string | null
  categoryName: string | null
  price: number
  description: string | null
  active: boolean
  createdAt: string
  ingredients: ProductIngredient[]      // presente em GET /{id}; ausente nas listas
}

export const productIngredientSchema = z.object({
  ingredientId: z.string().regex(UUID_REGEX, 'Selecione um ingrediente'),
  quantity: z.coerce.number().positive('Quantidade > 0'),
})

export const createProductSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome').max(150),
  size: z.enum(PRODUCT_SIZES),
  categoryId: z.union([z.string().regex(UUID_REGEX), z.literal('')]).optional(),
  price: z.coerce.number().positive('Preço > 0'),
  description: z.string().max(255).optional().or(z.literal('')),
  ingredients: z
    .array(productIngredientSchema)
    .min(1, 'Adicione ao menos 1 ingrediente')
    .refine(
      (arr) => new Set(arr.map((i) => i.ingredientId)).size === arr.length,
      'Ingredientes duplicados não são permitidos'
    ),
})
export type CreateProductInput = z.infer<typeof createProductSchema>

export const updateProductSchema = createProductSchema   // mesmo shape
export type UpdateProductInput = z.infer<typeof updateProductSchema>
```

### `lib/orders.ts`

```ts
export const ORDER_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export type OrderItem = {
  id: string
  productId: string
  productName: string                   // formato "{name} {size}" desnormalizado pelo backend
  quantity: number
  unitPrice: number
  subtotal: number                      // backend devolve calculado
}

export type Order = {
  id: string
  unitId: string
  unitName: string
  status: OrderStatus
  totalPrice: number
  notes: string | null
  createdById: string
  startedAt: string | null
  completedAt: string | null
  canceledAt: string | null
  createdAt: string
  items: OrderItem[]                    // presente em GET /{id}; ausência em listas é graceful-degradable
}

export const orderItemSchema = z.object({
  productId: z.string().regex(UUID_REGEX, 'Selecione um produto'),
  quantity: z.coerce.number().int('Quantidade inteira').min(1, 'Mínimo 1'),
})

export const createOrderSchema = z.object({
  unitId: z.string().regex(UUID_REGEX, 'Selecione uma unidade'),
  notes: z.string().max(500).optional().or(z.literal('')),
  items: z
    .array(orderItemSchema)
    .min(1, 'Adicione ao menos 1 item')
    .refine(
      (arr) => new Set(arr.map((i) => i.productId)).size === arr.length,
      'Produtos duplicados não são permitidos'
    ),
})
export type CreateOrderInput = z.infer<typeof createOrderSchema>

export const updateOrderSchema = createOrderSchema    // mesmo shape
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>
```

### Convenções compartilhadas

- Strings vazias em campos opcionais → `null` antes de enviar (mesma
  convenção SP1/SP2 — função `normalize*Payload` por módulo).
- Tratamento de erro 400/409 reaproveita o `ApiError` normalizado pelo
  interceptor do axios.
- `staleTime` para listas usadas em selects (produtos ativos,
  ingredientes ativos, categorias ativas, unidades ativas): 5 minutos.

---

## Tratamento de erros (UX)

Mantém o **toast-only** já consolidado no SP1/SP2.

| Cenário | Tratamento |
|---|---|
| `POST /products` UNIQUE name+size | Toast vermelho com `err.message` |
| `POST /products` ingrediente inativo / duplicado | Toast com `err.message` |
| `DELETE /products/{id}` se fizer falha (FK em pedido?) | Toast com `err.message` (backend SP3 atualmente faz soft delete sem checagem extra; se mudar, toast cobre) |
| `POST /orders` produto inativo / duplicado | Toast com `err.message` |
| Editar pedido que mudou de status entre load e submit | Backend 400 → toast; usuário recarrega |
| `POST /orders/{id}/start` saldo insuficiente em qualquer ingrediente | Toast com `err.message` ("Saldo insuficiente para ingrediente X"); pedido permanece PENDING (rollback do backend) |
| `POST /orders/{id}/complete` ou `/cancel` em estado errado | Toast com `err.message` (UI já bloqueia, mas defesa em profundidade) |
| Erros de validação client-side no form | Inline (label vermelho + helper text) — exceção justificada por densidade do form |

---

## Testes

Vitest + RTL, padrão `ef22711`.

**Schema tests** (`tests/lib/<recurso>.schema.test.ts`):
- `createProductSchema`: rejeita ingredientes duplicados; ≥1
  ingrediente; name 1-150; price > 0; description ≤255; size enum.
- `createOrderSchema`: rejeita produtos duplicados; ≥1 item; quantity
  inteiro ≥1; notes ≤500.

**Hooks/API tests** (`tests/lib/<recurso>.test.ts`):
- `useProducts({ category, size, active })` monta querystring esperada.
- `useAllProducts` não paginado.
- `useCreateProduct` / `useUpdate` / `useDeactivate` enviam body
  correto e invalidam `['products']`.
- `useOrders({ unit, status, from, to })` monta querystring.
- `useCreateOrder` / `useUpdate` enviam só
  `{ unitId, notes, items: [{ productId, quantity }] }` (sem
  unitPrice).
- `useStartOrder` invalida 3 queries (`['orders']`, `['stock']`,
  `['stock-movements']`).
- `useCompleteOrder` / `useCancelOrder` invalidam só `['orders']`.

**Page tests** (`tests/app/<recurso>.test.tsx`):
- `/products`: filtros (categoria, tamanho, ativo) atualizam URL e
  sobrevivem a refresh; ações condicionais por role/status.
- `/products/nova`: adicionar/remover ingredientes via `useFieldArray`;
  rejeita duplicados; display de unidade de medida atualiza ao trocar
  ingrediente.
- `/products/[id]/editar`: pré-popula ficha técnica; EMPLOYEE →
  `<NoAccess />`.
- `/products/[id]`: render de detalhe + ficha técnica; ações ocultas
  para EMPLOYEE; ConfirmDialog na desativação.
- `/orders`: filtro de status persiste (default PENDING); ações
  condicionais (editar só PENDING + OWNER).
- `/orders/novo`:
  - Adicionar/remover items via `useFieldArray`.
  - Display de preço/subtotal atualiza ao trocar produto.
  - Total client-side reflete mudanças.
  - Rejeita produtos duplicados.
- `/orders/[id]`: ConfirmDialogs por estado — start/cancel em PENDING;
  complete em IN_PROGRESS; nada em COMPLETED/CANCELED.
- `/orders/[id]/editar`: pedido não-PENDING → `<NoAccess />` com
  mensagem específica.
- EMPLOYEE acessando rotas OWNER por URL direta → `<NoAccess />`.

Sem coverage gates novos.

---

## Critérios de pronto

- [ ] Sidebar leva às 2 rotas novas sem 404.
- [ ] `/products`:
  - [ ] Filtros (categoria, tamanho, ativo) persistem em URL e
        sobrevivem a refresh.
  - [ ] Criar produto com ficha técnica (≥1 ingrediente, sem
        duplicados) redireciona para detalhe.
  - [ ] Editar substitui ficha técnica completa (espelha contrato
        backend).
  - [ ] Desativar funciona (soft delete) e reflete na listagem.
- [ ] `/orders`:
  - [ ] Lista filtrada por status (default PENDING).
  - [ ] Criar pedido redireciona para detalhe.
  - [ ] Editar só funciona em PENDING (UI bloqueia + backend valida).
  - [ ] Iniciar em PENDING dispara baixa de estoque; saldo em `/stock`
        atualiza; EXIT movements aparecem em `/stock-movements`.
  - [ ] Saldo insuficiente em qualquer ingrediente: toast de erro +
        pedido continua PENDING.
  - [ ] Concluir em IN_PROGRESS funciona; data `completedAt` aparece.
  - [ ] Cancelar em PENDING funciona; estoque não muda.
- [ ] EMPLOYEE: leitura nos 2 módulos; bloqueado em rotas OWNER e
      ações mutativas.
- [ ] Toasts em sucesso/erro de todas as mutations.
- [ ] Tests novos passam.
- [ ] `npm run build` sem warnings; `npm run test` verde.

---

## Pontos de atenção a validar na fase de plano

1. **`OrderResponse.createdByName`** — backend SP3 DTO tem só
   `createdById`. Default do design: front resolve via map de
   `useUsers`. Se descobrirmos que o backend já desnormaliza,
   simplifica.
2. **Listagem `/orders` inclui `items`?** — design assume **sim** para
   mostrar contagem; se backend só devolver em GET `/{id}`, a coluna
   "Itens" exibe "—" e remove o tooltip (graceful degradation).
3. **`OrderResponse.unitPrice` em items** — DTO confirma
   `unitPrice + subtotal` calculados pelo backend. Sem trabalho extra
   no front.
4. **`ProductIngredientResponse.unitOfMeasure`** — DTO já entrega; sem
   `useAllIngredients` map necessário (diferença vs SP2).
5. **`ProductResponse` na listagem inclui `ingredients`?** — design
   assume **não** (só em GET `/{id}`); se vier inflado, simplifica
   detalhe mas paga peso desnecessário.
6. **`DELETE /products/{id}` com produto referenciado em pedidos
   (FK)** — backend SP3 não documenta checagem; se aparecer 409 na
   prática, toast cobre. Caso queira UX explícita, fica para rodada
   futura.
