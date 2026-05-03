# SP2 Frontend — Stock + Movements + Purchases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar frontend completo do SP2 — listagem de saldos (`/stock`),
histórico de movimentações com criação de ajustes (`/stock-movements`), e
ordens de compra com workflow PENDING → RECEIVED/CANCELED
(`/purchase-orders`), pareando 1:1 com o backend SP2.

**Architecture:** Espelhar 1:1 os padrões já estabelecidos no SP1 frontend
(`lib/users.ts`, `lib/categories.ts`, `app/(protected)/ingredients/`).
Stock e Movements são módulos enxutos (uma página cada). Purchase Orders
tem rotas dedicadas (`/nova`, `/{id}/editar`, `/{id}`) por causa do form com
`useFieldArray` (header + lista dinâmica de items).

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, axios,
TanStack Query v5, react-hook-form, zod (`@hookform/resolvers/zod`), sonner,
Tailwind v4, lucide-react. Testes: Vitest + jsdom + @testing-library/react.

**Reference spec:** `frontend/docs/superpowers/specs/2026-05-02-sp2-frontend-stock-movements-purchases-design.md`

---

## Convenções importantes do projeto (ler antes de começar)

1. **Diretório de trabalho:** todos os comandos rodam a partir de `frontend/`.

2. **Localização de testes:** `frontend/tests/` flat — não há subpastas
   `tests/lib/...` ou `tests/app/...`. Glob: `tests/**/*.test.{ts,tsx}`.
   - Schemas zod: extender `tests/schemas.test.ts` (não criar arquivos novos).
   - Hooks/API com mock do axios: `tests/api.test.ts` (já existe; pode-se
     extender) ou criar `tests/<recurso>-hooks.test.ts` se ficar grande.
   - Testes de página: criar `tests/<recurso>-page.test.tsx`.

3. **Helpers de teste** (`frontend/tests/helpers.tsx`):
   - `setHandler(fn)` — define mock de resposta HTTP.
   - `getCalls()` — array de requests interceptadas.
   - `resetMockApi()` — reseta handler/calls/localStorage e instala adapter.
   - `renderWithProviders(ui)` — render com `QueryClientProvider` + `AuthProvider`.

4. **Mock do `next/navigation`** em testes de página:
   ```ts
   vi.mock("next/navigation", () => ({
     useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
     useSearchParams: () => new URLSearchParams(),
     usePathname: () => "/stock",
   }))
   ```
   Variar `usePathname` por arquivo de teste.

5. **Envelope de resposta:** o interceptor do axios desembrulha
   `{ data: x }` → `x` para single-resource; mantém
   `{ data, page, size, total }` intacto para listas paginadas. Mocks devem
   retornar com `data` interno conforme o caso.

6. **Mensagens de erro em pt** nos zod schemas:
   `z.string().min(1, "Informe o nome")`.

7. **Indentação:** projeto usa **4 espaços**. Respeitar.

8. **Imports com alias `@/`:** `@/lib/api`, `@/components/ui/...`, etc.

9. **Componentes UI já existentes** (`frontend/components/`):
   - `ui/`: `button`, `input`, `field`, `select`, `badge`, `table`.
   - `overlays/`: `modal`, `confirm-dialog`.

10. **`isApiError`** vem de `@/lib/auth`. Padrão de mutation:
    ```ts
    try {
      await mutation.mutateAsync(...)
      toast.success("...")
    } catch (err) {
      if (isApiError(err)) toast.error(err.message)
      else toast.error("Erro ao ...")
    }
    ```

11. **`Page<T>`** vem de `@/lib/users`:
    `{ data: T[]; page: number; size: number; total: number }`.

12. **`<NoAccess />`** componente usado em rotas dedicadas — verificar
    como `/ingredients/[id]/editar/page.tsx` usa hoje (`if (user.role !== 'OWNER') return <NoAccess />`)
    e replicar.

13. **Commits:** padrão `feat(frontend): ...`, `test(frontend): ...`,
    `docs(sp2): ...`. Co-author do Claude no rodapé:
    ```
    Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
    ```

14. **Branch:** `feat/sp2-frontend-stock-movements-purchases` (já criada).

---

## Estrutura de arquivos (resultado final)

```
frontend/
├─ lib/
│  ├─ stock.ts                                          [NOVO]
│  ├─ stock-movements.ts                                [NOVO]
│  ├─ purchase-orders.ts                                [NOVO]
│  ├─ ingredients.ts                                    [MODIFICAR — + useAllIngredients]
│  └─ units.ts                                          [MODIFICAR — + useAllUnits]
├─ app/(protected)/
│  ├─ layout.tsx                                        [MODIFICAR — sidebar hrefs]
│  ├─ stock/
│  │  └─ page.tsx                                       [NOVO]
│  ├─ stock-movements/
│  │  ├─ page.tsx                                       [NOVO]
│  │  └─ adjustment-dialog.tsx                          [NOVO]
│  └─ purchase-orders/
│     ├─ page.tsx                                       [NOVO]
│     ├─ purchase-order-form.tsx                        [NOVO] (form compartilhado)
│     ├─ nova/page.tsx                                  [NOVO]
│     ├─ [id]/page.tsx                                  [NOVO] (detalhe + ações)
│     └─ [id]/editar/page.tsx                           [NOVO]
└─ tests/
   ├─ schemas.test.ts                                   [MODIFICAR — adicionar describes]
   ├─ stock-page.test.tsx                               [NOVO]
   ├─ stock-movements-page.test.tsx                     [NOVO]
   ├─ purchase-orders-page.test.tsx                     [NOVO]
   ├─ purchase-order-form.test.tsx                      [NOVO]
   └─ purchase-order-detail-page.test.tsx               [NOVO]
```

---

## Ordem de execução

```
1.  Helpers shared: useAllUnits + useAllIngredients (com schemas/tests onde aplicável)
2.  Sidebar: corrigir hrefs (compras, movments)
3.  lib/stock.ts (types + hooks)
4.  /stock page + tests
5.  lib/stock-movements.ts (types + schema + hooks)
6.  /stock-movements page + adjustment-dialog + tests
7.  lib/purchase-orders.ts (types + schemas + hooks) + schemas tests
8.  purchase-order-form.tsx (componente compartilhado) + form tests
9.  /purchase-orders/nova page (consome form)
10. /purchase-orders/[id]/editar page (consome form)
11. /purchase-orders listagem page + tests
12. /purchase-orders/[id] detalhe page + tests
13. Sanity final: full test run + build
```

A ordem garante que cada task tem dependências já implementadas quando chega
(form é construído antes das rotas que o consomem; lib é feita antes da
página que a usa).

---

## Task 1: helpers `useAllUnits` e `useAllIngredients`

**Files:**
- Modify: `frontend/lib/units.ts`
- Modify: `frontend/lib/ingredients.ts`

**Why:** Selects de filtro/dropdown em todas as páginas SP2 precisam da
lista completa (ativa) de unidades e ingredientes. SP1 só expõe versões
paginadas. Padrão é o mesmo de `useAllCategories` / `useActiveSuppliers`.

- [ ] **Step 1: Adicionar `useAllUnits` ao final de `frontend/lib/units.ts`**

```ts
export function useAllUnits() {
    return useQuery({
        queryKey: ["units", "all-active"],
        queryFn: () =>
            api
                .get<Page<Unit>>("/units", {
                    params: { page: 0, size: 1000, active: true },
                })
                .then((r) => r.data.data),
        staleTime: 5 * 60 * 1000,
    })
}
```

> **Nota:** se `useUnits` em `lib/units.ts` ainda não aceitar `active` como
> param, ajustar o tipo de `params` da `useUnits` para incluir `active?:
> boolean`. Verificar primeiro abrindo `lib/units.ts` — se já não aceitar,
> apenas adicionar `useAllUnits` como acima usando query direta na rota
> `/units?active=true`.

Imports a verificar no topo do arquivo: deve ter `api`, `useQuery`,
`type Page` (importar de `@/lib/users` se faltar). `Unit` é o tipo já
exportado em `lib/units.ts`.

- [ ] **Step 2: Adicionar `useAllIngredients` ao final de `frontend/lib/ingredients.ts`**

```ts
export function useAllIngredients() {
    return useQuery({
        queryKey: ["ingredients", "all-active"],
        queryFn: () =>
            api
                .get<Page<Ingredient>>("/ingredients", {
                    params: { page: 0, size: 1000, active: true },
                })
                .then((r) => r.data.data),
        staleTime: 5 * 60 * 1000,
    })
}
```

- [ ] **Step 3: Rodar a suíte completa para garantir não-regressão**

```bash
cd frontend && npx vitest run
```

Expected: todos os testes existentes continuam passando.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/units.ts frontend/lib/ingredients.ts
git commit -m "$(cat <<'EOF'
feat(frontend): useAllUnits and useAllIngredients helpers for SP2 selects

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Sidebar — corrigir hrefs SP2

**Files:**
- Modify: `frontend/app/(protected)/layout.tsx` (seção "Suprimentos")

**Why:** Sidebar tem `/compras` (pt) e `/movments` (en com typo). Spec
decidiu URLs em inglês 1:1 com paths do backend.

- [ ] **Step 1: Atualizar 2 hrefs em `app/(protected)/layout.tsx`**

Localizar a seção "Suprimentos" (em torno das linhas 64-71) e substituir:

```ts
        title: "Suprimentos",
        items: [
            { label: "Compras", href: "/compras", icon: ShoppingCart },
            { label: "Fornecedores", href: "/suppliers", icon: Truck },
            { label: "Estoque", href: "/stock", icon: Boxes },
            { label: "Movimentações", href: "/movments", icon: ArrowLeftRight },
        ],
```

Por:

```ts
        title: "Suprimentos",
        items: [
            { label: "Compras", href: "/purchase-orders", icon: ShoppingCart },
            { label: "Fornecedores", href: "/suppliers", icon: Truck },
            { label: "Estoque", href: "/stock", icon: Boxes },
            { label: "Movimentações", href: "/stock-movements", icon: ArrowLeftRight },
        ],
```

- [ ] **Step 2: Rodar build pra garantir nada quebrou**

```bash
cd frontend && npm run build
```

Expected: build passa (rotas ainda não existem mas o link em si é só uma
string — não quebra a build).

- [ ] **Step 3: Commit**

```bash
git add frontend/app/\(protected\)/layout.tsx
git commit -m "$(cat <<'EOF'
chore(frontend): align sidebar hrefs with SP2 backend paths

/compras → /purchase-orders, /movments → /stock-movements (also fixes typo)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `lib/stock.ts` — types + hooks (read-only)

**Files:**
- Create: `frontend/lib/stock.ts`

**Why:** Estoque é read-only do front (mutações só via `MovementService`/
`PurchaseOrderService` no backend). Sem zod schemas — não há mutations.

- [ ] **Step 1: Criar `frontend/lib/stock.ts`**

```ts
import { api } from "@/lib/api"
import type { Page } from "@/lib/users"
import { useQuery } from "@tanstack/react-query"

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

export type StockFilters = {
    unit?: string
    ingredient?: string
    page?: number
    size?: number
}

export function useStock(filters: StockFilters = {}) {
    const page = filters.page ?? 0
    const size = filters.size ?? 20
    const params: Record<string, string | number> = { page, size }
    if (filters.unit) params.unit = filters.unit
    if (filters.ingredient) params.ingredient = filters.ingredient
    return useQuery({
        queryKey: [
            "stock",
            { unit: filters.unit ?? null, ingredient: filters.ingredient ?? null, page, size },
        ],
        queryFn: () => api.get<Page<Stock>>("/stock", { params }).then((r) => r.data),
    })
}

export function useStockItem(id: string) {
    return useQuery({
        queryKey: ["stock", id],
        queryFn: () => api.get<Stock>(`/stock/${id}`).then((r) => r.data),
        enabled: !!id,
    })
}

export function useLowStock(params?: { page?: number; size?: number }) {
    const page = params?.page ?? 0
    const size = params?.size ?? 20
    return useQuery({
        queryKey: ["stock", "low", { page, size }],
        queryFn: () =>
            api.get<Page<Stock>>("/stock/low", { params: { page, size } }).then((r) => r.data),
    })
}
```

- [ ] **Step 2: Rodar a suíte completa**

```bash
cd frontend && npx vitest run
```

Expected: todos passam.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/stock.ts
git commit -m "$(cat <<'EOF'
feat(frontend): stock types and read-only TanStack hooks

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `/stock` page + tests

**Files:**
- Create: `frontend/app/(protected)/stock/page.tsx`
- Create: `frontend/tests/stock-page.test.tsx`

**Why:** Listagem de saldos com filtros (URL-persisted) e toggle "abaixo do
mínimo" que swapa para `/stock/low`. Reaproveita `useAllIngredients` /
`useAllUnits` para popular dropdowns e resolver `unitOfMeasure` por
ingrediente (não vem desnormalizado no `StockResponse`).

- [ ] **Step 1: Criar `frontend/tests/stock-page.test.tsx` (failing)**

```tsx
import { screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/stock",
}))

import StockPage from "@/app/(protected)/stock/page"
import { tokenStorage } from "@/lib/api"
import { renderWithProviders, resetMockApi, setHandler } from "./helpers"

beforeEach(() => {
    resetMockApi()
})

function meHandler(role: "OWNER" | "EMPLOYEE") {
    return {
        status: 200,
        data: {
            data: {
                id: "u1",
                name: "Ana",
                email: "ana@x.com",
                role,
                active: true,
                createdAt: "2026-01-01T00:00:00Z",
            },
        },
    }
}

describe("StockPage", () => {
    it("renders rows from /stock with belowMinimum badge", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("OWNER")
            if (url.includes("/units")) {
                return {
                    status: 200,
                    data: {
                        data: [{ id: "un1", name: "Centro", address: null, active: true, createdAt: "2026-01-01T00:00:00Z" }],
                        page: 0,
                        size: 1000,
                        total: 1,
                    },
                }
            }
            if (url.includes("/ingredients")) {
                return {
                    status: 200,
                    data: {
                        data: [
                            {
                                id: "ing1",
                                name: "Mussarela",
                                description: null,
                                categoryId: "c1",
                                unitOfMeasure: "kg",
                                minimumQty: 5,
                                averageCost: 23,
                                expiryDate: null,
                                defaultSupplierId: null,
                                active: true,
                                createdAt: "2026-01-01T00:00:00Z",
                            },
                        ],
                        page: 0,
                        size: 1000,
                        total: 1,
                    },
                }
            }
            if (url.endsWith("/stock") && cfg.method === "get") {
                return {
                    status: 200,
                    data: {
                        data: [
                            {
                                id: "s1",
                                ingredientId: "ing1",
                                ingredientName: "Mussarela",
                                unitId: "un1",
                                unitName: "Centro",
                                quantity: 2,
                                minimumQty: 5,
                                belowMinimum: true,
                                averageCost: 23,
                                updatedAt: "2026-01-01T00:00:00Z",
                            },
                        ],
                        page: 0,
                        size: 20,
                        total: 1,
                    },
                }
            }
            return { status: 500 }
        })
        renderWithProviders(<StockPage />)
        await waitFor(() => expect(screen.getByText("Mussarela")).toBeInTheDocument())
        expect(screen.getByText(/Abaixo/i)).toBeInTheDocument()
    })

    it("empty state when no rows", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("EMPLOYEE")
            if (url.includes("/units"))
                return { status: 200, data: { data: [], page: 0, size: 1000, total: 0 } }
            if (url.includes("/ingredients"))
                return { status: 200, data: { data: [], page: 0, size: 1000, total: 0 } }
            if (url.endsWith("/stock"))
                return { status: 200, data: { data: [], page: 0, size: 20, total: 0 } }
            return { status: 500 }
        })
        renderWithProviders(<StockPage />)
        await waitFor(() =>
            expect(screen.getByText(/nenhum saldo/i)).toBeInTheDocument()
        )
    })
})
```

- [ ] **Step 2: Rodar o teste — deve falhar (módulo não existe)**

```bash
cd frontend && npx vitest run tests/stock-page.test.tsx
```

Expected: erro de import "Cannot find module".

- [ ] **Step 3: Criar `frontend/app/(protected)/stock/page.tsx`**

```tsx
"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Select } from "@/components/ui/select"
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { useAllIngredients } from "@/lib/ingredients"
import { useLowStock, useStock } from "@/lib/stock"
import { useAllUnits } from "@/lib/units"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useMemo, useState } from "react"

function StockPageInner() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const unitParam = searchParams.get("unit") ?? ""
    const ingredientParam = searchParams.get("ingredient") ?? ""
    const belowMin = searchParams.get("belowMin") === "true"

    const [page, setPage] = useState(0)
    const size = 20

    const list = useStock({
        unit: unitParam || undefined,
        ingredient: ingredientParam || undefined,
        page,
        size,
    })
    const low = useLowStock({ page, size })
    const query = belowMin ? low : list

    const units = useAllUnits()
    const ingredients = useAllIngredients()

    const ingredientById = useMemo(() => {
        const m = new Map<string, { unitOfMeasure: string }>()
        ingredients.data?.forEach((i) => m.set(i.id, { unitOfMeasure: i.unitOfMeasure }))
        return m
    }, [ingredients.data])

    const data = query.data
    const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1

    function setFilter(key: "unit" | "ingredient" | "belowMin", value: string) {
        const params = new URLSearchParams(searchParams.toString())
        if (value === "" || value === "false") params.delete(key)
        else params.set(key, value)
        setPage(0)
        router.replace(`/stock?${params.toString()}`)
    }

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-semibold text-text-primary">Estoque</h1>
                <p className="mt-1 text-sm text-text-secondary">
                    Saldos atuais por unidade e ingrediente.
                </p>
            </header>

            <div className="flex flex-wrap items-end gap-3">
                <Field label="Unidade" htmlFor="filter-unit">
                    <Select
                        id="filter-unit"
                        value={unitParam}
                        onChange={(e) => setFilter("unit", e.target.value)}
                        disabled={belowMin}
                    >
                        <option value="">Todas</option>
                        {units.data?.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.name}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field label="Ingrediente" htmlFor="filter-ingredient">
                    <Select
                        id="filter-ingredient"
                        value={ingredientParam}
                        onChange={(e) => setFilter("ingredient", e.target.value)}
                        disabled={belowMin}
                    >
                        <option value="">Todos</option>
                        {ingredients.data?.map((i) => (
                            <option key={i.id} value={i.id}>
                                {i.name}
                            </option>
                        ))}
                    </Select>
                </Field>
                <label className="flex items-center gap-2 text-sm text-text-primary">
                    <input
                        type="checkbox"
                        checked={belowMin}
                        onChange={(e) => setFilter("belowMin", e.target.checked ? "true" : "false")}
                    />
                    Apenas abaixo do mínimo
                </label>
            </div>

            {query.isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-12 animate-pulse rounded-lg bg-text-primary/5" />
                    ))}
                </div>
            ) : query.isError ? (
                <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
                    <p className="text-sm text-danger">Falha ao carregar estoque.</p>
                    <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
                        Tentar novamente
                    </Button>
                </div>
            ) : data && data.data.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                    <p className="text-sm text-text-secondary">Nenhum saldo registrado.</p>
                </div>
            ) : (
                <Table>
                    <THead>
                        <TR>
                            <TH>Ingrediente</TH>
                            <TH>Unidade</TH>
                            <TH>Quantidade</TH>
                            <TH>Mínimo</TH>
                            <TH>Custo médio</TH>
                            <TH>Status</TH>
                            <TH>Atualizado em</TH>
                        </TR>
                    </THead>
                    <TBody>
                        {data!.data.map((s) => {
                            const uom = ingredientById.get(s.ingredientId)?.unitOfMeasure ?? ""
                            return (
                                <TR key={s.id}>
                                    <TD>{s.ingredientName}</TD>
                                    <TD>{s.unitName}</TD>
                                    <TD>
                                        {s.quantity} {uom}
                                    </TD>
                                    <TD>
                                        {s.minimumQty} {uom}
                                    </TD>
                                    <TD>R$ {s.averageCost.toFixed(4)}</TD>
                                    <TD>
                                        <Badge variant={s.belowMinimum ? "danger" : "success"}>
                                            {s.belowMinimum ? "Abaixo" : "OK"}
                                        </Badge>
                                    </TD>
                                    <TD>{new Date(s.updatedAt).toLocaleString("pt-BR")}</TD>
                                </TR>
                            )
                        })}
                    </TBody>
                </Table>
            )}

            {data && data.total > size ? (
                <div className="flex items-center justify-between text-sm text-text-secondary">
                    <span>
                        Página {page + 1} de {totalPages} · {size} por página
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            disabled={page === 0}
                        >
                            Anterior
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPage((p) => p + 1)}
                            disabled={page + 1 >= totalPages}
                        >
                            Próximo
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    )
}

export default function StockPage() {
    return (
        <Suspense fallback={null}>
            <StockPageInner />
        </Suspense>
    )
}
```

> **Nota:** `Badge` já tem variants `neutral | success | danger | warning`
> (`components/ui/badge.tsx`). Não precisa estender.

- [ ] **Step 4: Rodar testes — devem passar**

```bash
cd frontend && npx vitest run tests/stock-page.test.tsx
```

Expected: todos passam.

- [ ] **Step 5: Rodar suíte completa para não-regressão**

```bash
cd frontend && npx vitest run
```

Expected: todos passam.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/\(protected\)/stock/page.tsx frontend/tests/stock-page.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): /stock listing with filters and below-minimum toggle

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `lib/stock-movements.ts` — types + schema + hooks

**Files:**
- Create: `frontend/lib/stock-movements.ts`
- Modify: `frontend/tests/schemas.test.ts` (adicionar describe)

**Why:** Movements tem 1 mutation (createAdjustment) com schema zod e hooks
de leitura com filtros multi-campo.

- [ ] **Step 1: Adicionar testes de schema (failing) ao final de `frontend/tests/schemas.test.ts`**

Adicionar import no topo, junto com os existentes:

```ts
import { createAdjustmentSchema } from "@/lib/stock-movements"
```

Adicionar no fim do arquivo:

```ts
describe("createAdjustmentSchema", () => {
    const validBase = {
        ingredientId: "11111111-1111-1111-1111-111111111111",
        unitId: "22222222-2222-2222-2222-222222222222",
        quantity: 5,
        direction: "INCREASE" as const,
        reason: "Sobra de evento",
    }

    it("accepts a minimal valid input", () => {
        const r = createAdjustmentSchema.safeParse(validBase)
        expect(r.success).toBe(true)
    })

    it("accepts both directions", () => {
        for (const d of ["INCREASE", "DECREASE"]) {
            const r = createAdjustmentSchema.safeParse({ ...validBase, direction: d })
            expect(r.success).toBe(true)
        }
    })

    it("rejects unknown direction", () => {
        const r = createAdjustmentSchema.safeParse({ ...validBase, direction: "OTHER" })
        expect(r.success).toBe(false)
    })

    it("rejects non-positive quantity", () => {
        expect(createAdjustmentSchema.safeParse({ ...validBase, quantity: 0 }).success).toBe(false)
        expect(createAdjustmentSchema.safeParse({ ...validBase, quantity: -1 }).success).toBe(false)
    })

    it("coerces quantity from string", () => {
        const r = createAdjustmentSchema.safeParse({ ...validBase, quantity: "5.5" })
        expect(r.success).toBe(true)
    })

    it("rejects empty reason", () => {
        const r = createAdjustmentSchema.safeParse({ ...validBase, reason: "" })
        expect(r.success).toBe(false)
    })

    it("rejects reason > 255 chars", () => {
        const r = createAdjustmentSchema.safeParse({ ...validBase, reason: "x".repeat(256) })
        expect(r.success).toBe(false)
    })

    it("rejects non-uuid ingredientId/unitId", () => {
        expect(createAdjustmentSchema.safeParse({ ...validBase, ingredientId: "no" }).success).toBe(false)
        expect(createAdjustmentSchema.safeParse({ ...validBase, unitId: "no" }).success).toBe(false)
    })
})
```

- [ ] **Step 2: Rodar testes — devem falhar (módulo não existe)**

```bash
cd frontend && npx vitest run tests/schemas.test.ts
```

Expected: erro de import.

- [ ] **Step 3: Criar `frontend/lib/stock-movements.ts`**

```ts
import { api } from "@/lib/api"
import type { Page } from "@/lib/users"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

export const MOVEMENT_TYPES = ["ENTRY", "EXIT", "ADJUSTMENT"] as const
export type MovementType = (typeof MOVEMENT_TYPES)[number]

export const ADJUSTMENT_DIRECTIONS = ["INCREASE", "DECREASE"] as const
export type AdjustmentDirection = (typeof ADJUSTMENT_DIRECTIONS)[number]

export type StockMovement = {
    id: string
    ingredientId: string
    ingredientName: string
    unitId: string
    unitName: string
    type: MovementType
    quantity: number
    unitPrice: number | null
    reason: string | null
    purchaseOrderId: string | null
    createdById: string
    createdByName: string
    createdAt: string
}

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export const createAdjustmentSchema = z.object({
    ingredientId: z.string().regex(UUID_REGEX, "Selecione um ingrediente"),
    unitId: z.string().regex(UUID_REGEX, "Selecione uma unidade"),
    quantity: z.coerce.number().positive("Informe uma quantidade positiva"),
    direction: z.enum(ADJUSTMENT_DIRECTIONS),
    reason: z.string().min(1, "Informe o motivo").max(255),
})
export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>

export type StockMovementFilters = {
    ingredient?: string
    unit?: string
    type?: MovementType
    from?: string
    to?: string
    page?: number
    size?: number
}

export function useStockMovements(filters: StockMovementFilters = {}) {
    const page = filters.page ?? 0
    const size = filters.size ?? 20
    const params: Record<string, string | number> = { page, size }
    if (filters.ingredient) params.ingredient = filters.ingredient
    if (filters.unit) params.unit = filters.unit
    if (filters.type) params.type = filters.type
    if (filters.from) params.from = filters.from
    if (filters.to) params.to = filters.to
    return useQuery({
        queryKey: [
            "stock-movements",
            {
                ingredient: filters.ingredient ?? null,
                unit: filters.unit ?? null,
                type: filters.type ?? null,
                from: filters.from ?? null,
                to: filters.to ?? null,
                page,
                size,
            },
        ],
        queryFn: () =>
            api.get<Page<StockMovement>>("/stock-movements", { params }).then((r) => r.data),
    })
}

export function useStockMovement(id: string) {
    return useQuery({
        queryKey: ["stock-movements", id],
        queryFn: () =>
            api.get<StockMovement>(`/stock-movements/${id}`).then((r) => r.data),
        enabled: !!id,
    })
}

export function useCreateAdjustment() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (input: CreateAdjustmentInput) =>
            api
                .post<StockMovement>("/stock-movements", input)
                .then((r) => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["stock-movements"] })
            qc.invalidateQueries({ queryKey: ["stock"] })
        },
    })
}
```

- [ ] **Step 4: Rodar testes de schema — devem passar**

```bash
cd frontend && npx vitest run tests/schemas.test.ts
```

Expected: todos passam.

- [ ] **Step 5: Rodar suíte completa**

```bash
cd frontend && npx vitest run
```

Expected: todos passam.

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/stock-movements.ts frontend/tests/schemas.test.ts
git commit -m "$(cat <<'EOF'
feat(frontend): stock-movements types, adjustment schema and hooks

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `/stock-movements` page + adjustment-dialog + tests

**Files:**
- Create: `frontend/app/(protected)/stock-movements/page.tsx`
- Create: `frontend/app/(protected)/stock-movements/adjustment-dialog.tsx`
- Create: `frontend/tests/stock-movements-page.test.tsx`

**Why:** Listagem com filtros (ingrediente, unidade, tipo, período) +
modal "Novo ajuste" só pra OWNER. Linha com `purchaseOrderId` mostra link
para a PO.

- [ ] **Step 1: Criar `frontend/tests/stock-movements-page.test.tsx` (failing)**

```tsx
import { fireEvent, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/stock-movements",
}))

import StockMovementsPage from "@/app/(protected)/stock-movements/page"
import { tokenStorage } from "@/lib/api"
import { renderWithProviders, resetMockApi, setHandler } from "./helpers"

beforeEach(() => {
    resetMockApi()
})

function meHandler(role: "OWNER" | "EMPLOYEE") {
    return {
        status: 200,
        data: {
            data: {
                id: "u1",
                name: "Ana",
                email: "ana@x.com",
                role,
                active: true,
                createdAt: "2026-01-01T00:00:00Z",
            },
        },
    }
}

function listHandler() {
    return {
        status: 200,
        data: {
            data: [
                {
                    id: "m1",
                    ingredientId: "ing1",
                    ingredientName: "Mussarela",
                    unitId: "un1",
                    unitName: "Centro",
                    type: "ENTRY",
                    quantity: 10,
                    unitPrice: 23,
                    reason: null,
                    purchaseOrderId: "po1abcdef0000000000000000000000",
                    createdById: "u1",
                    createdByName: "Ana",
                    createdAt: "2026-01-01T00:00:00Z",
                },
            ],
            page: 0,
            size: 20,
            total: 1,
        },
    }
}

describe("StockMovementsPage", () => {
    it("EMPLOYEE sees rows but no 'Novo ajuste' button", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("EMPLOYEE")
            if (url.includes("/units"))
                return { status: 200, data: { data: [], page: 0, size: 1000, total: 0 } }
            if (url.includes("/ingredients"))
                return { status: 200, data: { data: [], page: 0, size: 1000, total: 0 } }
            if (url.includes("/stock-movements") && cfg.method === "get") return listHandler()
            return { status: 500 }
        })
        renderWithProviders(<StockMovementsPage />)
        await waitFor(() => expect(screen.getByText("Mussarela")).toBeInTheDocument())
        expect(screen.queryByRole("button", { name: /novo ajuste/i })).not.toBeInTheDocument()
    })

    it("OWNER opens modal, submits adjustment, list refetches", async () => {
        tokenStorage.setAccess("a1")
        let postCount = 0
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("OWNER")
            if (url.includes("/units")) {
                return {
                    status: 200,
                    data: {
                        data: [{ id: "un1", name: "Centro", address: null, active: true, createdAt: "2026-01-01T00:00:00Z" }],
                        page: 0,
                        size: 1000,
                        total: 1,
                    },
                }
            }
            if (url.includes("/ingredients")) {
                return {
                    status: 200,
                    data: {
                        data: [
                            {
                                id: "11111111-1111-1111-1111-111111111111",
                                name: "Mussarela",
                                description: null,
                                categoryId: "c1",
                                unitOfMeasure: "kg",
                                minimumQty: 5,
                                averageCost: 23,
                                expiryDate: null,
                                defaultSupplierId: null,
                                active: true,
                                createdAt: "2026-01-01T00:00:00Z",
                            },
                        ],
                        page: 0,
                        size: 1000,
                        total: 1,
                    },
                }
            }
            if (url.endsWith("/stock-movements") && cfg.method === "get") return listHandler()
            if (url.endsWith("/stock-movements") && cfg.method === "post") {
                postCount++
                return {
                    status: 201,
                    data: {
                        data: {
                            id: "m2",
                            ingredientId: "11111111-1111-1111-1111-111111111111",
                            ingredientName: "Mussarela",
                            unitId: "un1",
                            unitName: "Centro",
                            type: "ADJUSTMENT",
                            quantity: 1,
                            unitPrice: null,
                            reason: "Sobra",
                            purchaseOrderId: null,
                            createdById: "u1",
                            createdByName: "Ana",
                            createdAt: "2026-01-02T00:00:00Z",
                        },
                    },
                }
            }
            return { status: 500 }
        })
        renderWithProviders(<StockMovementsPage />)
        await waitFor(() => expect(screen.getByText("Mussarela")).toBeInTheDocument())
        fireEvent.click(screen.getByRole("button", { name: /novo ajuste/i }))
        // wait for modal
        await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument())
        fireEvent.change(screen.getByLabelText(/ingrediente/i), {
            target: { value: "11111111-1111-1111-1111-111111111111" },
        })
        fireEvent.change(screen.getByLabelText(/unidade/i), { target: { value: "un1" } })
        fireEvent.change(screen.getByLabelText(/quantidade/i), { target: { value: "1" } })
        fireEvent.change(screen.getByLabelText(/motivo/i), { target: { value: "Sobra" } })
        fireEvent.click(screen.getByRole("button", { name: /salvar/i }))
        await waitFor(() => expect(postCount).toBe(1))
    })
})
```

- [ ] **Step 2: Rodar teste — deve falhar (módulos não existem)**

```bash
cd frontend && npx vitest run tests/stock-movements-page.test.tsx
```

Expected: erro de import.

- [ ] **Step 3: Criar `frontend/app/(protected)/stock-movements/adjustment-dialog.tsx`**

```tsx
"use client"

import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/overlays/modal"
import { isApiError } from "@/lib/auth"
import { useAllIngredients } from "@/lib/ingredients"
import {
    ADJUSTMENT_DIRECTIONS,
    createAdjustmentSchema,
    useCreateAdjustment,
    type CreateAdjustmentInput,
} from "@/lib/stock-movements"
import { useAllUnits } from "@/lib/units"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

type Props = {
    open: boolean
    onClose: () => void
}

export function AdjustmentDialog({ open, onClose }: Props) {
    const ingredients = useAllIngredients()
    const units = useAllUnits()
    const create = useCreateAdjustment()

    const form = useForm<CreateAdjustmentInput>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(createAdjustmentSchema) as any,
        defaultValues: {
            ingredientId: "",
            unitId: "",
            quantity: 0,
            direction: "INCREASE",
            reason: "",
        },
    })

    async function onSubmit(values: CreateAdjustmentInput) {
        try {
            await create.mutateAsync(values)
            toast.success("Ajuste registrado")
            form.reset()
            onClose()
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao registrar ajuste")
        }
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Novo ajuste de estoque"
            footer={
                <>
                    <Button type="button" variant="ghost" onClick={onClose} disabled={create.isPending}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="adjustment-form"
                        disabled={create.isPending}
                    >
                        {create.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                </>
            }
        >
            <form id="adjustment-form" className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
                <Field
                    label="Ingrediente"
                    htmlFor="adj-ingredient"
                    error={form.formState.errors.ingredientId?.message}
                >
                    <Select id="adj-ingredient" {...form.register("ingredientId")}>
                        <option value="">Selecione...</option>
                        {ingredients.data?.map((i) => (
                            <option key={i.id} value={i.id}>
                                {i.name}
                            </option>
                        ))}
                    </Select>
                </Field>

                <Field
                    label="Unidade"
                    htmlFor="adj-unit"
                    error={form.formState.errors.unitId?.message}
                >
                    <Select id="adj-unit" {...form.register("unitId")}>
                        <option value="">Selecione...</option>
                        {units.data?.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.name}
                            </option>
                        ))}
                    </Select>
                </Field>

                <Field
                    label="Quantidade"
                    htmlFor="adj-qty"
                    error={form.formState.errors.quantity?.message}
                >
                    <Input
                        id="adj-qty"
                        type="number"
                        step="0.001"
                        min="0"
                        {...form.register("quantity")}
                    />
                </Field>

                <fieldset>
                    <legend className="mb-1 text-sm font-medium text-text-primary">Direção</legend>
                    <div className="flex gap-4">
                        {ADJUSTMENT_DIRECTIONS.map((d) => (
                            <label key={d} className="flex items-center gap-2 text-sm">
                                <input type="radio" value={d} {...form.register("direction")} />
                                {d === "INCREASE" ? "Aumentar" : "Diminuir"}
                            </label>
                        ))}
                    </div>
                </fieldset>

                <Field
                    label="Motivo"
                    htmlFor="adj-reason"
                    error={form.formState.errors.reason?.message}
                >
                    <Input id="adj-reason" {...form.register("reason")} />
                </Field>
            </form>
        </Modal>
    )
}
```

- [ ] **Step 4: Criar `frontend/app/(protected)/stock-movements/page.tsx`**

```tsx
"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { useAuth } from "@/lib/auth"
import { useAllIngredients } from "@/lib/ingredients"
import {
    MOVEMENT_TYPES,
    useStockMovements,
    type MovementType,
} from "@/lib/stock-movements"
import { useAllUnits } from "@/lib/units"
import { Plus } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { AdjustmentDialog } from "./adjustment-dialog"

function typeLabel(t: MovementType) {
    return t === "ENTRY" ? "Entrada" : t === "EXIT" ? "Saída" : "Ajuste"
}

function typeVariant(t: MovementType) {
    return t === "ENTRY" ? "success" : t === "EXIT" ? "danger" : "warning"
}

function StockMovementsPageInner() {
    const { user } = useAuth()
    const isOwner = user?.role === "OWNER"
    const router = useRouter()
    const searchParams = useSearchParams()

    const ingredientParam = searchParams.get("ingredient") ?? ""
    const unitParam = searchParams.get("unit") ?? ""
    const typeParam = (searchParams.get("type") as MovementType | null) ?? undefined
    const fromParam = searchParams.get("from") ?? ""
    const toParam = searchParams.get("to") ?? ""

    const [page, setPage] = useState(0)
    const size = 20

    const query = useStockMovements({
        ingredient: ingredientParam || undefined,
        unit: unitParam || undefined,
        type: typeParam,
        from: fromParam || undefined,
        to: toParam || undefined,
        page,
        size,
    })

    const ingredients = useAllIngredients()
    const units = useAllUnits()

    const [open, setOpen] = useState(false)

    function setFilter(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString())
        if (value === "") params.delete(key)
        else params.set(key, value)
        setPage(0)
        router.replace(`/stock-movements?${params.toString()}`)
    }

    const data = query.data
    const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1

    return (
        <div className="space-y-6">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-text-primary">Movimentações</h1>
                    <p className="mt-1 text-sm text-text-secondary">
                        Histórico de entradas, saídas e ajustes.
                    </p>
                </div>
                {isOwner ? (
                    <Button onClick={() => setOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> Novo ajuste
                    </Button>
                ) : null}
            </header>

            <div className="flex flex-wrap items-end gap-3">
                <Field label="Ingrediente" htmlFor="filter-ingredient">
                    <Select
                        id="filter-ingredient"
                        value={ingredientParam}
                        onChange={(e) => setFilter("ingredient", e.target.value)}
                    >
                        <option value="">Todos</option>
                        {ingredients.data?.map((i) => (
                            <option key={i.id} value={i.id}>
                                {i.name}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field label="Unidade" htmlFor="filter-unit">
                    <Select
                        id="filter-unit"
                        value={unitParam}
                        onChange={(e) => setFilter("unit", e.target.value)}
                    >
                        <option value="">Todas</option>
                        {units.data?.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.name}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field label="Tipo" htmlFor="filter-type">
                    <Select
                        id="filter-type"
                        value={typeParam ?? ""}
                        onChange={(e) => setFilter("type", e.target.value)}
                    >
                        <option value="">Todos</option>
                        {MOVEMENT_TYPES.map((t) => (
                            <option key={t} value={t}>
                                {typeLabel(t)}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field label="De" htmlFor="filter-from">
                    <Input
                        id="filter-from"
                        type="date"
                        value={fromParam}
                        onChange={(e) => setFilter("from", e.target.value)}
                    />
                </Field>
                <Field label="Até" htmlFor="filter-to">
                    <Input
                        id="filter-to"
                        type="date"
                        value={toParam}
                        onChange={(e) => setFilter("to", e.target.value)}
                    />
                </Field>
            </div>

            {query.isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-12 animate-pulse rounded-lg bg-text-primary/5" />
                    ))}
                </div>
            ) : query.isError ? (
                <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
                    <p className="text-sm text-danger">Falha ao carregar movimentações.</p>
                    <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
                        Tentar novamente
                    </Button>
                </div>
            ) : data && data.data.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                    <p className="text-sm text-text-secondary">Nenhuma movimentação registrada.</p>
                </div>
            ) : (
                <Table>
                    <THead>
                        <TR>
                            <TH>Data</TH>
                            <TH>Tipo</TH>
                            <TH>Ingrediente</TH>
                            <TH>Unidade</TH>
                            <TH>Quantidade</TH>
                            <TH>Preço unit.</TH>
                            <TH>Origem/Motivo</TH>
                            <TH>Por</TH>
                        </TR>
                    </THead>
                    <TBody>
                        {data!.data.map((m) => {
                            const sign = m.type === "ENTRY" ? "+" : m.type === "EXIT" ? "−" : ""
                            return (
                                <TR key={m.id}>
                                    <TD>{new Date(m.createdAt).toLocaleString("pt-BR")}</TD>
                                    <TD>
                                        <Badge variant={typeVariant(m.type)}>{typeLabel(m.type)}</Badge>
                                    </TD>
                                    <TD>{m.ingredientName}</TD>
                                    <TD>{m.unitName}</TD>
                                    <TD>
                                        {sign}
                                        {m.quantity}
                                    </TD>
                                    <TD>{m.unitPrice !== null ? `R$ ${m.unitPrice}` : "—"}</TD>
                                    <TD>
                                        {m.purchaseOrderId ? (
                                            <Link
                                                href={`/purchase-orders/${m.purchaseOrderId}`}
                                                className="text-primary hover:underline"
                                            >
                                                Compra #{m.purchaseOrderId.slice(0, 8)}
                                            </Link>
                                        ) : (
                                            m.reason ?? "—"
                                        )}
                                    </TD>
                                    <TD>{m.createdByName}</TD>
                                </TR>
                            )
                        })}
                    </TBody>
                </Table>
            )}

            {data && data.total > size ? (
                <div className="flex items-center justify-between text-sm text-text-secondary">
                    <span>
                        Página {page + 1} de {totalPages} · {size} por página
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            disabled={page === 0}
                        >
                            Anterior
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPage((p) => p + 1)}
                            disabled={page + 1 >= totalPages}
                        >
                            Próximo
                        </Button>
                    </div>
                </div>
            ) : null}

            <AdjustmentDialog open={open} onClose={() => setOpen(false)} />
        </div>
    )
}

export default function StockMovementsPage() {
    return (
        <Suspense fallback={null}>
            <StockMovementsPageInner />
        </Suspense>
    )
}
```

> **Nota:** `Badge` já tem todas as variants usadas aqui
> (`neutral | success | danger | warning`).

- [ ] **Step 5: Rodar testes — devem passar**

```bash
cd frontend && npx vitest run tests/stock-movements-page.test.tsx
```

Expected: passam (incluindo o teste de submit do modal).

- [ ] **Step 6: Rodar suíte completa**

```bash
cd frontend && npx vitest run
```

- [ ] **Step 7: Commit**

```bash
git add frontend/app/\(protected\)/stock-movements frontend/tests/stock-movements-page.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): /stock-movements listing with filters and adjustment modal

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `lib/purchase-orders.ts` — types + schemas + hooks

**Files:**
- Create: `frontend/lib/purchase-orders.ts`
- Modify: `frontend/tests/schemas.test.ts` (adicionar describes)

**Why:** Estabelece tipos, schemas zod (incluindo `.refine` para
duplicados), e os 6 hooks (read + create + update + receive + cancel +
detail).

- [ ] **Step 1: Adicionar testes de schema (failing) ao final de `frontend/tests/schemas.test.ts`**

Adicionar import no topo:

```ts
import { createPurchaseOrderSchema } from "@/lib/purchase-orders"
```

Adicionar no fim do arquivo:

```ts
describe("createPurchaseOrderSchema", () => {
    const validBase = {
        supplierId: "11111111-1111-1111-1111-111111111111",
        unitId: "22222222-2222-2222-2222-222222222222",
        expectedAt: "",
        notes: "",
        items: [
            {
                ingredientId: "33333333-3333-3333-3333-333333333333",
                quantity: 5,
                unitPrice: 10,
            },
        ],
    }

    it("accepts a minimal valid input", () => {
        const r = createPurchaseOrderSchema.safeParse(validBase)
        expect(r.success).toBe(true)
    })

    it("rejects when items is empty", () => {
        const r = createPurchaseOrderSchema.safeParse({ ...validBase, items: [] })
        expect(r.success).toBe(false)
    })

    it("rejects duplicate ingredients in items", () => {
        const r = createPurchaseOrderSchema.safeParse({
            ...validBase,
            items: [
                { ingredientId: "33333333-3333-3333-3333-333333333333", quantity: 1, unitPrice: 1 },
                { ingredientId: "33333333-3333-3333-3333-333333333333", quantity: 2, unitPrice: 2 },
            ],
        })
        expect(r.success).toBe(false)
    })

    it("rejects non-positive quantity in item", () => {
        const r = createPurchaseOrderSchema.safeParse({
            ...validBase,
            items: [
                { ingredientId: "33333333-3333-3333-3333-333333333333", quantity: 0, unitPrice: 1 },
            ],
        })
        expect(r.success).toBe(false)
    })

    it("rejects non-positive unitPrice in item", () => {
        const r = createPurchaseOrderSchema.safeParse({
            ...validBase,
            items: [
                { ingredientId: "33333333-3333-3333-3333-333333333333", quantity: 1, unitPrice: 0 },
            ],
        })
        expect(r.success).toBe(false)
    })

    it("accepts valid expectedAt", () => {
        const r = createPurchaseOrderSchema.safeParse({ ...validBase, expectedAt: "2026-12-31" })
        expect(r.success).toBe(true)
    })

    it("rejects invalid expectedAt", () => {
        const r = createPurchaseOrderSchema.safeParse({ ...validBase, expectedAt: "31/12/2026" })
        expect(r.success).toBe(false)
    })

    it("rejects notes > 500 chars", () => {
        const r = createPurchaseOrderSchema.safeParse({ ...validBase, notes: "x".repeat(501) })
        expect(r.success).toBe(false)
    })

    it("rejects non-uuid supplierId/unitId", () => {
        expect(createPurchaseOrderSchema.safeParse({ ...validBase, supplierId: "no" }).success).toBe(false)
        expect(createPurchaseOrderSchema.safeParse({ ...validBase, unitId: "no" }).success).toBe(false)
    })
})
```

- [ ] **Step 2: Rodar testes — devem falhar**

```bash
cd frontend && npx vitest run tests/schemas.test.ts
```

Expected: erro de import.

- [ ] **Step 3: Criar `frontend/lib/purchase-orders.ts`**

```ts
import { api } from "@/lib/api"
import type { Page } from "@/lib/users"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

export const PURCHASE_ORDER_STATUSES = ["PENDING", "RECEIVED", "CANCELED"] as const
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
    items: PurchaseOrderItem[]
}

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export const purchaseOrderItemSchema = z.object({
    ingredientId: z.string().regex(UUID_REGEX, "Selecione um ingrediente"),
    quantity: z.coerce.number().positive("Quantidade > 0"),
    unitPrice: z.coerce.number().positive("Preço > 0"),
})
export type PurchaseOrderItemInput = z.infer<typeof purchaseOrderItemSchema>

export const createPurchaseOrderSchema = z.object({
    supplierId: z.string().regex(UUID_REGEX, "Selecione um fornecedor"),
    unitId: z.string().regex(UUID_REGEX, "Selecione uma unidade"),
    expectedAt: z
        .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"), z.literal("")])
        .optional(),
    notes: z.string().max(500).optional().or(z.literal("")),
    items: z
        .array(purchaseOrderItemSchema)
        .min(1, "Adicione ao menos 1 item")
        .refine(
            (arr) => new Set(arr.map((i) => i.ingredientId)).size === arr.length,
            "Ingredientes duplicados não são permitidos"
        ),
})
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>

export const updatePurchaseOrderSchema = createPurchaseOrderSchema
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>

export type PurchaseOrderFilters = {
    status?: PurchaseOrderStatus
    supplier?: string
    unit?: string
    from?: string
    to?: string
    page?: number
    size?: number
}

export function usePurchaseOrders(filters: PurchaseOrderFilters = {}) {
    const page = filters.page ?? 0
    const size = filters.size ?? 20
    const params: Record<string, string | number> = { page, size }
    if (filters.status) params.status = filters.status
    if (filters.supplier) params.supplier = filters.supplier
    if (filters.unit) params.unit = filters.unit
    if (filters.from) params.from = filters.from
    if (filters.to) params.to = filters.to
    return useQuery({
        queryKey: [
            "purchase-orders",
            {
                status: filters.status ?? null,
                supplier: filters.supplier ?? null,
                unit: filters.unit ?? null,
                from: filters.from ?? null,
                to: filters.to ?? null,
                page,
                size,
            },
        ],
        queryFn: () =>
            api.get<Page<PurchaseOrder>>("/purchase-orders", { params }).then((r) => r.data),
    })
}

export function usePurchaseOrder(id: string) {
    return useQuery({
        queryKey: ["purchase-orders", id],
        queryFn: () =>
            api.get<PurchaseOrder>(`/purchase-orders/${id}`).then((r) => r.data),
        enabled: !!id,
    })
}

function normalizePayload(input: CreatePurchaseOrderInput | UpdatePurchaseOrderInput) {
    return {
        ...input,
        expectedAt: input.expectedAt === "" ? null : input.expectedAt,
        notes: input.notes === "" ? null : input.notes,
    }
}

export function useCreatePurchaseOrder() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (input: CreatePurchaseOrderInput) =>
            api
                .post<PurchaseOrder>("/purchase-orders", normalizePayload(input))
                .then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders"] }),
    })
}

export function useUpdatePurchaseOrder() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: UpdatePurchaseOrderInput }) =>
            api
                .put<PurchaseOrder>(`/purchase-orders/${id}`, normalizePayload(input))
                .then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders"] }),
    })
}

export function useReceivePurchaseOrder() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) =>
            api.post<PurchaseOrder>(`/purchase-orders/${id}/receive`).then((r) => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["purchase-orders"] })
            qc.invalidateQueries({ queryKey: ["stock"] })
            qc.invalidateQueries({ queryKey: ["stock-movements"] })
        },
    })
}

export function useCancelPurchaseOrder() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) =>
            api.post<PurchaseOrder>(`/purchase-orders/${id}/cancel`).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders"] }),
    })
}
```

- [ ] **Step 4: Rodar testes de schema — devem passar**

```bash
cd frontend && npx vitest run tests/schemas.test.ts
```

- [ ] **Step 5: Rodar suíte completa**

```bash
cd frontend && npx vitest run
```

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/purchase-orders.ts frontend/tests/schemas.test.ts
git commit -m "$(cat <<'EOF'
feat(frontend): purchase-orders types, schemas and TanStack hooks

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `purchase-order-form.tsx` (componente compartilhado) + tests

**Files:**
- Create: `frontend/app/(protected)/purchase-orders/purchase-order-form.tsx`
- Create: `frontend/tests/purchase-order-form.test.tsx`

**Why:** Form com `useFieldArray` consumido por `nova/page.tsx` e
`[id]/editar/page.tsx`. Pré-popula `unitPrice` com `averageCost` ao
selecionar ingrediente; total client-side; validação inline (RHF).

- [ ] **Step 1: Criar `frontend/tests/purchase-order-form.test.tsx` (failing)**

```tsx
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const replaceMock = vi.fn()
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: replaceMock, back: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/purchase-orders/nova",
}))

import { PurchaseOrderForm } from "@/app/(protected)/purchase-orders/purchase-order-form"
import { tokenStorage } from "@/lib/api"
import { renderWithProviders, getCalls, resetMockApi, setHandler } from "./helpers"

beforeEach(() => {
    resetMockApi()
    replaceMock.mockReset()
})

const supplierUUID = "11111111-1111-1111-1111-111111111111"
const unitUUID = "22222222-2222-2222-2222-222222222222"
const ingredientUUID = "33333333-3333-3333-3333-333333333333"

function meHandler() {
    return {
        status: 200,
        data: {
            data: {
                id: "u1",
                name: "Ana",
                email: "a@x.com",
                role: "OWNER",
                active: true,
                createdAt: "2026-01-01T00:00:00Z",
            },
        },
    }
}

function selectsHandler(cfg: { url?: string; method?: string }) {
    const url = cfg.url ?? ""
    if (url.endsWith("/users/me")) return meHandler()
    if (url.includes("/suppliers")) {
        return {
            status: 200,
            data: {
                data: [
                    {
                        id: supplierUUID,
                        name: "Distribuidora ABC",
                        contactName: null,
                        phone: null,
                        email: null,
                        address: null,
                        active: true,
                        createdAt: "2026-01-01T00:00:00Z",
                    },
                ],
                page: 0,
                size: 1000,
                total: 1,
            },
        }
    }
    if (url.includes("/units")) {
        return {
            status: 200,
            data: {
                data: [{ id: unitUUID, name: "Centro", address: null, active: true, createdAt: "2026-01-01T00:00:00Z" }],
                page: 0,
                size: 1000,
                total: 1,
            },
        }
    }
    if (url.includes("/ingredients")) {
        return {
            status: 200,
            data: {
                data: [
                    {
                        id: ingredientUUID,
                        name: "Mussarela",
                        description: null,
                        categoryId: "c1",
                        unitOfMeasure: "kg",
                        minimumQty: 5,
                        averageCost: 23.5,
                        expiryDate: null,
                        defaultSupplierId: null,
                        active: true,
                        createdAt: "2026-01-01T00:00:00Z",
                    },
                ],
                page: 0,
                size: 1000,
                total: 1,
            },
        }
    }
    return null
}

describe("PurchaseOrderForm (create)", () => {
    it("renders, adds an item, prefills unitPrice, computes total, submits", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const r = selectsHandler(cfg)
            if (r) return r
            const url = cfg.url ?? ""
            if (url.endsWith("/purchase-orders") && cfg.method === "post") {
                return { status: 201, data: { data: { id: "po1" } } }
            }
            return { status: 500 }
        })

        renderWithProviders(<PurchaseOrderForm mode="create" />)

        // wait for selects to populate
        await waitFor(() => expect(screen.getByText("Distribuidora ABC")).toBeInTheDocument())

        fireEvent.change(screen.getByLabelText(/fornecedor/i), { target: { value: supplierUUID } })
        fireEvent.change(screen.getByLabelText(/unidade/i), { target: { value: unitUUID } })

        // first item is auto-rendered (one default empty row)
        const itemsBlock = screen.getByTestId("po-items")
        const firstRow = within(itemsBlock).getAllByTestId("po-item-row")[0]

        // pick ingredient
        fireEvent.change(within(firstRow).getByLabelText(/ingrediente/i), {
            target: { value: ingredientUUID },
        })

        // unitPrice is auto-populated with averageCost (23.5)
        await waitFor(() =>
            expect((within(firstRow).getByLabelText(/preço/i) as HTMLInputElement).value).toBe("23.5")
        )

        // qty
        fireEvent.change(within(firstRow).getByLabelText(/quantidade/i), { target: { value: "2" } })

        // total = 2 * 23.5 = 47
        await waitFor(() => expect(screen.getByTestId("po-total").textContent).toMatch(/47/))

        fireEvent.click(screen.getByRole("button", { name: /salvar/i }))

        await waitFor(() => {
            const post = getCalls().find((c) => c.method === "post" && c.url?.endsWith("/purchase-orders"))
            expect(post).toBeTruthy()
        })
    })

    it("rejects empty items list", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const r = selectsHandler(cfg)
            if (r) return r
            return { status: 500 }
        })

        renderWithProviders(<PurchaseOrderForm mode="create" />)
        await waitFor(() => expect(screen.getByText("Distribuidora ABC")).toBeInTheDocument())

        // remove the only row
        const itemsBlock = screen.getByTestId("po-items")
        const removeBtn = within(itemsBlock).queryByRole("button", { name: /remover item/i })
        // remove may be disabled when there's only 1 row — check
        expect(removeBtn).toBeDisabled()
    })
})
```

- [ ] **Step 2: Rodar teste — deve falhar**

```bash
cd frontend && npx vitest run tests/purchase-order-form.test.tsx
```

Expected: erro de import.

- [ ] **Step 3: Criar `frontend/app/(protected)/purchase-orders/purchase-order-form.tsx`**

```tsx
"use client"

import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { isApiError } from "@/lib/auth"
import { useAllIngredients } from "@/lib/ingredients"
import {
    createPurchaseOrderSchema,
    updatePurchaseOrderSchema,
    useCreatePurchaseOrder,
    useUpdatePurchaseOrder,
    type CreatePurchaseOrderInput,
    type PurchaseOrder,
    type UpdatePurchaseOrderInput,
} from "@/lib/purchase-orders"
import { useActiveSuppliers } from "@/lib/suppliers"
import { useAllUnits } from "@/lib/units"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

type Props = {
    mode: "create" | "edit"
    initial?: PurchaseOrder
}

export function PurchaseOrderForm({ mode, initial }: Props) {
    const router = useRouter()
    const suppliers = useActiveSuppliers()
    const units = useAllUnits()
    const ingredients = useAllIngredients()
    const create = useCreatePurchaseOrder()
    const update = useUpdatePurchaseOrder()

    const form = useForm<CreatePurchaseOrderInput>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(
            mode === "edit" ? updatePurchaseOrderSchema : createPurchaseOrderSchema
        ) as any,
        defaultValues:
            mode === "edit" && initial
                ? {
                      supplierId: initial.supplierId,
                      unitId: initial.unitId,
                      expectedAt: initial.expectedAt ?? "",
                      notes: initial.notes ?? "",
                      items: initial.items.map((i) => ({
                          ingredientId: i.ingredientId,
                          quantity: i.quantity,
                          unitPrice: i.unitPrice,
                      })),
                  }
                : {
                      supplierId: "",
                      unitId: "",
                      expectedAt: "",
                      notes: "",
                      items: [{ ingredientId: "", quantity: 0, unitPrice: 0 }],
                  },
    })

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items",
    })

    const watchedItems = useWatch({ control: form.control, name: "items" }) ?? []

    const total = watchedItems.reduce(
        (acc: number, it) => acc + (Number(it?.quantity) || 0) * (Number(it?.unitPrice) || 0),
        0
    )

    function onIngredientChange(index: number, ingredientId: string) {
        form.setValue(`items.${index}.ingredientId`, ingredientId, { shouldDirty: true })
        const currentPrice = form.getValues(`items.${index}.unitPrice`)
        if (!currentPrice || Number(currentPrice) === 0) {
            const ing = ingredients.data?.find((i) => i.id === ingredientId)
            if (ing) form.setValue(`items.${index}.unitPrice`, ing.averageCost)
        }
    }

    async function onSubmit(values: CreatePurchaseOrderInput) {
        try {
            if (mode === "edit" && initial) {
                const updated = await update.mutateAsync({
                    id: initial.id,
                    input: values as UpdatePurchaseOrderInput,
                })
                toast.success("Compra atualizada")
                router.replace(`/purchase-orders/${updated.id}`)
            } else {
                const created = await create.mutateAsync(values)
                toast.success("Compra criada")
                router.replace(`/purchase-orders/${created.id}`)
            }
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao salvar compra")
        }
    }

    const submitting = create.isPending || update.isPending

    return (
        <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
            <section className="space-y-4 rounded-xl border border-border/40 bg-white p-5">
                <h2 className="text-base font-semibold text-text-primary">Dados da compra</h2>

                <Field
                    label="Fornecedor"
                    htmlFor="po-supplier"
                    error={form.formState.errors.supplierId?.message}
                >
                    <Select
                        id="po-supplier"
                        disabled={suppliers.isPending}
                        {...form.register("supplierId")}
                    >
                        <option value="">{suppliers.isPending ? "Carregando..." : "Selecione..."}</option>
                        {suppliers.data?.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </Select>
                </Field>

                <Field
                    label="Unidade"
                    htmlFor="po-unit"
                    error={form.formState.errors.unitId?.message}
                >
                    <Select id="po-unit" disabled={units.isPending} {...form.register("unitId")}>
                        <option value="">{units.isPending ? "Carregando..." : "Selecione..."}</option>
                        {units.data?.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.name}
                            </option>
                        ))}
                    </Select>
                </Field>

                <Field
                    label="Data esperada"
                    htmlFor="po-expected"
                    error={form.formState.errors.expectedAt?.message}
                >
                    <Input id="po-expected" type="date" {...form.register("expectedAt")} />
                </Field>

                <Field
                    label="Observações"
                    htmlFor="po-notes"
                    error={form.formState.errors.notes?.message}
                >
                    <Input id="po-notes" {...form.register("notes")} />
                </Field>
            </section>

            <section className="space-y-4 rounded-xl border border-border/40 bg-white p-5" data-testid="po-items">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-text-primary">Itens</h2>
                    {form.formState.errors.items?.message ? (
                        <span className="text-sm text-danger">{form.formState.errors.items.message}</span>
                    ) : null}
                </div>

                <div className="space-y-3">
                    {fields.map((f, i) => {
                        const qty = Number(watchedItems[i]?.quantity) || 0
                        const price = Number(watchedItems[i]?.unitPrice) || 0
                        const subtotal = qty * price
                        return (
                            <div
                                key={f.id}
                                data-testid="po-item-row"
                                className="grid grid-cols-[1fr_120px_140px_120px_auto] items-end gap-3"
                            >
                                <Field
                                    label="Ingrediente"
                                    htmlFor={`po-item-ing-${i}`}
                                    error={form.formState.errors.items?.[i]?.ingredientId?.message}
                                >
                                    <Select
                                        id={`po-item-ing-${i}`}
                                        disabled={ingredients.isPending}
                                        value={watchedItems[i]?.ingredientId ?? ""}
                                        onChange={(e) => onIngredientChange(i, e.target.value)}
                                    >
                                        <option value="">Selecione...</option>
                                        {ingredients.data?.map((ing) => (
                                            <option key={ing.id} value={ing.id}>
                                                {ing.name}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>
                                <Field
                                    label="Quantidade"
                                    htmlFor={`po-item-qty-${i}`}
                                    error={form.formState.errors.items?.[i]?.quantity?.message}
                                >
                                    <Input
                                        id={`po-item-qty-${i}`}
                                        type="number"
                                        step="0.001"
                                        min="0"
                                        {...form.register(`items.${i}.quantity`)}
                                    />
                                </Field>
                                <Field
                                    label="Preço unit."
                                    htmlFor={`po-item-price-${i}`}
                                    error={form.formState.errors.items?.[i]?.unitPrice?.message}
                                >
                                    <Input
                                        id={`po-item-price-${i}`}
                                        type="number"
                                        step="0.0001"
                                        min="0"
                                        {...form.register(`items.${i}.unitPrice`)}
                                    />
                                </Field>
                                <Field label="Subtotal" htmlFor={`po-item-sub-${i}`}>
                                    <Input
                                        id={`po-item-sub-${i}`}
                                        readOnly
                                        value={`R$ ${subtotal.toFixed(2)}`}
                                    />
                                </Field>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    aria-label="Remover item"
                                    disabled={fields.length === 1}
                                    onClick={() => remove(i)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        )
                    })}
                </div>

                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => append({ ingredientId: "", quantity: 0, unitPrice: 0 })}
                >
                    <Plus className="mr-2 h-4 w-4" /> Adicionar item
                </Button>

                <div className="flex justify-end border-t border-border/40 pt-3 text-sm font-medium">
                    Total: <span data-testid="po-total" className="ml-2">R$ {total.toFixed(2)}</span>
                </div>
            </section>

            <div className="flex justify-end gap-2">
                <Button
                    type="button"
                    variant="ghost"
                    disabled={submitting}
                    onClick={() =>
                        router.replace(
                            mode === "edit" && initial
                                ? `/purchase-orders/${initial.id}`
                                : "/purchase-orders"
                        )
                    }
                >
                    Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                    {submitting ? "Salvando..." : "Salvar"}
                </Button>
            </div>
        </form>
    )
}
```

- [ ] **Step 4: Rodar testes do form — devem passar**

```bash
cd frontend && npx vitest run tests/purchase-order-form.test.tsx
```

- [ ] **Step 5: Rodar suíte completa**

```bash
cd frontend && npx vitest run
```

- [ ] **Step 6: Commit**

```bash
git add frontend/app/\(protected\)/purchase-orders/purchase-order-form.tsx frontend/tests/purchase-order-form.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): shared PurchaseOrderForm with useFieldArray and live total

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: `/purchase-orders/nova` page

**Files:**
- Create: `frontend/app/(protected)/purchase-orders/nova/page.tsx`

**Why:** Rota dedicada de criação. Guard de role. Renderiza
`<PurchaseOrderForm mode="create" />`.

- [ ] **Step 1: Criar `frontend/app/(protected)/purchase-orders/nova/page.tsx`**

```tsx
"use client"

import { useAuth } from "@/lib/auth"
import Link from "next/link"
import { PurchaseOrderForm } from "../purchase-order-form"

export default function NewPurchaseOrderPage() {
    const { user } = useAuth()

    if (!user) return null
    if (user.role !== "OWNER") {
        return (
            <div className="rounded-xl border border-border/60 bg-white p-10 text-center">
                <p className="text-sm text-text-secondary">
                    Você não tem permissão para criar compras.
                </p>
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-3xl space-y-4">
            <nav className="text-sm text-text-secondary">
                <Link href="/purchase-orders" className="hover:underline">
                    Compras
                </Link>{" "}
                › <span className="text-text-primary">Nova</span>
            </nav>
            <h1 className="text-2xl font-semibold text-text-primary">Nova compra</h1>
            <PurchaseOrderForm mode="create" />
        </div>
    )
}
```

- [ ] **Step 2: Rodar suíte completa**

```bash
cd frontend && npx vitest run
```

- [ ] **Step 3: Commit**

```bash
git add frontend/app/\(protected\)/purchase-orders/nova
git commit -m "$(cat <<'EOF'
feat(frontend): /purchase-orders/nova route with OWNER guard

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: `/purchase-orders/[id]/editar` page

**Files:**
- Create: `frontend/app/(protected)/purchase-orders/[id]/editar/page.tsx`

**Why:** Rota dedicada de edição. Carrega a PO; bloqueia se não-PENDING ou
se EMPLOYEE.

- [ ] **Step 1: Criar `frontend/app/(protected)/purchase-orders/[id]/editar/page.tsx`**

```tsx
"use client"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import { usePurchaseOrder } from "@/lib/purchase-orders"
import Link from "next/link"
import { useParams } from "next/navigation"
import { PurchaseOrderForm } from "../../purchase-order-form"

export default function EditPurchaseOrderPage() {
    const params = useParams<{ id: string }>()
    const id = params?.id ?? ""
    const { user } = useAuth()
    const query = usePurchaseOrder(id)

    if (!user) return null
    if (user.role !== "OWNER") {
        return (
            <div className="rounded-xl border border-border/60 bg-white p-10 text-center">
                <p className="text-sm text-text-secondary">
                    Você não tem permissão para editar compras.
                </p>
            </div>
        )
    }

    if (query.isLoading) {
        return (
            <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-12 animate-pulse rounded-lg bg-text-primary/5" />
                ))}
            </div>
        )
    }
    if (query.isError) {
        return (
            <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
                <p className="text-sm text-danger">Não foi possível carregar a compra.</p>
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
                        Tentar novamente
                    </Button>
                    <Link href="/purchase-orders">
                        <Button variant="ghost" size="sm">
                            Voltar
                        </Button>
                    </Link>
                </div>
            </div>
        )
    }

    const po = query.data!
    if (po.status !== "PENDING") {
        return (
            <div className="rounded-xl border border-border/60 bg-white p-10 text-center">
                <p className="text-sm text-text-secondary">
                    Esta compra já está {po.status === "RECEIVED" ? "recebida" : "cancelada"} e não pode mais ser editada.
                </p>
                <Link href={`/purchase-orders/${po.id}`}>
                    <Button className="mt-4" variant="ghost">
                        Voltar para a compra
                    </Button>
                </Link>
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-3xl space-y-4">
            <nav className="text-sm text-text-secondary">
                <Link href="/purchase-orders" className="hover:underline">
                    Compras
                </Link>{" "}
                › <span className="text-text-primary">Editar #{po.id.slice(0, 8)}</span>
            </nav>
            <h1 className="text-2xl font-semibold text-text-primary">Editar compra</h1>
            <PurchaseOrderForm mode="edit" initial={po} />
        </div>
    )
}
```

- [ ] **Step 2: Rodar suíte completa**

```bash
cd frontend && npx vitest run
```

- [ ] **Step 3: Commit**

```bash
git add frontend/app/\(protected\)/purchase-orders/\[id\]/editar
git commit -m "$(cat <<'EOF'
feat(frontend): /purchase-orders/[id]/editar with status guard

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: `/purchase-orders` listagem + tests

**Files:**
- Create: `frontend/app/(protected)/purchase-orders/page.tsx`
- Create: `frontend/tests/purchase-orders-page.test.tsx`

**Why:** Listagem com filtros (status default=PENDING, supplier, unit,
from/to). Action "Editar" só renderiza se OWNER + PENDING.

- [ ] **Step 1: Criar `frontend/tests/purchase-orders-page.test.tsx` (failing)**

```tsx
import { screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/purchase-orders",
}))

import PurchaseOrdersPage from "@/app/(protected)/purchase-orders/page"
import { tokenStorage } from "@/lib/api"
import { renderWithProviders, resetMockApi, setHandler } from "./helpers"

beforeEach(() => {
    resetMockApi()
})

function meHandler(role: "OWNER" | "EMPLOYEE") {
    return {
        status: 200,
        data: {
            data: {
                id: "u1",
                name: "Ana",
                email: "a@x.com",
                role,
                active: true,
                createdAt: "2026-01-01T00:00:00Z",
            },
        },
    }
}

function listHandler(status: "PENDING" | "RECEIVED") {
    return {
        status: 200,
        data: {
            data: [
                {
                    id: "po1abcdef0000000000000000000000",
                    supplierId: "s1",
                    supplierName: "Distribuidora ABC",
                    unitId: "un1",
                    unitName: "Centro",
                    status,
                    totalCost: 100,
                    notes: null,
                    expectedAt: "2026-12-31",
                    receivedAt: null,
                    canceledAt: null,
                    createdById: "u1",
                    createdByName: "Ana",
                    createdAt: "2026-01-01T00:00:00Z",
                    items: [],
                },
            ],
            page: 0,
            size: 20,
            total: 1,
        },
    }
}

describe("PurchaseOrdersPage", () => {
    it("OWNER on PENDING sees Edit action", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("OWNER")
            if (url.includes("/suppliers"))
                return { status: 200, data: { data: [], page: 0, size: 1000, total: 0 } }
            if (url.includes("/units"))
                return { status: 200, data: { data: [], page: 0, size: 1000, total: 0 } }
            if (url.includes("/purchase-orders") && cfg.method === "get") return listHandler("PENDING")
            return { status: 500 }
        })
        renderWithProviders(<PurchaseOrdersPage />)
        await waitFor(() => expect(screen.getByText("Distribuidora ABC")).toBeInTheDocument())
        expect(screen.getByLabelText(/editar/i)).toBeInTheDocument()
    })

    it("EMPLOYEE on RECEIVED sees no actions", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("EMPLOYEE")
            if (url.includes("/suppliers"))
                return { status: 200, data: { data: [], page: 0, size: 1000, total: 0 } }
            if (url.includes("/units"))
                return { status: 200, data: { data: [], page: 0, size: 1000, total: 0 } }
            if (url.includes("/purchase-orders") && cfg.method === "get") return listHandler("RECEIVED")
            return { status: 500 }
        })
        renderWithProviders(<PurchaseOrdersPage />)
        await waitFor(() => expect(screen.getByText("Distribuidora ABC")).toBeInTheDocument())
        expect(screen.queryByRole("button", { name: /nova compra/i })).not.toBeInTheDocument()
        expect(screen.queryByLabelText(/editar/i)).not.toBeInTheDocument()
    })
})
```

- [ ] **Step 2: Rodar teste — deve falhar**

```bash
cd frontend && npx vitest run tests/purchase-orders-page.test.tsx
```

- [ ] **Step 3: Criar `frontend/app/(protected)/purchase-orders/page.tsx`**

```tsx
"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { useAuth } from "@/lib/auth"
import {
    PURCHASE_ORDER_STATUSES,
    usePurchaseOrders,
    type PurchaseOrderStatus,
} from "@/lib/purchase-orders"
import { useActiveSuppliers } from "@/lib/suppliers"
import { useAllUnits } from "@/lib/units"
import { Eye, Pencil, Plus } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

function statusLabel(s: PurchaseOrderStatus) {
    return s === "PENDING" ? "Pendente" : s === "RECEIVED" ? "Recebida" : "Cancelada"
}

function statusVariant(s: PurchaseOrderStatus) {
    return s === "PENDING" ? "warning" : s === "RECEIVED" ? "success" : "neutral"
}

function PurchaseOrdersPageInner() {
    const { user } = useAuth()
    const isOwner = user?.role === "OWNER"
    const router = useRouter()
    const searchParams = useSearchParams()

    const statusParamRaw = searchParams.get("status")
    // default = PENDING (only when nothing in URL)
    const statusParam: PurchaseOrderStatus | undefined =
        statusParamRaw === null
            ? "PENDING"
            : statusParamRaw === ""
              ? undefined
              : (statusParamRaw as PurchaseOrderStatus)
    const supplierParam = searchParams.get("supplier") ?? ""
    const unitParam = searchParams.get("unit") ?? ""
    const fromParam = searchParams.get("from") ?? ""
    const toParam = searchParams.get("to") ?? ""

    const [page, setPage] = useState(0)
    const size = 20

    const query = usePurchaseOrders({
        status: statusParam,
        supplier: supplierParam || undefined,
        unit: unitParam || undefined,
        from: fromParam || undefined,
        to: toParam || undefined,
        page,
        size,
    })

    const suppliers = useActiveSuppliers()
    const units = useAllUnits()

    function setFilter(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString())
        if (value === "") params.set(key, "")
        else params.set(key, value)
        setPage(0)
        router.replace(`/purchase-orders?${params.toString()}`)
    }

    const data = query.data
    const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1

    return (
        <div className="space-y-6">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-text-primary">Compras</h1>
                    <p className="mt-1 text-sm text-text-secondary">Ordens de compra a fornecedores.</p>
                </div>
                {isOwner ? (
                    <Link href="/purchase-orders/nova">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Nova compra
                        </Button>
                    </Link>
                ) : null}
            </header>

            <div className="flex flex-wrap items-end gap-3">
                <Field label="Status" htmlFor="filter-status">
                    <Select
                        id="filter-status"
                        value={statusParam ?? ""}
                        onChange={(e) => setFilter("status", e.target.value)}
                    >
                        <option value="">Todos</option>
                        {PURCHASE_ORDER_STATUSES.map((s) => (
                            <option key={s} value={s}>
                                {statusLabel(s)}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field label="Fornecedor" htmlFor="filter-supplier">
                    <Select
                        id="filter-supplier"
                        value={supplierParam}
                        onChange={(e) => setFilter("supplier", e.target.value)}
                    >
                        <option value="">Todos</option>
                        {suppliers.data?.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field label="Unidade" htmlFor="filter-unit">
                    <Select
                        id="filter-unit"
                        value={unitParam}
                        onChange={(e) => setFilter("unit", e.target.value)}
                    >
                        <option value="">Todas</option>
                        {units.data?.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.name}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field label="De" htmlFor="filter-from">
                    <Input
                        id="filter-from"
                        type="date"
                        value={fromParam}
                        onChange={(e) => setFilter("from", e.target.value)}
                    />
                </Field>
                <Field label="Até" htmlFor="filter-to">
                    <Input
                        id="filter-to"
                        type="date"
                        value={toParam}
                        onChange={(e) => setFilter("to", e.target.value)}
                    />
                </Field>
            </div>

            {query.isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-12 animate-pulse rounded-lg bg-text-primary/5" />
                    ))}
                </div>
            ) : query.isError ? (
                <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
                    <p className="text-sm text-danger">Falha ao carregar compras.</p>
                    <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
                        Tentar novamente
                    </Button>
                </div>
            ) : data && data.data.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                    <p className="text-sm text-text-secondary">Nenhuma compra encontrada.</p>
                    {isOwner ? (
                        <Link href="/purchase-orders/nova">
                            <Button className="mt-4">Criar primeira compra</Button>
                        </Link>
                    ) : null}
                </div>
            ) : (
                <Table>
                    <THead>
                        <TR>
                            <TH>Nº</TH>
                            <TH>Fornecedor</TH>
                            <TH>Unidade</TH>
                            <TH>Status</TH>
                            <TH>Esperada</TH>
                            <TH>Total</TH>
                            <TH>Criada</TH>
                            <TH className="w-px text-right">Ações</TH>
                        </TR>
                    </THead>
                    <TBody>
                        {data!.data.map((po) => (
                            <TR key={po.id}>
                                <TD className="font-mono">#{po.id.slice(0, 8)}</TD>
                                <TD>{po.supplierName}</TD>
                                <TD>{po.unitName}</TD>
                                <TD>
                                    <Badge variant={statusVariant(po.status)}>{statusLabel(po.status)}</Badge>
                                </TD>
                                <TD>{po.expectedAt ?? "—"}</TD>
                                <TD>R$ {po.totalCost.toFixed(2)}</TD>
                                <TD>{new Date(po.createdAt).toLocaleDateString("pt-BR")}</TD>
                                <TD className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Link
                                            href={`/purchase-orders/${po.id}`}
                                            className="rounded p-1.5 text-text-primary/70 hover:bg-text-primary/5 hover:text-text-primary"
                                            aria-label={`Ver compra #${po.id.slice(0, 8)}`}
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Link>
                                        {isOwner && po.status === "PENDING" ? (
                                            <Link
                                                href={`/purchase-orders/${po.id}/editar`}
                                                className="rounded p-1.5 text-text-primary/70 hover:bg-text-primary/5 hover:text-text-primary"
                                                aria-label={`Editar compra #${po.id.slice(0, 8)}`}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Link>
                                        ) : null}
                                    </div>
                                </TD>
                            </TR>
                        ))}
                    </TBody>
                </Table>
            )}

            {data && data.total > size ? (
                <div className="flex items-center justify-between text-sm text-text-secondary">
                    <span>
                        Página {page + 1} de {totalPages} · {size} por página
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            disabled={page === 0}
                        >
                            Anterior
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPage((p) => p + 1)}
                            disabled={page + 1 >= totalPages}
                        >
                            Próximo
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    )
}

export default function PurchaseOrdersPage() {
    return (
        <Suspense fallback={null}>
            <PurchaseOrdersPageInner />
        </Suspense>
    )
}
```

- [ ] **Step 4: Rodar testes — devem passar**

```bash
cd frontend && npx vitest run tests/purchase-orders-page.test.tsx
```

- [ ] **Step 5: Rodar suíte completa**

```bash
cd frontend && npx vitest run
```

- [ ] **Step 6: Commit**

```bash
git add frontend/app/\(protected\)/purchase-orders/page.tsx frontend/tests/purchase-orders-page.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): /purchase-orders listing with status filter and conditional actions

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: `/purchase-orders/[id]` detalhe + ações + tests

**Files:**
- Create: `frontend/app/(protected)/purchase-orders/[id]/page.tsx`
- Create: `frontend/tests/purchase-order-detail-page.test.tsx`

**Why:** Página de detalhe com ações condicionais (receive/cancel) por
ConfirmDialog. PO em PENDING + OWNER vê tudo; outros estados/roles só
visualizam.

- [ ] **Step 1: Criar `frontend/tests/purchase-order-detail-page.test.tsx` (failing)**

```tsx
import { fireEvent, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/purchase-orders/po1",
    useParams: () => ({ id: "po1" }),
}))

import PurchaseOrderDetailPage from "@/app/(protected)/purchase-orders/[id]/page"
import { tokenStorage } from "@/lib/api"
import { renderWithProviders, getCalls, resetMockApi, setHandler } from "./helpers"

beforeEach(() => {
    resetMockApi()
})

function meHandler(role: "OWNER" | "EMPLOYEE") {
    return {
        status: 200,
        data: {
            data: {
                id: "u1",
                name: "Ana",
                email: "a@x.com",
                role,
                active: true,
                createdAt: "2026-01-01T00:00:00Z",
            },
        },
    }
}

function poHandler(status: "PENDING" | "RECEIVED" | "CANCELED") {
    return {
        status: 200,
        data: {
            data: {
                id: "po1abcdef0000000000000000000000",
                supplierId: "s1",
                supplierName: "Distribuidora ABC",
                unitId: "un1",
                unitName: "Centro",
                status,
                totalCost: 100,
                notes: null,
                expectedAt: null,
                receivedAt: null,
                canceledAt: null,
                createdById: "u1",
                createdByName: "Ana",
                createdAt: "2026-01-01T00:00:00Z",
                items: [
                    {
                        id: "it1",
                        ingredientId: "ing1",
                        ingredientName: "Mussarela",
                        quantity: 5,
                        unitPrice: 20,
                    },
                ],
            },
        },
    }
}

describe("PurchaseOrderDetailPage", () => {
    it("OWNER + PENDING shows Receive and Cancel; clicking Receive triggers POST", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("OWNER")
            if (url.includes("/purchase-orders/po1/receive") && cfg.method === "post") {
                return { status: 200, data: { data: poHandler("RECEIVED").data.data } }
            }
            if (url.includes("/purchase-orders/po1") && cfg.method === "get") {
                return poHandler("PENDING")
            }
            return { status: 500 }
        })
        renderWithProviders(<PurchaseOrderDetailPage />)
        await waitFor(() => expect(screen.getByText("Distribuidora ABC")).toBeInTheDocument())
        const receiveBtn = screen.getByRole("button", { name: /receber/i })
        const cancelBtn = screen.getByRole("button", { name: /cancelar/i })
        expect(receiveBtn).toBeInTheDocument()
        expect(cancelBtn).toBeInTheDocument()

        fireEvent.click(receiveBtn)
        // confirm dialog
        await waitFor(() => expect(screen.getByText(/recebimento/i)).toBeInTheDocument())
        // click confirm in dialog (label = "Receber" inside dialog)
        const dialogConfirm = screen.getAllByRole("button", { name: /receber/i }).pop()!
        fireEvent.click(dialogConfirm)

        await waitFor(() => {
            const post = getCalls().find(
                (c) => c.method === "post" && c.url?.includes("/purchase-orders/po1/receive")
            )
            expect(post).toBeTruthy()
        })
    })

    it("RECEIVED PO shows no actions", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("OWNER")
            if (url.includes("/purchase-orders/po1") && cfg.method === "get") return poHandler("RECEIVED")
            return { status: 500 }
        })
        renderWithProviders(<PurchaseOrderDetailPage />)
        await waitFor(() => expect(screen.getByText("Distribuidora ABC")).toBeInTheDocument())
        expect(screen.queryByRole("button", { name: /^receber$/i })).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /^cancelar$/i })).not.toBeInTheDocument()
    })

    it("EMPLOYEE on PENDING sees no actions", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("EMPLOYEE")
            if (url.includes("/purchase-orders/po1") && cfg.method === "get") return poHandler("PENDING")
            return { status: 500 }
        })
        renderWithProviders(<PurchaseOrderDetailPage />)
        await waitFor(() => expect(screen.getByText("Distribuidora ABC")).toBeInTheDocument())
        expect(screen.queryByRole("button", { name: /^receber$/i })).not.toBeInTheDocument()
    })
})
```

- [ ] **Step 2: Rodar teste — deve falhar**

```bash
cd frontend && npx vitest run tests/purchase-order-detail-page.test.tsx
```

- [ ] **Step 3: Criar `frontend/app/(protected)/purchase-orders/[id]/page.tsx`**

```tsx
"use client"

import { ConfirmDialog } from "@/components/overlays/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { isApiError, useAuth } from "@/lib/auth"
import {
    useCancelPurchaseOrder,
    usePurchaseOrder,
    useReceivePurchaseOrder,
    type PurchaseOrderStatus,
} from "@/lib/purchase-orders"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

function statusLabel(s: PurchaseOrderStatus) {
    return s === "PENDING" ? "Pendente" : s === "RECEIVED" ? "Recebida" : "Cancelada"
}

function statusVariant(s: PurchaseOrderStatus) {
    return s === "PENDING" ? "warning" : s === "RECEIVED" ? "success" : "neutral"
}

export default function PurchaseOrderDetailPage() {
    const params = useParams<{ id: string }>()
    const id = params?.id ?? ""
    const { user } = useAuth()
    const isOwner = user?.role === "OWNER"

    const query = usePurchaseOrder(id)
    const receive = useReceivePurchaseOrder()
    const cancel = useCancelPurchaseOrder()

    const [action, setAction] = useState<"receive" | "cancel" | null>(null)

    if (query.isLoading) {
        return (
            <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded-lg bg-text-primary/5" />
                ))}
            </div>
        )
    }
    if (query.isError) {
        return (
            <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
                <p className="text-sm text-danger">Não foi possível carregar a compra.</p>
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
                        Tentar novamente
                    </Button>
                    <Link href="/purchase-orders">
                        <Button variant="ghost" size="sm">
                            Voltar
                        </Button>
                    </Link>
                </div>
            </div>
        )
    }

    const po = query.data!
    const canAct = isOwner && po.status === "PENDING"

    async function onConfirmReceive() {
        try {
            await receive.mutateAsync(po.id)
            toast.success("Compra recebida")
            setAction(null)
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao receber compra")
        }
    }

    async function onConfirmCancel() {
        try {
            await cancel.mutateAsync(po.id)
            toast.success("Compra cancelada")
            setAction(null)
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao cancelar compra")
        }
    }

    return (
        <div className="space-y-6">
            <nav className="text-sm text-text-secondary">
                <Link href="/purchase-orders" className="hover:underline">
                    Compras
                </Link>{" "}
                › <span className="text-text-primary">#{po.id.slice(0, 8)}</span>
            </nav>

            <header className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-semibold text-text-primary">Compra #{po.id.slice(0, 8)}</h1>
                    <Badge variant={statusVariant(po.status)}>{statusLabel(po.status)}</Badge>
                </div>
                {canAct ? (
                    <div className="flex gap-2">
                        <Link href={`/purchase-orders/${po.id}/editar`}>
                            <Button variant="ghost">Editar</Button>
                        </Link>
                        <Button onClick={() => setAction("receive")}>Receber</Button>
                        <Button variant="ghost" onClick={() => setAction("cancel")}>
                            Cancelar
                        </Button>
                    </div>
                ) : null}
            </header>

            <section className="grid gap-3 rounded-xl border border-border/40 bg-white p-5 sm:grid-cols-2">
                <div>
                    <p className="text-xs text-text-secondary">Fornecedor</p>
                    <p className="text-sm text-text-primary">{po.supplierName}</p>
                </div>
                <div>
                    <p className="text-xs text-text-secondary">Unidade</p>
                    <p className="text-sm text-text-primary">{po.unitName}</p>
                </div>
                <div>
                    <p className="text-xs text-text-secondary">Esperada</p>
                    <p className="text-sm text-text-primary">{po.expectedAt ?? "—"}</p>
                </div>
                <div>
                    <p className="text-xs text-text-secondary">Criada</p>
                    <p className="text-sm text-text-primary">
                        {new Date(po.createdAt).toLocaleString("pt-BR")} por {po.createdByName}
                    </p>
                </div>
                {po.receivedAt ? (
                    <div>
                        <p className="text-xs text-text-secondary">Recebida em</p>
                        <p className="text-sm text-text-primary">
                            {new Date(po.receivedAt).toLocaleString("pt-BR")}
                        </p>
                    </div>
                ) : null}
                {po.canceledAt ? (
                    <div>
                        <p className="text-xs text-text-secondary">Cancelada em</p>
                        <p className="text-sm text-text-primary">
                            {new Date(po.canceledAt).toLocaleString("pt-BR")}
                        </p>
                    </div>
                ) : null}
                {po.notes ? (
                    <div className="sm:col-span-2">
                        <p className="text-xs text-text-secondary">Observações</p>
                        <p className="text-sm text-text-primary">{po.notes}</p>
                    </div>
                ) : null}
            </section>

            <section className="space-y-3 rounded-xl border border-border/40 bg-white p-5">
                <h2 className="text-base font-semibold text-text-primary">Itens</h2>
                <Table>
                    <THead>
                        <TR>
                            <TH>Ingrediente</TH>
                            <TH>Quantidade</TH>
                            <TH>Preço unit.</TH>
                            <TH>Subtotal</TH>
                        </TR>
                    </THead>
                    <TBody>
                        {po.items.map((it) => (
                            <TR key={it.id}>
                                <TD>{it.ingredientName}</TD>
                                <TD>{it.quantity}</TD>
                                <TD>R$ {it.unitPrice.toFixed(4)}</TD>
                                <TD>R$ {(it.quantity * it.unitPrice).toFixed(2)}</TD>
                            </TR>
                        ))}
                    </TBody>
                </Table>
                <div className="flex justify-end border-t border-border/40 pt-3 text-sm font-medium">
                    Total: <span className="ml-2">R$ {po.totalCost.toFixed(2)}</span>
                </div>
            </section>

            <ConfirmDialog
                open={action === "receive"}
                onClose={() => setAction(null)}
                onConfirm={onConfirmReceive}
                title="Confirmar recebimento"
                message="Esta ação adiciona os itens ao estoque, atualiza o custo médio dos ingredientes e não pode ser desfeita."
                confirmLabel="Receber"
                confirmVariant="primary"
                loading={receive.isPending}
            />

            <ConfirmDialog
                open={action === "cancel"}
                onClose={() => setAction(null)}
                onConfirm={onConfirmCancel}
                title="Cancelar compra"
                message="Esta ação não pode ser desfeita."
                confirmLabel="Cancelar"
                confirmVariant="danger"
                loading={cancel.isPending}
            />
        </div>
    )
}
```

> **Nota:** `<ConfirmDialog>` (`components/overlays/confirm-dialog.tsx`)
> aceita `confirmVariant: "primary" | "danger"` e default é `"danger"`.
> No "Receber" passar `confirmVariant="primary"` para sair do vermelho;
> no "Cancelar" o default já vermelho serve.

- [ ] **Step 4: Rodar testes — devem passar**

```bash
cd frontend && npx vitest run tests/purchase-order-detail-page.test.tsx
```

- [ ] **Step 5: Rodar suíte completa**

```bash
cd frontend && npx vitest run
```

- [ ] **Step 6: Commit**

```bash
git add frontend/app/\(protected\)/purchase-orders/\[id\]/page.tsx frontend/tests/purchase-order-detail-page.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): /purchase-orders/[id] detail with receive/cancel actions

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Sanity final — full test suite + build

**Files:** nenhum.

**Why:** Garantia final de que tudo passa antes de abrir PR.

- [ ] **Step 1: Rodar suíte completa**

```bash
cd frontend && npx vitest run
```

Expected: todos os testes passam (incluindo os de SP1 — não-regressão).

- [ ] **Step 2: Rodar build de produção**

```bash
cd frontend && npm run build
```

Expected: build passa sem warnings novos.

- [ ] **Step 3: Sanity manual rápido (opcional, mas recomendado)**

Subir o backend (`cd backend && ./mvnw spring-boot:run`) e o front
(`cd frontend && npm run dev`), logar como OWNER, e:
1. Abrir `/stock` — vê tabela.
2. Abrir `/stock-movements`, criar um ajuste, ver na lista.
3. Abrir `/stock` — saldo refletiu o ajuste.
4. Abrir `/purchase-orders`, criar uma PO com 2 items.
5. Abrir o detalhe, clicar "Receber", confirmar.
6. Voltar a `/stock` — saldo aumentou; `/stock-movements` tem 2 entries com
   link pra essa PO.
7. Logar como EMPLOYEE — botões mutativos somem; rotas dedicadas viram
   "sem permissão".

Esta validação manual é o equivalente prático ao "test plan" da PR.

---

## Critérios de pronto (espelho do spec)

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
