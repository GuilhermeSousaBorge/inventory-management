# SP3 Frontend — Products + Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar frontend completo do SP3 — cardápio com fichas técnicas (`/products`) e pedidos de cliente com state machine PENDING → IN_PROGRESS → COMPLETED ou PENDING → CANCELED (`/orders`), incluindo a ação `start` que dispara baixa automática de estoque.

**Architecture:** Espelhar 1:1 os padrões já estabelecidos no SP1/SP2 frontend. Ambos módulos usam rotas dedicadas (`/nova`, `/[id]/editar`, `/[id]`) por causa do `useFieldArray` (ficha técnica para products, items para orders). Ordem de execução: products primeiro (orders depende de `useAllProducts` para o select de produto no order-form).

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, axios, TanStack Query v5, react-hook-form, zod (`@hookform/resolvers/zod`), sonner, Tailwind v4, lucide-react. Testes: Vitest + jsdom + @testing-library/react.

**Reference spec:** `frontend/docs/superpowers/specs/2026-05-06-sp3-frontend-products-orders-design.md`

---

## Reconciliação spec ↔ código atual

A spec menciona alguns deltas que **já estão prontos** no código:

- **`useAllCategories` em `lib/categories.ts`** — já existe (linhas 32-41 de `lib/categories.ts`). Não precisa estender.
- **Sidebar com entradas `/products` e `/orders`** — `app/(protected)/layout.tsx` já tem os 2 links em "Catálogo" (Produtos) e "Vendas" (Pedidos). Não precisa adicionar; só precisa garantir que os hrefs apontam para rotas que existem ao final do plano.

---

## Convenções importantes do projeto (ler antes de começar)

1. **Diretório de trabalho:** todos os comandos rodam a partir de `frontend/`.

2. **Localização de testes:** `frontend/tests/` flat — não há subpastas `tests/lib/...` ou `tests/app/...`. Glob: `tests/**/*.test.{ts,tsx}`.
   - Schemas zod: extender `tests/schemas.test.ts` (não criar arquivos novos).
   - Hooks/API com mock do axios: extender `tests/api.test.ts` ou criar `tests/<recurso>-hooks.test.ts` se ficar grande.
   - Testes de página: criar `tests/<recurso>-page.test.tsx`.
   - Testes de form compartilhado: criar `tests/<recurso>-form.test.tsx`.

3. **Helpers de teste** (`frontend/tests/helpers.tsx`):
   - `setHandler(fn)` — define mock de resposta HTTP.
   - `getCalls()` — array de requests interceptadas.
   - `resetMockApi()` — reseta handler/calls/localStorage e instala adapter.
   - `renderWithProviders(ui)` — render com `QueryClientProvider` + `AuthProvider`.

4. **Mock do `next/navigation`** em testes de página/form:
   ```ts
   vi.mock("next/navigation", () => ({
       useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
       useSearchParams: () => new URLSearchParams(),
       usePathname: () => "/products",
       useParams: () => ({}),
   }))
   ```
   Variar `usePathname` / `useParams` por arquivo de teste.

5. **Envelope de resposta:** o interceptor do axios desembrulha `{ data: x }` → `x` para single-resource; mantém `{ data, page, size, total }` intacto para listas paginadas. Mocks devem retornar com `data` interno conforme o caso.

6. **Mensagens de erro em pt** nos zod schemas: `z.string().min(1, "Informe o nome")`.

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

11. **`Page<T>`** vem de `@/lib/users`: `{ data: T[]; page: number; size: number; total: number }`.

12. **`<NoAccess />`** — verificar como `app/(protected)/ingredients/[id]/editar/page.tsx` usa hoje (`if (user.role !== 'OWNER') return <NoAccess />`) e replicar.

13. **Backend pagination params:**
    - `/products` usa `?page=&pageSize=` (atenção: difere de outros módulos).
    - `/orders` usa `?page=&size=` (mesmo padrão de SP1/SP2).
    O hook frontend deve enviar o nome correto para cada módulo.

14. **Conflito de nome `size` em products:** o backend recebe `?size={P|M|G|GG}` para o filtro de tamanho do produto e `?pageSize={int}` para paginação. No hook, `filters.size` mapeia para o enum, e `filters.pageSize` para a paginação.

15. **Commits:** padrão `feat(frontend): ...`, `test(frontend): ...`, `docs(sp3): ...`. Co-author do Claude no rodapé:
    ```
    Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
    ```

16. **Branch:** `feat/sp3-frontend-products-orders` (já criada).

---

## Estrutura de arquivos (resultado final)

```
frontend/
├─ lib/
│  ├─ products.ts                                       [NOVO]
│  └─ orders.ts                                         [NOVO]
├─ app/(protected)/
│  ├─ products/
│  │  ├─ page.tsx                                       [NOVO]
│  │  ├─ product-form.tsx                               [NOVO]
│  │  ├─ nova/page.tsx                                  [NOVO]
│  │  ├─ [id]/page.tsx                                  [NOVO]
│  │  └─ [id]/editar/page.tsx                           [NOVO]
│  └─ orders/
│     ├─ page.tsx                                       [NOVO]
│     ├─ order-form.tsx                                 [NOVO]
│     ├─ novo/page.tsx                                  [NOVO]
│     ├─ [id]/page.tsx                                  [NOVO]
│     └─ [id]/editar/page.tsx                           [NOVO]
└─ tests/
   ├─ schemas.test.ts                                   [MODIFICAR — adicionar describes para products + orders]
   ├─ products-page.test.tsx                            [NOVO]
   ├─ product-form.test.tsx                             [NOVO]
   ├─ product-detail-page.test.tsx                      [NOVO]
   ├─ orders-page.test.tsx                              [NOVO]
   ├─ order-form.test.tsx                               [NOVO]
   └─ order-detail-page.test.tsx                        [NOVO]
```

---

## Ordem de execução

```
1.  lib/products.ts (types + schema + hooks) + schemas tests
2.  product-form.tsx (componente compartilhado) + form tests
3.  /products/nova page (consome form)
4.  /products/[id]/editar page (consome form)
5.  /products listagem page + tests
6.  /products/[id] detalhe page + tests
7.  lib/orders.ts (types + schema + hooks) + schemas tests
8.  order-form.tsx (componente compartilhado) + form tests
9.  /orders/novo page (consome form)
10. /orders/[id]/editar page (consome form)
11. /orders listagem page + tests
12. /orders/[id] detalhe page + tests
13. Sanity final: full test run + build
```

A ordem garante que cada task tem dependências já implementadas. Products vem primeiro porque o `order-form` precisa de `useAllProducts` (definido em `lib/products.ts`).

---

## Task 1: `lib/products.ts` — types + zod + hooks

**Files:**
- Create: `frontend/lib/products.ts`
- Modify: `frontend/tests/schemas.test.ts` (adicionar describe block)

**Why:** Camada de dados de products. Inclui `useAllProducts` (não paginado) que será consumido pelo `order-form` na próxima fase.

- [ ] **Step 1: Criar `frontend/lib/products.ts`**

```ts
import { api } from "@/lib/api"
import type { Page } from "@/lib/users"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

export const PRODUCT_SIZES = ["P", "M", "G", "GG"] as const
export type ProductSize = (typeof PRODUCT_SIZES)[number]

export type ProductIngredient = {
    id: string
    ingredientId: string
    ingredientName: string
    quantity: number
    unitOfMeasure: string
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
    ingredients: ProductIngredient[]
}

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export const productIngredientSchema = z.object({
    ingredientId: z.string().regex(UUID_REGEX, "Selecione um ingrediente"),
    quantity: z.coerce.number().positive("Quantidade > 0"),
})
export type ProductIngredientInput = z.infer<typeof productIngredientSchema>

export const createProductSchema = z.object({
    name: z.string().trim().min(1, "Informe o nome").max(150),
    size: z.enum(PRODUCT_SIZES),
    categoryId: z.union([z.string().regex(UUID_REGEX, "Categoria inválida"), z.literal("")]).optional(),
    price: z.coerce.number().positive("Preço > 0"),
    description: z.string().max(255).optional().or(z.literal("")),
    ingredients: z
        .array(productIngredientSchema)
        .min(1, "Adicione ao menos 1 ingrediente")
        .refine(
            (arr) => new Set(arr.map((i) => i.ingredientId)).size === arr.length,
            "Ingredientes duplicados não são permitidos"
        ),
})
export type CreateProductInput = z.infer<typeof createProductSchema>

export const updateProductSchema = createProductSchema
export type UpdateProductInput = z.infer<typeof updateProductSchema>

export type ProductFilters = {
    category?: string
    size?: ProductSize
    active?: boolean
    page?: number
    pageSize?: number
}

export function useProducts(filters: ProductFilters = {}) {
    const page = filters.page ?? 0
    const pageSize = filters.pageSize ?? 20
    const params: Record<string, string | number | boolean> = { page, pageSize }
    if (filters.category) params.category = filters.category
    if (filters.size) params.size = filters.size
    if (filters.active !== undefined) params.active = filters.active
    return useQuery({
        queryKey: [
            "products",
            {
                category: filters.category ?? null,
                size: filters.size ?? null,
                active: filters.active ?? null,
                page,
                pageSize,
            },
        ],
        queryFn: () => api.get<Page<Product>>("/products", { params }).then((r) => r.data),
    })
}

export function useProduct(id: string) {
    return useQuery({
        queryKey: ["products", id],
        queryFn: () => api.get<Product>(`/products/${id}`).then((r) => r.data),
        enabled: !!id,
    })
}

export function useAllProducts() {
    return useQuery({
        queryKey: ["products", "all-active"],
        queryFn: () =>
            api
                .get<Page<Product>>("/products", { params: { page: 0, pageSize: 1000, active: true } })
                .then((r) => r.data.data),
        staleTime: 5 * 60 * 1000,
    })
}

function normalizePayload(input: CreateProductInput | UpdateProductInput) {
    return {
        ...input,
        categoryId: input.categoryId === "" ? null : input.categoryId,
        description: input.description === "" ? null : input.description,
    }
}

export function useCreateProduct() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (input: CreateProductInput) =>
            api.post<Product>("/products", normalizePayload(input)).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
    })
}

export function useUpdateProduct() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: UpdateProductInput }) =>
            api.put<Product>(`/products/${id}`, normalizePayload(input)).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
    })
}

export function useDeactivateProduct() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => api.delete(`/products/${id}`).then(() => undefined),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
    })
}
```

- [ ] **Step 2: Estender `frontend/tests/schemas.test.ts` com describe `createProductSchema`**

Localizar o último `describe(...)` no arquivo. Logo após o fechamento, adicionar:

```ts
describe("createProductSchema", () => {
    const VALID_UUID = "11111111-1111-1111-1111-111111111111"
    const VALID_UUID_2 = "22222222-2222-2222-2222-222222222222"

    function baseInput() {
        return {
            name: "Margherita",
            size: "G" as const,
            categoryId: VALID_UUID,
            price: 45.9,
            description: "Molho de tomate",
            ingredients: [{ ingredientId: VALID_UUID, quantity: 0.3 }],
        }
    }

    it("accepts a valid product with one ingredient", () => {
        const result = createProductSchema.safeParse(baseInput())
        expect(result.success).toBe(true)
    })

    it("rejects empty ingredients array", () => {
        const result = createProductSchema.safeParse({ ...baseInput(), ingredients: [] })
        expect(result.success).toBe(false)
    })

    it("rejects duplicated ingredient ids", () => {
        const result = createProductSchema.safeParse({
            ...baseInput(),
            ingredients: [
                { ingredientId: VALID_UUID, quantity: 0.3 },
                { ingredientId: VALID_UUID, quantity: 0.2 },
            ],
        })
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues.some((i) => /duplicad/i.test(i.message))).toBe(true)
        }
    })

    it("accepts two distinct ingredients", () => {
        const result = createProductSchema.safeParse({
            ...baseInput(),
            ingredients: [
                { ingredientId: VALID_UUID, quantity: 0.3 },
                { ingredientId: VALID_UUID_2, quantity: 0.2 },
            ],
        })
        expect(result.success).toBe(true)
    })

    it("rejects empty name", () => {
        const result = createProductSchema.safeParse({ ...baseInput(), name: "" })
        expect(result.success).toBe(false)
    })

    it("rejects price <= 0", () => {
        const result = createProductSchema.safeParse({ ...baseInput(), price: 0 })
        expect(result.success).toBe(false)
    })

    it("rejects size outside enum", () => {
        const result = createProductSchema.safeParse({ ...baseInput(), size: "XL" as never })
        expect(result.success).toBe(false)
    })

    it("rejects description above 255 chars", () => {
        const result = createProductSchema.safeParse({
            ...baseInput(),
            description: "x".repeat(256),
        })
        expect(result.success).toBe(false)
    })

    it("accepts empty categoryId (optional)", () => {
        const result = createProductSchema.safeParse({ ...baseInput(), categoryId: "" })
        expect(result.success).toBe(true)
    })

    it("rejects ingredient quantity <= 0", () => {
        const result = createProductSchema.safeParse({
            ...baseInput(),
            ingredients: [{ ingredientId: VALID_UUID, quantity: 0 }],
        })
        expect(result.success).toBe(false)
    })
})
```

Garantir que o import de `createProductSchema` está no topo do arquivo (junto com os outros): `import { createProductSchema } from "@/lib/products"`.

- [ ] **Step 3: Rodar a suíte completa**

```bash
cd frontend && npx vitest run
```

Expected: todos os tests passam (existentes + 10 novos do products schema).

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/products.ts frontend/tests/schemas.test.ts
git commit -m "$(cat <<'EOF'
feat(frontend): products types, schemas and TanStack hooks

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `product-form.tsx` — componente compartilhado + tests

**Files:**
- Create: `frontend/app/(protected)/products/product-form.tsx`
- Create: `frontend/tests/product-form.test.tsx`

**Why:** Form compartilhado entre `/products/nova` e `/products/[id]/editar`. Usa `useFieldArray` para a ficha técnica. Display de unidade de medida (read-only) é resolvido pelo ingrediente selecionado.

**Reference pattern:** `frontend/app/(protected)/purchase-orders/purchase-order-form.tsx` (estrutura idêntica de RHF + zodResolver + useFieldArray).

- [ ] **Step 1: Criar `frontend/app/(protected)/products/product-form.tsx`**

```tsx
"use client"

import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useAllCategories } from "@/lib/categories"
import { useAllIngredients } from "@/lib/ingredients"
import {
    PRODUCT_SIZES,
    createProductSchema,
    type CreateProductInput,
    type ProductSize,
} from "@/lib/products"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useFieldArray, useForm } from "react-hook-form"

export type ProductFormProps = {
    mode: "create" | "edit"
    defaultValues?: CreateProductInput
    onSubmit: (input: CreateProductInput) => Promise<void>
    backHref: string
    title: string
}

const EMPTY_INGREDIENT = { ingredientId: "", quantity: 0 }

const DEFAULT_VALUES: CreateProductInput = {
    name: "",
    size: "G" as ProductSize,
    categoryId: "",
    price: 0,
    description: "",
    ingredients: [EMPTY_INGREDIENT],
}

export function ProductForm({ mode, defaultValues, onSubmit, backHref, title }: ProductFormProps) {
    const router = useRouter()
    const ingredientsQuery = useAllIngredients()
    const categoriesQuery = useAllCategories()

    const form = useForm<CreateProductInput>({
        resolver: zodResolver(createProductSchema) as never,
        defaultValues: defaultValues ?? DEFAULT_VALUES,
    })

    const { register, control, handleSubmit, watch, formState } = form
    const { fields, append, remove } = useFieldArray({ control, name: "ingredients" })
    const watchedIngredients = watch("ingredients")

    function ingredientUnit(ingredientId: string): string {
        const ing = ingredientsQuery.data?.find((i) => i.id === ingredientId)
        return ing?.unitOfMeasure ?? "—"
    }

    async function onValid(input: CreateProductInput) {
        await onSubmit(input)
    }

    return (
        <form
            onSubmit={handleSubmit(onValid)}
            className="mx-auto max-w-3xl space-y-6 rounded-lg border border-border/40 bg-white p-6"
        >
            <div className="space-y-1">
                <p className="text-xs text-text-secondary">Produtos › {title}</p>
                <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
            </div>

            <section className="space-y-4">
                <h2 className="text-sm font-medium text-text-primary">Dados do produto</h2>

                <Field label="Nome" error={formState.errors.name?.message}>
                    <Input {...register("name")} />
                </Field>

                <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Tamanho" error={formState.errors.size?.message}>
                        <select
                            {...register("size")}
                            className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                        >
                            {PRODUCT_SIZES.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>
                    </Field>

                    <Field
                        label="Categoria"
                        error={formState.errors.categoryId?.message}
                        helperText="Opcional"
                    >
                        <select
                            {...register("categoryId")}
                            className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                            disabled={categoriesQuery.isLoading}
                        >
                            <option value="">Sem categoria</option>
                            {(categoriesQuery.data ?? []).map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </Field>
                </div>

                <Field label="Preço (R$)" error={formState.errors.price?.message}>
                    <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        {...register("price", { valueAsNumber: true })}
                    />
                </Field>

                <Field
                    label="Descrição"
                    error={formState.errors.description?.message}
                    helperText="Opcional · até 255 caracteres"
                >
                    <textarea
                        {...register("description")}
                        rows={2}
                        className="w-full resize-y rounded-md border border-border bg-white px-3 py-2 text-sm"
                    />
                </Field>
            </section>

            <section className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-medium text-text-primary">Ficha técnica</h2>
                    <span className="text-xs text-text-secondary">{fields.length} ingrediente(s)</span>
                </div>

                {formState.errors.ingredients?.root?.message ? (
                    <p className="text-sm text-danger">
                        {formState.errors.ingredients.root.message}
                    </p>
                ) : null}
                {formState.errors.ingredients?.message ? (
                    <p className="text-sm text-danger">{formState.errors.ingredients.message}</p>
                ) : null}

                <div className="overflow-x-auto rounded-md border border-border/40">
                    <table className="w-full text-sm">
                        <thead className="bg-text-primary/5 text-text-secondary">
                            <tr>
                                <th className="px-3 py-2 text-left font-medium">Ingrediente</th>
                                <th className="w-32 px-3 py-2 text-left font-medium">Qtd</th>
                                <th className="w-24 px-3 py-2 text-left font-medium">Un.</th>
                                <th className="w-12 px-3 py-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {fields.map((field, idx) => {
                                const errorIngredient =
                                    formState.errors.ingredients?.[idx]?.ingredientId?.message
                                const errorQty =
                                    formState.errors.ingredients?.[idx]?.quantity?.message
                                const watchedId = watchedIngredients?.[idx]?.ingredientId ?? ""
                                return (
                                    <tr key={field.id} className="border-t border-border/40">
                                        <td className="px-3 py-2">
                                            <select
                                                {...register(`ingredients.${idx}.ingredientId` as const)}
                                                className="h-9 w-full rounded-md border border-border bg-white px-2 text-sm"
                                                disabled={ingredientsQuery.isLoading}
                                            >
                                                <option value="">Selecione...</option>
                                                {(ingredientsQuery.data ?? []).map((i) => (
                                                    <option key={i.id} value={i.id}>
                                                        {i.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {errorIngredient ? (
                                                <p className="mt-1 text-xs text-danger">{errorIngredient}</p>
                                            ) : null}
                                        </td>
                                        <td className="px-3 py-2">
                                            <Input
                                                type="number"
                                                step="0.001"
                                                min="0.001"
                                                {...register(`ingredients.${idx}.quantity` as const, {
                                                    valueAsNumber: true,
                                                })}
                                            />
                                            {errorQty ? (
                                                <p className="mt-1 text-xs text-danger">{errorQty}</p>
                                            ) : null}
                                        </td>
                                        <td className="px-3 py-2 text-text-secondary">
                                            {ingredientUnit(watchedId)}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            <button
                                                type="button"
                                                onClick={() => remove(idx)}
                                                disabled={fields.length === 1}
                                                className="rounded p-1 text-text-secondary hover:bg-danger/10 hover:text-danger disabled:opacity-40"
                                                aria-label="Remover ingrediente"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => append(EMPTY_INGREDIENT)}
                >
                    + Adicionar ingrediente
                </Button>
            </section>

            <div className="flex items-center justify-end gap-3 border-t border-border/40 pt-4">
                <Button type="button" variant="ghost" onClick={() => router.push(backHref)}>
                    Cancelar
                </Button>
                <Button type="submit" disabled={formState.isSubmitting}>
                    {mode === "create" ? "Criar produto" : "Salvar alterações"}
                </Button>
            </div>
        </form>
    )
}
```

> **Nota sobre `Field`:** se a API atual de `Field` não tiver `helperText`, omitir essa prop. Verificar `frontend/components/ui/field.tsx` antes de salvar.

> **Nota sobre `zodResolver` cast:** o cast `as never` é mesmo padrão usado em `purchase-order-form.tsx` (commit `c07c862` explica). Mantém consistência.

- [ ] **Step 2: Criar `frontend/tests/product-form.test.tsx`**

```tsx
import { fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/products/nova",
    useParams: () => ({}),
}))

import { ProductForm } from "@/app/(protected)/products/product-form"
import { tokenStorage } from "@/lib/api"
import type { CreateProductInput } from "@/lib/products"
import { renderWithProviders, resetMockApi, setHandler } from "./helpers"

const ING_1 = "11111111-1111-1111-1111-111111111111"
const ING_2 = "22222222-2222-2222-2222-222222222222"
const CAT_1 = "33333333-3333-3333-3333-333333333333"

function meHandler() {
    return {
        status: 200,
        data: {
            data: {
                id: "u1",
                name: "Ana",
                email: "ana@x.com",
                role: "OWNER" as const,
                active: true,
                createdAt: "2026-01-01T00:00:00Z",
            },
        },
    }
}

function defaultLookups(cfg: { url?: string }) {
    const url = cfg.url ?? ""
    if (url.endsWith("/users/me")) return meHandler()
    if (url.includes("/ingredients")) {
        return {
            status: 200,
            data: {
                data: [
                    { id: ING_1, name: "Mozzarella", unitOfMeasure: "kg", active: true, averageCost: 30, categoryId: null, supplierId: null, createdAt: "2026-01-01T00:00:00Z" },
                    { id: ING_2, name: "Manjericão", unitOfMeasure: "g", active: true, averageCost: 5, categoryId: null, supplierId: null, createdAt: "2026-01-01T00:00:00Z" },
                ],
                page: 0,
                size: 1000,
                total: 2,
            },
        }
    }
    if (url.includes("/categories")) {
        return {
            status: 200,
            data: {
                data: [{ id: CAT_1, name: "Pizzas", description: null, createdAt: "2026-01-01T00:00:00Z" }],
                page: 0,
                size: 1000,
                total: 1,
            },
        }
    }
    return null
}

describe("ProductForm", () => {
    beforeEach(() => {
        resetMockApi()
        tokenStorage.setAccess("a1")
    })

    it("renders default state with one empty ingredient row", async () => {
        setHandler(defaultLookups)
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        renderWithProviders(
            <ProductForm
                mode="create"
                onSubmit={onSubmit}
                backHref="/products"
                title="Novo"
            />
        )
        await waitFor(() => expect(screen.getByText(/1 ingrediente/i)).toBeInTheDocument())
    })

    it("adds and removes ingredient rows", async () => {
        setHandler(defaultLookups)
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        renderWithProviders(
            <ProductForm mode="create" onSubmit={onSubmit} backHref="/products" title="Novo" />
        )
        const user = userEvent.setup()
        await user.click(screen.getByRole("button", { name: /adicionar ingrediente/i }))
        await waitFor(() => expect(screen.getByText(/2 ingrediente/i)).toBeInTheDocument())

        const removeButtons = screen.getAllByLabelText(/remover ingrediente/i)
        await user.click(removeButtons[1])
        await waitFor(() => expect(screen.getByText(/1 ingrediente/i)).toBeInTheDocument())
    })

    it("submits valid product data", async () => {
        setHandler(defaultLookups)
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        renderWithProviders(
            <ProductForm mode="create" onSubmit={onSubmit} backHref="/products" title="Novo" />
        )

        await waitFor(() => expect(screen.getByText(/Mozzarella/i)).toBeInTheDocument())

        const user = userEvent.setup()
        await user.type(screen.getByLabelText(/Nome/i), "Margherita")
        await user.selectOptions(screen.getByLabelText(/Tamanho/i), "G")
        await user.clear(screen.getByLabelText(/Preço/i))
        await user.type(screen.getByLabelText(/Preço/i), "45.9")

        const ingredientSelect = screen.getAllByRole("combobox").find((el) =>
            (el as HTMLSelectElement).innerHTML.includes("Mozzarella")
        )!
        await user.selectOptions(ingredientSelect, ING_1)
        await user.type(screen.getAllByRole("spinbutton")[1], "0.3")

        await user.click(screen.getByRole("button", { name: /Criar produto/i }))

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledTimes(1)
            const arg = onSubmit.mock.calls[0][0] as CreateProductInput
            expect(arg.name).toBe("Margherita")
            expect(arg.size).toBe("G")
            expect(arg.price).toBe(45.9)
            expect(arg.ingredients).toHaveLength(1)
            expect(arg.ingredients[0].ingredientId).toBe(ING_1)
        })
    })

    it("blocks submit if duplicated ingredient", async () => {
        setHandler(defaultLookups)
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        renderWithProviders(
            <ProductForm mode="create" onSubmit={onSubmit} backHref="/products" title="Novo" />
        )

        await waitFor(() => expect(screen.getByText(/Mozzarella/i)).toBeInTheDocument())

        const user = userEvent.setup()
        await user.type(screen.getByLabelText(/Nome/i), "Margherita")
        await user.clear(screen.getByLabelText(/Preço/i))
        await user.type(screen.getByLabelText(/Preço/i), "45.9")
        await user.click(screen.getByRole("button", { name: /adicionar ingrediente/i }))

        const selects = screen.getAllByRole("combobox").filter((el) =>
            (el as HTMLSelectElement).innerHTML.includes("Mozzarella")
        )
        await user.selectOptions(selects[0], ING_1)
        await user.selectOptions(selects[1], ING_1)

        const qtyInputs = screen.getAllByRole("spinbutton").slice(1)
        await user.type(qtyInputs[0], "0.3")
        await user.type(qtyInputs[1], "0.2")

        await user.click(screen.getByRole("button", { name: /Criar produto/i }))

        await waitFor(() => {
            expect(screen.getByText(/duplicad/i)).toBeInTheDocument()
            expect(onSubmit).not.toHaveBeenCalled()
        })
    })
})
```

- [ ] **Step 3: Rodar a suíte completa**

```bash
cd frontend && npx vitest run
```

Expected: tests novos passam.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/\(protected\)/products/product-form.tsx frontend/tests/product-form.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): shared ProductForm with useFieldArray for recipe sheet

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `/products/nova` route (consome form)

**Files:**
- Create: `frontend/app/(protected)/products/nova/page.tsx`

**Why:** Página simples que monta `<ProductForm mode="create">`, faz a chamada de criação e redireciona ao detalhe. Inclui guard `OWNER`.

**Reference pattern:** `frontend/app/(protected)/purchase-orders/nova/page.tsx`.

- [ ] **Step 1: Criar `frontend/app/(protected)/products/nova/page.tsx`**

```tsx
"use client"

import { ProductForm } from "@/app/(protected)/products/product-form"
import { NoAccess } from "@/components/no-access"
import { isApiError, useAuth } from "@/lib/auth"
import { useCreateProduct, type CreateProductInput } from "@/lib/products"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function NovoProdutoPage() {
    const router = useRouter()
    const { user } = useAuth()
    const create = useCreateProduct()

    if (!user) return null
    if (user.role !== "OWNER") return <NoAccess />

    async function handleSubmit(input: CreateProductInput) {
        try {
            const product = await create.mutateAsync(input)
            toast.success("Produto criado.")
            router.replace(`/products/${product.id}`)
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao criar produto.")
        }
    }

    return (
        <ProductForm mode="create" onSubmit={handleSubmit} backHref="/products" title="Novo" />
    )
}
```

- [ ] **Step 2: Verificar build**

```bash
cd frontend && npm run build
```

Expected: build passa.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/\(protected\)/products/nova/page.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): /products/nova route with OWNER guard

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `/products/[id]/editar` route (consome form, status guard)

**Files:**
- Create: `frontend/app/(protected)/products/[id]/editar/page.tsx`

**Why:** Página de edição: pre-fetch via `useProduct`, popula `defaultValues`, faz update. Guard `OWNER`. Sem guard de status (products não tem state machine, qualquer produto pode ser editado).

**Reference pattern:** `frontend/app/(protected)/purchase-orders/[id]/editar/page.tsx`.

- [ ] **Step 1: Criar `frontend/app/(protected)/products/[id]/editar/page.tsx`**

```tsx
"use client"

import { ProductForm } from "@/app/(protected)/products/product-form"
import { NoAccess } from "@/components/no-access"
import { Button } from "@/components/ui/button"
import { isApiError, useAuth } from "@/lib/auth"
import {
    useProduct,
    useUpdateProduct,
    type CreateProductInput,
    type UpdateProductInput,
} from "@/lib/products"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"

export default function EditarProdutoPage() {
    const params = useParams<{ id: string }>()
    const id = params.id
    const router = useRouter()
    const { user } = useAuth()
    const productQuery = useProduct(id)
    const update = useUpdateProduct()

    if (!user) return null
    if (user.role !== "OWNER") return <NoAccess />

    if (productQuery.isLoading) {
        return <div className="text-sm text-text-secondary">Carregando produto...</div>
    }

    if (productQuery.isError || !productQuery.data) {
        return (
            <div className="space-y-3">
                <p className="text-sm text-danger">Não foi possível carregar o produto.</p>
                <div className="flex gap-2">
                    <Button onClick={() => productQuery.refetch()}>Tentar novamente</Button>
                    <Button variant="ghost" onClick={() => router.push("/products")}>
                        Voltar
                    </Button>
                </div>
            </div>
        )
    }

    const p = productQuery.data
    const defaultValues: CreateProductInput = {
        name: p.name,
        size: p.size,
        categoryId: p.categoryId ?? "",
        price: p.price,
        description: p.description ?? "",
        ingredients: p.ingredients.map((i) => ({
            ingredientId: i.ingredientId,
            quantity: i.quantity,
        })),
    }

    async function handleSubmit(input: UpdateProductInput) {
        try {
            await update.mutateAsync({ id, input })
            toast.success("Produto atualizado.")
            router.replace(`/products/${id}`)
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao atualizar produto.")
        }
    }

    return (
        <ProductForm
            mode="edit"
            defaultValues={defaultValues}
            onSubmit={handleSubmit}
            backHref={`/products/${id}`}
            title={`Editar ${p.name} ${p.size}`}
        />
    )
}
```

- [ ] **Step 2: Verificar build**

```bash
cd frontend && npm run build
```

Expected: build passa.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/\(protected\)/products/\[id\]/editar/page.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): /products/[id]/editar route consuming shared form

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `/products` listagem + tests

**Files:**
- Create: `frontend/app/(protected)/products/page.tsx`
- Create: `frontend/tests/products-page.test.tsx`

**Why:** Listagem com 3 filtros URL-persisted (categoria, tamanho, ativo), botão "+ Novo produto" só OWNER, ações por linha (ver/editar/desativar).

**Reference pattern:** `frontend/app/(protected)/purchase-orders/page.tsx`.

- [ ] **Step 1: Criar `frontend/app/(protected)/products/page.tsx`**

```tsx
"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/overlays/confirm-dialog"
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { useAllCategories } from "@/lib/categories"
import { isApiError, useAuth } from "@/lib/auth"
import {
    PRODUCT_SIZES,
    useDeactivateProduct,
    useProducts,
    type ProductSize,
} from "@/lib/products"
import { Eye, Pencil, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

export default function ProductsPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { user } = useAuth()
    const isOwner = user?.role === "OWNER"
    const [confirmDeactivate, setConfirmDeactivate] = useState<{ id: string; name: string } | null>(null)

    const category = searchParams.get("category") ?? ""
    const size = (searchParams.get("size") as ProductSize | null) ?? ""
    const activeParam = searchParams.get("active")
    const active = activeParam === null ? true : activeParam === "true"
    const page = Number(searchParams.get("page") ?? 0)

    const productsQuery = useProducts({
        category: category || undefined,
        size: (size as ProductSize) || undefined,
        active,
        page,
        pageSize: 20,
    })
    const categoriesQuery = useAllCategories()
    const deactivate = useDeactivateProduct()

    function setParam(key: string, value: string) {
        const next = new URLSearchParams(searchParams.toString())
        if (value === "") next.delete(key)
        else next.set(key, value)
        next.delete("page")
        router.replace(`/products?${next.toString()}`)
    }

    async function handleDeactivate() {
        if (!confirmDeactivate) return
        try {
            await deactivate.mutateAsync(confirmDeactivate.id)
            toast.success("Produto desativado.")
            setConfirmDeactivate(null)
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao desativar produto.")
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-text-primary">Produtos</h1>
                    <p className="text-sm text-text-secondary">Cardápio com fichas técnicas.</p>
                </div>
                {isOwner ? (
                    <Button onClick={() => router.push("/products/nova")}>
                        <Plus className="h-4 w-4" /> Novo produto
                    </Button>
                ) : null}
            </div>

            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border/40 bg-white p-3">
                <label className="flex flex-col text-xs text-text-secondary">
                    Categoria
                    <select
                        value={category}
                        onChange={(e) => setParam("category", e.target.value)}
                        className="mt-1 h-9 w-48 rounded-md border border-border bg-white px-2 text-sm"
                    >
                        <option value="">Todas</option>
                        {(categoriesQuery.data ?? []).map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex flex-col text-xs text-text-secondary">
                    Tamanho
                    <select
                        value={size}
                        onChange={(e) => setParam("size", e.target.value)}
                        className="mt-1 h-9 w-24 rounded-md border border-border bg-white px-2 text-sm"
                    >
                        <option value="">Todos</option>
                        {PRODUCT_SIZES.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex flex-col text-xs text-text-secondary">
                    Ativo
                    <select
                        value={activeParam ?? "true"}
                        onChange={(e) => setParam("active", e.target.value)}
                        className="mt-1 h-9 w-28 rounded-md border border-border bg-white px-2 text-sm"
                    >
                        <option value="true">Sim</option>
                        <option value="false">Não</option>
                        <option value="">Todos</option>
                    </select>
                </label>
            </div>

            {productsQuery.isLoading ? (
                <p className="text-sm text-text-secondary">Carregando...</p>
            ) : productsQuery.isError ? (
                <div className="space-y-2">
                    <p className="text-sm text-danger">Erro ao carregar produtos.</p>
                    <Button onClick={() => productsQuery.refetch()}>Tentar novamente</Button>
                </div>
            ) : !productsQuery.data || productsQuery.data.data.length === 0 ? (
                <p className="text-sm text-text-secondary">Nenhum produto cadastrado.</p>
            ) : (
                <Table>
                    <THead>
                        <TR>
                            <TH>Nome</TH>
                            <TH>Tamanho</TH>
                            <TH>Categoria</TH>
                            <TH>Preço</TH>
                            <TH>Status</TH>
                            <TH className="text-right">Ações</TH>
                        </TR>
                    </THead>
                    <TBody>
                        {productsQuery.data.data.map((p) => (
                            <TR key={p.id}>
                                <TD className="font-medium">{p.name}</TD>
                                <TD>
                                    <Badge>{p.size}</Badge>
                                </TD>
                                <TD>{p.categoryName ?? "—"}</TD>
                                <TD>R$ {p.price.toFixed(2)}</TD>
                                <TD>
                                    {p.active ? (
                                        <Badge tone="success">Ativo</Badge>
                                    ) : (
                                        <Badge tone="muted">Inativo</Badge>
                                    )}
                                </TD>
                                <TD className="text-right">
                                    <div className="inline-flex items-center gap-1">
                                        <Link
                                            href={`/products/${p.id}`}
                                            className="rounded p-1 text-text-secondary hover:bg-text-primary/5 hover:text-text-primary"
                                            aria-label="Ver detalhes"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Link>
                                        {isOwner ? (
                                            <>
                                                <Link
                                                    href={`/products/${p.id}/editar`}
                                                    className="rounded p-1 text-text-secondary hover:bg-text-primary/5 hover:text-text-primary"
                                                    aria-label="Editar"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Link>
                                                {p.active ? (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setConfirmDeactivate({ id: p.id, name: `${p.name} ${p.size}` })
                                                        }
                                                        className="rounded p-1 text-text-secondary hover:bg-danger/10 hover:text-danger"
                                                        aria-label="Desativar"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                ) : null}
                                            </>
                                        ) : null}
                                    </div>
                                </TD>
                            </TR>
                        ))}
                    </TBody>
                </Table>
            )}

            <ConfirmDialog
                open={!!confirmDeactivate}
                title="Desativar produto"
                description={`Tem certeza que deseja desativar "${confirmDeactivate?.name ?? ""}"? Ele deixará de aparecer no cardápio.`}
                confirmLabel="Desativar"
                onConfirm={handleDeactivate}
                onCancel={() => setConfirmDeactivate(null)}
            />
        </div>
    )
}
```

> **Nota:** se a API de `Table` / `Badge` / `ConfirmDialog` divergir (props diferentes), ajustar para o shape real. Inspecionar `frontend/components/ui/table.tsx`, `frontend/components/ui/badge.tsx`, `frontend/components/overlays/confirm-dialog.tsx` antes de salvar.

- [ ] **Step 2: Criar `frontend/tests/products-page.test.tsx`**

```tsx
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const replaceMock = vi.fn()

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: replaceMock, back: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/products",
    useParams: () => ({}),
}))

import ProductsPage from "@/app/(protected)/products/page"
import { tokenStorage } from "@/lib/api"
import { renderWithProviders, resetMockApi, setHandler } from "./helpers"

const PROD_1 = "11111111-1111-1111-1111-111111111111"

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

function listHandler(role: "OWNER" | "EMPLOYEE") {
    return (cfg: { url?: string }) => {
        const url = cfg.url ?? ""
        if (url.endsWith("/users/me")) return meHandler(role)
        if (url.includes("/categories")) {
            return {
                status: 200,
                data: { data: [], page: 0, size: 1000, total: 0 },
            }
        }
        if (url.includes("/products")) {
            return {
                status: 200,
                data: {
                    data: [
                        {
                            id: PROD_1,
                            name: "Margherita",
                            size: "G",
                            categoryId: null,
                            categoryName: null,
                            price: 45.9,
                            description: null,
                            active: true,
                            createdAt: "2026-01-01T00:00:00Z",
                            ingredients: [],
                        },
                    ],
                    page: 0,
                    size: 20,
                    total: 1,
                },
            }
        }
        return null
    }
}

describe("ProductsPage", () => {
    beforeEach(() => {
        resetMockApi()
        replaceMock.mockReset()
        tokenStorage.setAccess("a1")
    })

    it("renders product rows for OWNER with action buttons", async () => {
        setHandler(listHandler("OWNER"))
        renderWithProviders(<ProductsPage />)

        await waitFor(() => expect(screen.getByText("Margherita")).toBeInTheDocument())
        expect(screen.getByLabelText(/Editar/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/Desativar/i)).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /Novo produto/i })).toBeInTheDocument()
    })

    it("hides mutating actions for EMPLOYEE", async () => {
        setHandler(listHandler("EMPLOYEE"))
        renderWithProviders(<ProductsPage />)

        await waitFor(() => expect(screen.getByText("Margherita")).toBeInTheDocument())
        expect(screen.queryByLabelText(/Editar/i)).not.toBeInTheDocument()
        expect(screen.queryByLabelText(/Desativar/i)).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Novo produto/i })).not.toBeInTheDocument()
    })

    it("filter changes update the URL via router.replace", async () => {
        setHandler(listHandler("OWNER"))
        renderWithProviders(<ProductsPage />)

        await waitFor(() => expect(screen.getByText("Margherita")).toBeInTheDocument())
        const sizeSelect = screen.getByLabelText(/Tamanho/i)
        const user = userEvent.setup()
        await user.selectOptions(sizeSelect, "G")

        await waitFor(() => {
            expect(replaceMock).toHaveBeenCalled()
            const arg = replaceMock.mock.calls[replaceMock.mock.calls.length - 1][0] as string
            expect(arg).toContain("size=G")
        })
    })
})
```

- [ ] **Step 3: Rodar suíte completa**

```bash
cd frontend && npx vitest run
```

Expected: tudo passa.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/\(protected\)/products/page.tsx frontend/tests/products-page.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): /products listing with category/size/active filters

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `/products/[id]` detalhe + tests

**Files:**
- Create: `frontend/app/(protected)/products/[id]/page.tsx`
- Create: `frontend/tests/product-detail-page.test.tsx`

**Why:** Detalhe read-only com 2 cards (Dados + Ficha técnica). Ações no header só OWNER (Editar + Desativar; ocultas se já inativo).

- [ ] **Step 1: Criar `frontend/app/(protected)/products/[id]/page.tsx`**

```tsx
"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/overlays/confirm-dialog"
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { isApiError, useAuth } from "@/lib/auth"
import { useDeactivateProduct, useProduct } from "@/lib/products"
import { Pencil, Trash2 } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

export default function ProductDetailPage() {
    const params = useParams<{ id: string }>()
    const id = params.id
    const router = useRouter()
    const { user } = useAuth()
    const isOwner = user?.role === "OWNER"
    const productQuery = useProduct(id)
    const deactivate = useDeactivateProduct()
    const [confirmOpen, setConfirmOpen] = useState(false)

    if (productQuery.isLoading) {
        return <div className="text-sm text-text-secondary">Carregando produto...</div>
    }
    if (productQuery.isError || !productQuery.data) {
        return (
            <div className="space-y-3">
                <p className="text-sm text-danger">Não foi possível carregar o produto.</p>
                <Button onClick={() => productQuery.refetch()}>Tentar novamente</Button>
            </div>
        )
    }

    const p = productQuery.data

    async function handleDeactivate() {
        try {
            await deactivate.mutateAsync(id)
            toast.success("Produto desativado.")
            setConfirmOpen(false)
            router.replace("/products")
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao desativar produto.")
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <p className="text-xs text-text-secondary">Produtos › {p.name} {p.size}</p>
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-semibold text-text-primary">
                            {p.name} {p.size}
                        </h1>
                        {p.active ? (
                            <Badge tone="success">Ativo</Badge>
                        ) : (
                            <Badge tone="muted">Inativo</Badge>
                        )}
                    </div>
                </div>
                {isOwner && p.active ? (
                    <div className="flex gap-2">
                        <Link href={`/products/${id}/editar`}>
                            <Button variant="ghost">
                                <Pencil className="h-4 w-4" /> Editar
                            </Button>
                        </Link>
                        <Button variant="ghost" onClick={() => setConfirmOpen(true)}>
                            <Trash2 className="h-4 w-4" /> Desativar
                        </Button>
                    </div>
                ) : null}
            </div>

            <section className="space-y-3 rounded-lg border border-border/40 bg-white p-4">
                <h2 className="text-sm font-medium text-text-primary">Dados do produto</h2>
                <dl className="grid gap-3 text-sm md:grid-cols-2">
                    <div>
                        <dt className="text-text-secondary">Nome</dt>
                        <dd className="text-text-primary">{p.name}</dd>
                    </div>
                    <div>
                        <dt className="text-text-secondary">Tamanho</dt>
                        <dd className="text-text-primary">{p.size}</dd>
                    </div>
                    <div>
                        <dt className="text-text-secondary">Categoria</dt>
                        <dd className="text-text-primary">{p.categoryName ?? "—"}</dd>
                    </div>
                    <div>
                        <dt className="text-text-secondary">Preço</dt>
                        <dd className="text-text-primary">R$ {p.price.toFixed(2)}</dd>
                    </div>
                    <div className="md:col-span-2">
                        <dt className="text-text-secondary">Descrição</dt>
                        <dd className="text-text-primary">{p.description ?? "—"}</dd>
                    </div>
                    <div>
                        <dt className="text-text-secondary">Criado em</dt>
                        <dd className="text-text-primary">
                            {new Date(p.createdAt).toLocaleString("pt-BR")}
                        </dd>
                    </div>
                </dl>
            </section>

            <section className="space-y-3 rounded-lg border border-border/40 bg-white p-4">
                <h2 className="text-sm font-medium text-text-primary">Ficha técnica</h2>
                <Table>
                    <THead>
                        <TR>
                            <TH>Ingrediente</TH>
                            <TH>Quantidade</TH>
                            <TH>Unidade</TH>
                        </TR>
                    </THead>
                    <TBody>
                        {p.ingredients.map((i) => (
                            <TR key={i.id}>
                                <TD>{i.ingredientName}</TD>
                                <TD>{i.quantity}</TD>
                                <TD>{i.unitOfMeasure}</TD>
                            </TR>
                        ))}
                    </TBody>
                </Table>
            </section>

            <ConfirmDialog
                open={confirmOpen}
                title="Desativar produto"
                description={`Tem certeza que deseja desativar "${p.name} ${p.size}"?`}
                confirmLabel="Desativar"
                onConfirm={handleDeactivate}
                onCancel={() => setConfirmOpen(false)}
            />
        </div>
    )
}
```

- [ ] **Step 2: Criar `frontend/tests/product-detail-page.test.tsx`**

```tsx
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/products/p1",
    useParams: () => ({ id: "11111111-1111-1111-1111-111111111111" }),
}))

import ProductDetailPage from "@/app/(protected)/products/[id]/page"
import { tokenStorage } from "@/lib/api"
import { renderWithProviders, resetMockApi, setHandler } from "./helpers"

const PROD = "11111111-1111-1111-1111-111111111111"

function detail(active: boolean) {
    return {
        id: PROD,
        name: "Margherita",
        size: "G",
        categoryId: null,
        categoryName: null,
        price: 45.9,
        description: "Molho de tomate",
        active,
        createdAt: "2026-01-01T00:00:00Z",
        ingredients: [
            {
                id: "i1",
                ingredientId: "ing1",
                ingredientName: "Mozzarella",
                quantity: 0.3,
                unitOfMeasure: "kg",
            },
        ],
    }
}

function buildHandler(role: "OWNER" | "EMPLOYEE", active: boolean) {
    return (cfg: { url?: string }) => {
        const url = cfg.url ?? ""
        if (url.endsWith("/users/me")) {
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
        if (url.includes(`/products/${PROD}`)) {
            return { status: 200, data: { data: detail(active) } }
        }
        return null
    }
}

describe("ProductDetailPage", () => {
    beforeEach(() => {
        resetMockApi()
        tokenStorage.setAccess("a1")
    })

    it("renders product details and recipe ingredients for OWNER", async () => {
        setHandler(buildHandler("OWNER", true))
        renderWithProviders(<ProductDetailPage />)

        await waitFor(() => expect(screen.getByText(/Margherita G/i)).toBeInTheDocument())
        expect(screen.getByText("Mozzarella")).toBeInTheDocument()
        expect(screen.getByText("0.3")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /Editar/i })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /Desativar/i })).toBeInTheDocument()
    })

    it("hides actions for EMPLOYEE", async () => {
        setHandler(buildHandler("EMPLOYEE", true))
        renderWithProviders(<ProductDetailPage />)

        await waitFor(() => expect(screen.getByText(/Margherita G/i)).toBeInTheDocument())
        expect(screen.queryByRole("button", { name: /Editar/i })).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Desativar/i })).not.toBeInTheDocument()
    })

    it("hides actions when product is already inactive (OWNER)", async () => {
        setHandler(buildHandler("OWNER", false))
        renderWithProviders(<ProductDetailPage />)

        await waitFor(() => expect(screen.getByText(/Margherita G/i)).toBeInTheDocument())
        expect(screen.getByText(/Inativo/i)).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Editar/i })).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Desativar/i })).not.toBeInTheDocument()
    })
})
```

- [ ] **Step 3: Rodar suíte**

```bash
cd frontend && npx vitest run
```

Expected: passa.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/\(protected\)/products/\[id\]/page.tsx frontend/tests/product-detail-page.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): /products/[id] detail with deactivate action

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `lib/orders.ts` — types + zod + hooks + schema tests

**Files:**
- Create: `frontend/lib/orders.ts`
- Modify: `frontend/tests/schemas.test.ts` (adicionar describe `createOrderSchema`)

**Why:** Camada de dados de orders. Inclui state actions (`useStartOrder`, `useCompleteOrder`, `useCancelOrder`).

- [ ] **Step 1: Criar `frontend/lib/orders.ts`**

```ts
import { api } from "@/lib/api"
import type { Page } from "@/lib/users"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

export const ORDER_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELED"] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export type OrderItem = {
    id: string
    productId: string
    productName: string
    quantity: number
    unitPrice: number
    subtotal: number
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
    items: OrderItem[]
}

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export const orderItemSchema = z.object({
    productId: z.string().regex(UUID_REGEX, "Selecione um produto"),
    quantity: z.coerce.number().int("Quantidade inteira").min(1, "Mínimo 1"),
})
export type OrderItemInput = z.infer<typeof orderItemSchema>

export const createOrderSchema = z.object({
    unitId: z.string().regex(UUID_REGEX, "Selecione uma unidade"),
    notes: z.string().max(500).optional().or(z.literal("")),
    items: z
        .array(orderItemSchema)
        .min(1, "Adicione ao menos 1 item")
        .refine(
            (arr) => new Set(arr.map((i) => i.productId)).size === arr.length,
            "Produtos duplicados não são permitidos"
        ),
})
export type CreateOrderInput = z.infer<typeof createOrderSchema>

export const updateOrderSchema = createOrderSchema
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>

export type OrderFilters = {
    unit?: string
    status?: OrderStatus
    from?: string
    to?: string
    page?: number
    size?: number
}

export function useOrders(filters: OrderFilters = {}) {
    const page = filters.page ?? 0
    const size = filters.size ?? 20
    const params: Record<string, string | number> = { page, size }
    if (filters.unit) params.unit = filters.unit
    if (filters.status) params.status = filters.status
    if (filters.from) params.from = filters.from
    if (filters.to) params.to = filters.to
    return useQuery({
        queryKey: [
            "orders",
            {
                unit: filters.unit ?? null,
                status: filters.status ?? null,
                from: filters.from ?? null,
                to: filters.to ?? null,
                page,
                size,
            },
        ],
        queryFn: () => api.get<Page<Order>>("/orders", { params }).then((r) => r.data),
    })
}

export function useOrder(id: string) {
    return useQuery({
        queryKey: ["orders", id],
        queryFn: () => api.get<Order>(`/orders/${id}`).then((r) => r.data),
        enabled: !!id,
    })
}

function normalizePayload(input: CreateOrderInput | UpdateOrderInput) {
    return {
        ...input,
        notes: input.notes === "" ? null : input.notes,
    }
}

export function useCreateOrder() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (input: CreateOrderInput) =>
            api.post<Order>("/orders", normalizePayload(input)).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
    })
}

export function useUpdateOrder() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: UpdateOrderInput }) =>
            api.put<Order>(`/orders/${id}`, normalizePayload(input)).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
    })
}

export function useStartOrder() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) =>
            api.post<Order>(`/orders/${id}/start`).then((r) => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["orders"] })
            qc.invalidateQueries({ queryKey: ["stock"] })
            qc.invalidateQueries({ queryKey: ["stock-movements"] })
        },
    })
}

export function useCompleteOrder() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) =>
            api.post<Order>(`/orders/${id}/complete`).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
    })
}

export function useCancelOrder() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) =>
            api.post<Order>(`/orders/${id}/cancel`).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
    })
}
```

- [ ] **Step 2: Estender `frontend/tests/schemas.test.ts` com describe `createOrderSchema`**

Adicionar import no topo: `import { createOrderSchema } from "@/lib/orders"`. Depois, anexar:

```ts
describe("createOrderSchema", () => {
    const VALID_UUID = "11111111-1111-1111-1111-111111111111"
    const VALID_UUID_2 = "22222222-2222-2222-2222-222222222222"
    const UNIT_UUID = "33333333-3333-3333-3333-333333333333"

    function baseInput() {
        return {
            unitId: UNIT_UUID,
            notes: "",
            items: [{ productId: VALID_UUID, quantity: 1 }],
        }
    }

    it("accepts a valid order with one item", () => {
        const result = createOrderSchema.safeParse(baseInput())
        expect(result.success).toBe(true)
    })

    it("rejects empty items array", () => {
        const result = createOrderSchema.safeParse({ ...baseInput(), items: [] })
        expect(result.success).toBe(false)
    })

    it("rejects duplicated product ids", () => {
        const result = createOrderSchema.safeParse({
            ...baseInput(),
            items: [
                { productId: VALID_UUID, quantity: 1 },
                { productId: VALID_UUID, quantity: 2 },
            ],
        })
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues.some((i) => /duplicad/i.test(i.message))).toBe(true)
        }
    })

    it("accepts two distinct products", () => {
        const result = createOrderSchema.safeParse({
            ...baseInput(),
            items: [
                { productId: VALID_UUID, quantity: 1 },
                { productId: VALID_UUID_2, quantity: 1 },
            ],
        })
        expect(result.success).toBe(true)
    })

    it("rejects quantity 0", () => {
        const result = createOrderSchema.safeParse({
            ...baseInput(),
            items: [{ productId: VALID_UUID, quantity: 0 }],
        })
        expect(result.success).toBe(false)
    })

    it("rejects non-integer quantity", () => {
        const result = createOrderSchema.safeParse({
            ...baseInput(),
            items: [{ productId: VALID_UUID, quantity: 1.5 }],
        })
        expect(result.success).toBe(false)
    })

    it("rejects notes above 500 chars", () => {
        const result = createOrderSchema.safeParse({
            ...baseInput(),
            notes: "x".repeat(501),
        })
        expect(result.success).toBe(false)
    })
})
```

- [ ] **Step 3: Rodar suíte**

```bash
cd frontend && npx vitest run
```

Expected: passa.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/orders.ts frontend/tests/schemas.test.ts
git commit -m "$(cat <<'EOF'
feat(frontend): orders types, schemas and TanStack hooks

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `order-form.tsx` — componente compartilhado + tests

**Files:**
- Create: `frontend/app/(protected)/orders/order-form.tsx`
- Create: `frontend/tests/order-form.test.tsx`

**Why:** Form compartilhado entre `/orders/novo` e `/orders/[id]/editar`. Items via `useFieldArray`. Display de `unitPrice` e `subtotal` é read-only (preço captura no backend).

**Reference pattern:** `frontend/app/(protected)/purchase-orders/purchase-order-form.tsx` + `frontend/app/(protected)/products/product-form.tsx` (criado na Task 2).

- [ ] **Step 1: Criar `frontend/app/(protected)/orders/order-form.tsx`**

```tsx
"use client"

import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useAllProducts } from "@/lib/products"
import { useAllUnits } from "@/lib/units"
import {
    createOrderSchema,
    type CreateOrderInput,
} from "@/lib/orders"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useFieldArray, useForm } from "react-hook-form"

export type OrderFormProps = {
    mode: "create" | "edit"
    defaultValues?: CreateOrderInput
    onSubmit: (input: CreateOrderInput) => Promise<void>
    backHref: string
    title: string
}

const EMPTY_ITEM = { productId: "", quantity: 1 }

const DEFAULT_VALUES: CreateOrderInput = {
    unitId: "",
    notes: "",
    items: [EMPTY_ITEM],
}

export function OrderForm({ mode, defaultValues, onSubmit, backHref, title }: OrderFormProps) {
    const router = useRouter()
    const productsQuery = useAllProducts()
    const unitsQuery = useAllUnits()

    const form = useForm<CreateOrderInput>({
        resolver: zodResolver(createOrderSchema) as never,
        defaultValues: defaultValues ?? DEFAULT_VALUES,
    })

    const { register, control, handleSubmit, watch, formState } = form
    const { fields, append, remove } = useFieldArray({ control, name: "items" })
    const watchedItems = watch("items")

    function productPrice(productId: string): number {
        const p = productsQuery.data?.find((x) => x.id === productId)
        return p?.price ?? 0
    }

    function productLabel(productId: string): string {
        const p = productsQuery.data?.find((x) => x.id === productId)
        if (!p) return ""
        return `${p.name} ${p.size}`
    }

    const total = (watchedItems ?? []).reduce(
        (acc, it) => acc + (it.quantity || 0) * productPrice(it.productId || ""),
        0
    )

    async function onValid(input: CreateOrderInput) {
        await onSubmit(input)
    }

    return (
        <form
            onSubmit={handleSubmit(onValid)}
            className="mx-auto max-w-3xl space-y-6 rounded-lg border border-border/40 bg-white p-6"
        >
            <div className="space-y-1">
                <p className="text-xs text-text-secondary">Pedidos › {title}</p>
                <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
            </div>

            <section className="space-y-4">
                <h2 className="text-sm font-medium text-text-primary">Dados do pedido</h2>

                <Field label="Unidade" error={formState.errors.unitId?.message}>
                    <select
                        {...register("unitId")}
                        className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                        disabled={unitsQuery.isLoading}
                    >
                        <option value="">Selecione...</option>
                        {(unitsQuery.data ?? []).map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.name}
                            </option>
                        ))}
                    </select>
                </Field>

                <Field label="Observações" error={formState.errors.notes?.message}>
                    <textarea
                        {...register("notes")}
                        rows={2}
                        className="w-full resize-y rounded-md border border-border bg-white px-3 py-2 text-sm"
                    />
                </Field>
            </section>

            <section className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-medium text-text-primary">Itens</h2>
                    <span className="text-xs text-text-secondary">{fields.length} item(ns)</span>
                </div>

                {formState.errors.items?.root?.message ? (
                    <p className="text-sm text-danger">{formState.errors.items.root.message}</p>
                ) : null}
                {formState.errors.items?.message ? (
                    <p className="text-sm text-danger">{formState.errors.items.message}</p>
                ) : null}

                <div className="overflow-x-auto rounded-md border border-border/40">
                    <table className="w-full text-sm">
                        <thead className="bg-text-primary/5 text-text-secondary">
                            <tr>
                                <th className="px-3 py-2 text-left font-medium">Produto</th>
                                <th className="w-24 px-3 py-2 text-left font-medium">Qtd</th>
                                <th className="w-32 px-3 py-2 text-left font-medium">Preço</th>
                                <th className="w-32 px-3 py-2 text-left font-medium">Subtotal</th>
                                <th className="w-12 px-3 py-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {fields.map((field, idx) => {
                                const errorProduct =
                                    formState.errors.items?.[idx]?.productId?.message
                                const errorQty =
                                    formState.errors.items?.[idx]?.quantity?.message
                                const watchedId = watchedItems?.[idx]?.productId ?? ""
                                const watchedQty = watchedItems?.[idx]?.quantity ?? 0
                                const price = productPrice(watchedId)
                                const subtotal = price * watchedQty
                                return (
                                    <tr key={field.id} className="border-t border-border/40">
                                        <td className="px-3 py-2">
                                            <select
                                                {...register(`items.${idx}.productId` as const)}
                                                className="h-9 w-full rounded-md border border-border bg-white px-2 text-sm"
                                                disabled={productsQuery.isLoading}
                                            >
                                                <option value="">Selecione...</option>
                                                {(productsQuery.data ?? []).map((p) => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.name} {p.size} — R$ {p.price.toFixed(2)}
                                                    </option>
                                                ))}
                                            </select>
                                            {errorProduct ? (
                                                <p className="mt-1 text-xs text-danger">{errorProduct}</p>
                                            ) : null}
                                        </td>
                                        <td className="px-3 py-2">
                                            <Input
                                                type="number"
                                                step="1"
                                                min="1"
                                                {...register(`items.${idx}.quantity` as const, {
                                                    valueAsNumber: true,
                                                })}
                                            />
                                            {errorQty ? (
                                                <p className="mt-1 text-xs text-danger">{errorQty}</p>
                                            ) : null}
                                        </td>
                                        <td className="px-3 py-2 text-text-secondary">
                                            R$ {price.toFixed(2)}
                                        </td>
                                        <td className="px-3 py-2 text-text-secondary">
                                            R$ {subtotal.toFixed(2)}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            <button
                                                type="button"
                                                onClick={() => remove(idx)}
                                                disabled={fields.length === 1}
                                                className="rounded p-1 text-text-secondary hover:bg-danger/10 hover:text-danger disabled:opacity-40"
                                                aria-label="Remover item"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="border-t border-border/40 bg-text-primary/5">
                                <td colSpan={3} className="px-3 py-2 text-right font-medium">
                                    Total
                                </td>
                                <td className="px-3 py-2 font-medium text-text-primary">
                                    R$ {total.toFixed(2)}
                                </td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <Button type="button" variant="ghost" onClick={() => append(EMPTY_ITEM)}>
                    + Adicionar item
                </Button>
            </section>

            <div className="flex items-center justify-end gap-3 border-t border-border/40 pt-4">
                <Button type="button" variant="ghost" onClick={() => router.push(backHref)}>
                    Cancelar
                </Button>
                <Button type="submit" disabled={formState.isSubmitting}>
                    {mode === "create" ? "Criar pedido" : "Salvar alterações"}
                </Button>
            </div>
        </form>
    )
}
```

- [ ] **Step 2: Criar `frontend/tests/order-form.test.tsx`**

```tsx
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/orders/novo",
    useParams: () => ({}),
}))

import { OrderForm } from "@/app/(protected)/orders/order-form"
import { tokenStorage } from "@/lib/api"
import type { CreateOrderInput } from "@/lib/orders"
import { renderWithProviders, resetMockApi, setHandler } from "./helpers"

const PROD_1 = "11111111-1111-1111-1111-111111111111"
const PROD_2 = "22222222-2222-2222-2222-222222222222"
const UNIT_1 = "33333333-3333-3333-3333-333333333333"

function lookups(cfg: { url?: string }) {
    const url = cfg.url ?? ""
    if (url.endsWith("/users/me")) {
        return {
            status: 200,
            data: {
                data: {
                    id: "u1",
                    name: "Ana",
                    email: "ana@x.com",
                    role: "OWNER" as const,
                    active: true,
                    createdAt: "2026-01-01T00:00:00Z",
                },
            },
        }
    }
    if (url.includes("/products")) {
        return {
            status: 200,
            data: {
                data: [
                    { id: PROD_1, name: "Margherita", size: "G", price: 45.9, active: true, categoryId: null, categoryName: null, description: null, createdAt: "2026-01-01T00:00:00Z", ingredients: [] },
                    { id: PROD_2, name: "Calabresa", size: "M", price: 39.9, active: true, categoryId: null, categoryName: null, description: null, createdAt: "2026-01-01T00:00:00Z", ingredients: [] },
                ],
                page: 0,
                size: 1000,
                total: 2,
            },
        }
    }
    if (url.includes("/units")) {
        return {
            status: 200,
            data: {
                data: [{ id: UNIT_1, name: "Centro", address: null, active: true, createdAt: "2026-01-01T00:00:00Z" }],
                page: 0,
                size: 1000,
                total: 1,
            },
        }
    }
    return null
}

describe("OrderForm", () => {
    beforeEach(() => {
        resetMockApi()
        tokenStorage.setAccess("a1")
    })

    it("renders default state and computes total client-side", async () => {
        setHandler(lookups)
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        renderWithProviders(
            <OrderForm mode="create" onSubmit={onSubmit} backHref="/orders" title="Novo" />
        )

        await waitFor(() => expect(screen.getByText(/Margherita G/i)).toBeInTheDocument())
        const user = userEvent.setup()
        const productSelect = screen.getAllByRole("combobox").find((el) =>
            (el as HTMLSelectElement).innerHTML.includes("Margherita")
        )!
        await user.selectOptions(productSelect, PROD_1)
        await user.clear(screen.getAllByRole("spinbutton")[0])
        await user.type(screen.getAllByRole("spinbutton")[0], "2")

        await waitFor(() => {
            expect(screen.getByText(/R\$ 91\.80/)).toBeInTheDocument()
        })
    })

    it("submits valid order data without unitPrice", async () => {
        setHandler(lookups)
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        renderWithProviders(
            <OrderForm mode="create" onSubmit={onSubmit} backHref="/orders" title="Novo" />
        )

        await waitFor(() => expect(screen.getByText(/Margherita G/i)).toBeInTheDocument())
        const user = userEvent.setup()
        await user.selectOptions(screen.getByLabelText(/Unidade/i), UNIT_1)
        const productSelect = screen.getAllByRole("combobox").find((el) =>
            (el as HTMLSelectElement).innerHTML.includes("Margherita")
        )!
        await user.selectOptions(productSelect, PROD_1)

        await user.click(screen.getByRole("button", { name: /Criar pedido/i }))

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledTimes(1)
            const arg = onSubmit.mock.calls[0][0] as CreateOrderInput
            expect(arg.unitId).toBe(UNIT_1)
            expect(arg.items).toHaveLength(1)
            expect(arg.items[0].productId).toBe(PROD_1)
            expect("unitPrice" in arg.items[0]).toBe(false)
        })
    })

    it("blocks submit if duplicated product", async () => {
        setHandler(lookups)
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        renderWithProviders(
            <OrderForm mode="create" onSubmit={onSubmit} backHref="/orders" title="Novo" />
        )

        await waitFor(() => expect(screen.getByText(/Margherita G/i)).toBeInTheDocument())
        const user = userEvent.setup()
        await user.selectOptions(screen.getByLabelText(/Unidade/i), UNIT_1)
        await user.click(screen.getByRole("button", { name: /Adicionar item/i }))

        const selects = screen.getAllByRole("combobox").filter((el) =>
            (el as HTMLSelectElement).innerHTML.includes("Margherita")
        )
        await user.selectOptions(selects[0], PROD_1)
        await user.selectOptions(selects[1], PROD_1)

        await user.click(screen.getByRole("button", { name: /Criar pedido/i }))

        await waitFor(() => {
            expect(screen.getByText(/duplicad/i)).toBeInTheDocument()
            expect(onSubmit).not.toHaveBeenCalled()
        })
    })
})
```

- [ ] **Step 3: Rodar suíte**

```bash
cd frontend && npx vitest run
```

Expected: passa.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/\(protected\)/orders/order-form.tsx frontend/tests/order-form.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): shared OrderForm with useFieldArray and live total

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: `/orders/novo` route (consome form)

**Files:**
- Create: `frontend/app/(protected)/orders/novo/page.tsx`

**Why:** Cria pedido em PENDING. OWNER guard.

- [ ] **Step 1: Criar `frontend/app/(protected)/orders/novo/page.tsx`**

```tsx
"use client"

import { OrderForm } from "@/app/(protected)/orders/order-form"
import { NoAccess } from "@/components/no-access"
import { isApiError, useAuth } from "@/lib/auth"
import { useCreateOrder, type CreateOrderInput } from "@/lib/orders"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function NovoPedidoPage() {
    const router = useRouter()
    const { user } = useAuth()
    const create = useCreateOrder()

    if (!user) return null
    if (user.role !== "OWNER") return <NoAccess />

    async function handleSubmit(input: CreateOrderInput) {
        try {
            const order = await create.mutateAsync(input)
            toast.success("Pedido criado.")
            router.replace(`/orders/${order.id}`)
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao criar pedido.")
        }
    }

    return <OrderForm mode="create" onSubmit={handleSubmit} backHref="/orders" title="Novo" />
}
```

- [ ] **Step 2: Verificar build**

```bash
cd frontend && npm run build
```

Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/\(protected\)/orders/novo/page.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): /orders/novo route with OWNER guard

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: `/orders/[id]/editar` route (status guard)

**Files:**
- Create: `frontend/app/(protected)/orders/[id]/editar/page.tsx`

**Why:** Edita pedido. Bloqueia se status ≠ PENDING. OWNER guard.

**Reference:** `frontend/app/(protected)/purchase-orders/[id]/editar/page.tsx`.

- [ ] **Step 1: Criar `frontend/app/(protected)/orders/[id]/editar/page.tsx`**

```tsx
"use client"

import { OrderForm } from "@/app/(protected)/orders/order-form"
import { NoAccess } from "@/components/no-access"
import { Button } from "@/components/ui/button"
import { isApiError, useAuth } from "@/lib/auth"
import {
    useOrder,
    useUpdateOrder,
    type CreateOrderInput,
    type UpdateOrderInput,
} from "@/lib/orders"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"

export default function EditarPedidoPage() {
    const params = useParams<{ id: string }>()
    const id = params.id
    const router = useRouter()
    const { user } = useAuth()
    const orderQuery = useOrder(id)
    const update = useUpdateOrder()

    if (!user) return null
    if (user.role !== "OWNER") return <NoAccess />

    if (orderQuery.isLoading) {
        return <div className="text-sm text-text-secondary">Carregando pedido...</div>
    }

    if (orderQuery.isError || !orderQuery.data) {
        return (
            <div className="space-y-3">
                <p className="text-sm text-danger">Não foi possível carregar o pedido.</p>
                <div className="flex gap-2">
                    <Button onClick={() => orderQuery.refetch()}>Tentar novamente</Button>
                    <Button variant="ghost" onClick={() => router.push("/orders")}>
                        Voltar
                    </Button>
                </div>
            </div>
        )
    }

    const o = orderQuery.data

    if (o.status !== "PENDING") {
        return (
            <div className="space-y-4 rounded-lg border border-border/40 bg-white p-6">
                <h1 className="text-lg font-semibold text-text-primary">
                    Pedido não pode ser editado
                </h1>
                <p className="text-sm text-text-secondary">
                    Este pedido já está {o.status} e não pode mais ser editado.
                </p>
                <Button onClick={() => router.push(`/orders/${id}`)}>Voltar para o pedido</Button>
            </div>
        )
    }

    const defaultValues: CreateOrderInput = {
        unitId: o.unitId,
        notes: o.notes ?? "",
        items: o.items.map((it) => ({ productId: it.productId, quantity: it.quantity })),
    }

    async function handleSubmit(input: UpdateOrderInput) {
        try {
            await update.mutateAsync({ id, input })
            toast.success("Pedido atualizado.")
            router.replace(`/orders/${id}`)
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao atualizar pedido.")
        }
    }

    return (
        <OrderForm
            mode="edit"
            defaultValues={defaultValues}
            onSubmit={handleSubmit}
            backHref={`/orders/${id}`}
            title={`Editar #${id.slice(0, 8)}`}
        />
    )
}
```

- [ ] **Step 2: Verificar build**

```bash
cd frontend && npm run build
```

Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/\(protected\)/orders/\[id\]/editar/page.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): /orders/[id]/editar with status=PENDING guard

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: `/orders` listagem + tests

**Files:**
- Create: `frontend/app/(protected)/orders/page.tsx`
- Create: `frontend/tests/orders-page.test.tsx`

**Why:** Listagem com 4 filtros (status default=PENDING, unidade, from, to). Botão "+ Novo pedido" só OWNER.

**Reference:** `frontend/app/(protected)/purchase-orders/page.tsx`.

- [ ] **Step 1: Criar `frontend/app/(protected)/orders/page.tsx`**

```tsx
"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { useAuth } from "@/lib/auth"
import {
    ORDER_STATUSES,
    useOrders,
    type OrderStatus,
} from "@/lib/orders"
import { useAllUnits } from "@/lib/units"
import { Eye, Pencil, Plus } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

const STATUS_TONE: Record<OrderStatus, "warn" | "info" | "success" | "muted"> = {
    PENDING: "warn",
    IN_PROGRESS: "info",
    COMPLETED: "success",
    CANCELED: "muted",
}

const STATUS_LABEL: Record<OrderStatus, string> = {
    PENDING: "Pendente",
    IN_PROGRESS: "Em preparo",
    COMPLETED: "Concluído",
    CANCELED: "Cancelado",
}

export default function OrdersPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { user } = useAuth()
    const isOwner = user?.role === "OWNER"

    const status = (searchParams.get("status") as OrderStatus | null) ?? "PENDING"
    const unit = searchParams.get("unit") ?? ""
    const from = searchParams.get("from") ?? ""
    const to = searchParams.get("to") ?? ""
    const page = Number(searchParams.get("page") ?? 0)

    function setParam(key: string, value: string) {
        const next = new URLSearchParams(searchParams.toString())
        if (value === "") next.delete(key)
        else next.set(key, value)
        next.delete("page")
        router.replace(`/orders?${next.toString()}`)
    }

    const ordersQuery = useOrders({
        status: status === "ALL" as never ? undefined : (status as OrderStatus),
        unit: unit || undefined,
        from: from ? `${from}T00:00:00` : undefined,
        to: to ? `${to}T23:59:59` : undefined,
        page,
        size: 20,
    })
    const unitsQuery = useAllUnits()

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-text-primary">Pedidos</h1>
                    <p className="text-sm text-text-secondary">
                        Pedidos de cliente com workflow de preparo.
                    </p>
                </div>
                {isOwner ? (
                    <Button onClick={() => router.push("/orders/novo")}>
                        <Plus className="h-4 w-4" /> Novo pedido
                    </Button>
                ) : null}
            </div>

            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border/40 bg-white p-3">
                <label className="flex flex-col text-xs text-text-secondary">
                    Status
                    <select
                        value={status}
                        onChange={(e) => setParam("status", e.target.value)}
                        className="mt-1 h-9 w-40 rounded-md border border-border bg-white px-2 text-sm"
                    >
                        {ORDER_STATUSES.map((s) => (
                            <option key={s} value={s}>
                                {STATUS_LABEL[s]}
                            </option>
                        ))}
                        <option value="ALL">Todos</option>
                    </select>
                </label>
                <label className="flex flex-col text-xs text-text-secondary">
                    Unidade
                    <select
                        value={unit}
                        onChange={(e) => setParam("unit", e.target.value)}
                        className="mt-1 h-9 w-48 rounded-md border border-border bg-white px-2 text-sm"
                    >
                        <option value="">Todas</option>
                        {(unitsQuery.data ?? []).map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex flex-col text-xs text-text-secondary">
                    De
                    <input
                        type="date"
                        value={from}
                        onChange={(e) => setParam("from", e.target.value)}
                        className="mt-1 h-9 w-40 rounded-md border border-border bg-white px-2 text-sm"
                    />
                </label>
                <label className="flex flex-col text-xs text-text-secondary">
                    Até
                    <input
                        type="date"
                        value={to}
                        onChange={(e) => setParam("to", e.target.value)}
                        className="mt-1 h-9 w-40 rounded-md border border-border bg-white px-2 text-sm"
                    />
                </label>
            </div>

            {ordersQuery.isLoading ? (
                <p className="text-sm text-text-secondary">Carregando...</p>
            ) : ordersQuery.isError ? (
                <div className="space-y-2">
                    <p className="text-sm text-danger">Erro ao carregar pedidos.</p>
                    <Button onClick={() => ordersQuery.refetch()}>Tentar novamente</Button>
                </div>
            ) : !ordersQuery.data || ordersQuery.data.data.length === 0 ? (
                <p className="text-sm text-text-secondary">Nenhum pedido encontrado.</p>
            ) : (
                <Table>
                    <THead>
                        <TR>
                            <TH>Nº</TH>
                            <TH>Unidade</TH>
                            <TH>Status</TH>
                            <TH>Itens</TH>
                            <TH>Total</TH>
                            <TH>Criado em</TH>
                            <TH className="text-right">Ações</TH>
                        </TR>
                    </THead>
                    <TBody>
                        {ordersQuery.data.data.map((o) => (
                            <TR key={o.id}>
                                <TD className="font-mono text-xs">{o.id.slice(0, 8)}</TD>
                                <TD>{o.unitName}</TD>
                                <TD>
                                    <Badge tone={STATUS_TONE[o.status]}>
                                        {STATUS_LABEL[o.status]}
                                    </Badge>
                                </TD>
                                <TD>{o.items?.length ?? "—"}</TD>
                                <TD>R$ {o.totalPrice.toFixed(2)}</TD>
                                <TD>
                                    {new Date(o.createdAt).toLocaleString("pt-BR", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </TD>
                                <TD className="text-right">
                                    <div className="inline-flex items-center gap-1">
                                        <Link
                                            href={`/orders/${o.id}`}
                                            className="rounded p-1 text-text-secondary hover:bg-text-primary/5 hover:text-text-primary"
                                            aria-label="Ver detalhes"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Link>
                                        {isOwner && o.status === "PENDING" ? (
                                            <Link
                                                href={`/orders/${o.id}/editar`}
                                                className="rounded p-1 text-text-secondary hover:bg-text-primary/5 hover:text-text-primary"
                                                aria-label="Editar"
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
        </div>
    )
}
```

> **Nota sobre `tone="warn" | "info"`:** se `Badge` não suportar essas tones, ajustar para o set existente (`success`, `danger`, `muted`, etc) — verificar `frontend/components/ui/badge.tsx`.

> **Nota sobre `"ALL"` no select:** o tipo do hook não inclui ALL; o handler do select passa `undefined` quando `status === "ALL"`. O cast `as never` na linha do `useOrders` cobre isso de forma segura.

- [ ] **Step 2: Criar `frontend/tests/orders-page.test.tsx`**

```tsx
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const replaceMock = vi.fn()

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: replaceMock, back: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/orders",
    useParams: () => ({}),
}))

import OrdersPage from "@/app/(protected)/orders/page"
import { tokenStorage } from "@/lib/api"
import { renderWithProviders, resetMockApi, setHandler } from "./helpers"

const ORDER_1 = "11111111-1111-1111-1111-111111111111"

function buildHandler(role: "OWNER" | "EMPLOYEE", status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELED" = "PENDING") {
    return (cfg: { url?: string }) => {
        const url = cfg.url ?? ""
        if (url.endsWith("/users/me")) {
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
        if (url.includes("/units")) {
            return {
                status: 200,
                data: { data: [], page: 0, size: 1000, total: 0 },
            }
        }
        if (url.includes("/orders")) {
            return {
                status: 200,
                data: {
                    data: [
                        {
                            id: ORDER_1,
                            unitId: "u-x",
                            unitName: "Centro",
                            status,
                            totalPrice: 91.8,
                            notes: null,
                            createdById: "u1",
                            startedAt: null,
                            completedAt: null,
                            canceledAt: null,
                            createdAt: "2026-05-06T12:00:00Z",
                            items: [{ id: "i1", productId: "p1", productName: "Margherita G", quantity: 2, unitPrice: 45.9, subtotal: 91.8 }],
                        },
                    ],
                    page: 0,
                    size: 20,
                    total: 1,
                },
            }
        }
        return null
    }
}

describe("OrdersPage", () => {
    beforeEach(() => {
        resetMockApi()
        replaceMock.mockReset()
        tokenStorage.setAccess("a1")
    })

    it("renders order rows for OWNER with edit button when PENDING", async () => {
        setHandler(buildHandler("OWNER", "PENDING"))
        renderWithProviders(<OrdersPage />)

        await waitFor(() => expect(screen.getByText(/11111111/)).toBeInTheDocument())
        expect(screen.getByText(/Pendente/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/Editar/i)).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /Novo pedido/i })).toBeInTheDocument()
    })

    it("hides edit button when status is not PENDING", async () => {
        setHandler(buildHandler("OWNER", "IN_PROGRESS"))
        renderWithProviders(<OrdersPage />)

        await waitFor(() => expect(screen.getByText(/11111111/)).toBeInTheDocument())
        expect(screen.queryByLabelText(/Editar/i)).not.toBeInTheDocument()
    })

    it("hides new-order button for EMPLOYEE", async () => {
        setHandler(buildHandler("EMPLOYEE", "PENDING"))
        renderWithProviders(<OrdersPage />)

        await waitFor(() => expect(screen.getByText(/11111111/)).toBeInTheDocument())
        expect(screen.queryByRole("button", { name: /Novo pedido/i })).not.toBeInTheDocument()
    })

    it("status filter change updates URL", async () => {
        setHandler(buildHandler("OWNER", "PENDING"))
        renderWithProviders(<OrdersPage />)

        await waitFor(() => expect(screen.getByText(/11111111/)).toBeInTheDocument())
        const statusSelect = screen.getByLabelText(/Status/i)
        const user = userEvent.setup()
        await user.selectOptions(statusSelect, "COMPLETED")

        await waitFor(() => {
            expect(replaceMock).toHaveBeenCalled()
            const arg = replaceMock.mock.calls[replaceMock.mock.calls.length - 1][0] as string
            expect(arg).toContain("status=COMPLETED")
        })
    })
})
```

- [ ] **Step 3: Rodar suíte**

```bash
cd frontend && npx vitest run
```

Expected: passa.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/\(protected\)/orders/page.tsx frontend/tests/orders-page.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): /orders listing with status filter (default PENDING)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: `/orders/[id]` detalhe + tests (start/complete/cancel)

**Files:**
- Create: `frontend/app/(protected)/orders/[id]/page.tsx`
- Create: `frontend/tests/order-detail-page.test.tsx`

**Why:** Detalhe com 2 cards (Dados + Itens) e ações condicionais por status. ConfirmDialog para start/complete/cancel.

**Reference:** `frontend/app/(protected)/purchase-orders/[id]/page.tsx` (estrutura idêntica de ações condicionais).

- [ ] **Step 1: Criar `frontend/app/(protected)/orders/[id]/page.tsx`**

```tsx
"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/overlays/confirm-dialog"
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { isApiError, useAuth } from "@/lib/auth"
import {
    useCancelOrder,
    useCompleteOrder,
    useOrder,
    useStartOrder,
    type OrderStatus,
} from "@/lib/orders"
import { CheckCircle2, Pencil, Play, X } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

type ActionKind = "start" | "complete" | "cancel" | null

const STATUS_TONE: Record<OrderStatus, "warn" | "info" | "success" | "muted"> = {
    PENDING: "warn",
    IN_PROGRESS: "info",
    COMPLETED: "success",
    CANCELED: "muted",
}

const STATUS_LABEL: Record<OrderStatus, string> = {
    PENDING: "Pendente",
    IN_PROGRESS: "Em preparo",
    COMPLETED: "Concluído",
    CANCELED: "Cancelado",
}

export default function OrderDetailPage() {
    const params = useParams<{ id: string }>()
    const id = params.id
    const router = useRouter()
    const { user } = useAuth()
    const isOwner = user?.role === "OWNER"
    const orderQuery = useOrder(id)
    const start = useStartOrder()
    const complete = useCompleteOrder()
    const cancel = useCancelOrder()
    const [actionKind, setActionKind] = useState<ActionKind>(null)

    if (orderQuery.isLoading) {
        return <div className="text-sm text-text-secondary">Carregando pedido...</div>
    }
    if (orderQuery.isError || !orderQuery.data) {
        return (
            <div className="space-y-3">
                <p className="text-sm text-danger">Não foi possível carregar o pedido.</p>
                <Button onClick={() => orderQuery.refetch()}>Tentar novamente</Button>
            </div>
        )
    }

    const o = orderQuery.data

    async function runAction() {
        if (!actionKind) return
        try {
            if (actionKind === "start") {
                await start.mutateAsync(id)
                toast.success("Pedido iniciado.")
            } else if (actionKind === "complete") {
                await complete.mutateAsync(id)
                toast.success("Pedido concluído.")
            } else if (actionKind === "cancel") {
                await cancel.mutateAsync(id)
                toast.success("Pedido cancelado.")
            }
            setActionKind(null)
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao executar ação.")
        }
    }

    const dialogConfig: Record<NonNullable<ActionKind>, { title: string; description: string; confirmLabel: string }> = {
        start: {
            title: "Iniciar pedido",
            description:
                "Iniciar este pedido? Os ingredientes serão descontados do estoque conforme as fichas técnicas, e a ação não pode ser desfeita.",
            confirmLabel: "Iniciar",
        },
        complete: {
            title: "Concluir pedido",
            description: "Marcar este pedido como concluído?",
            confirmLabel: "Concluir",
        },
        cancel: {
            title: "Cancelar pedido",
            description: "Cancelar este pedido? A ação não pode ser desfeita.",
            confirmLabel: "Cancelar pedido",
        },
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <p className="text-xs text-text-secondary">Pedidos › #{o.id.slice(0, 8)}</p>
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-semibold text-text-primary">
                            Pedido #{o.id.slice(0, 8)}
                        </h1>
                        <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                    </div>
                </div>
                {isOwner ? (
                    <div className="flex gap-2">
                        {o.status === "PENDING" ? (
                            <>
                                <Link href={`/orders/${id}/editar`}>
                                    <Button variant="ghost">
                                        <Pencil className="h-4 w-4" /> Editar
                                    </Button>
                                </Link>
                                <Button onClick={() => setActionKind("start")}>
                                    <Play className="h-4 w-4" /> Iniciar
                                </Button>
                                <Button variant="ghost" onClick={() => setActionKind("cancel")}>
                                    <X className="h-4 w-4" /> Cancelar
                                </Button>
                            </>
                        ) : null}
                        {o.status === "IN_PROGRESS" ? (
                            <Button onClick={() => setActionKind("complete")}>
                                <CheckCircle2 className="h-4 w-4" /> Concluir
                            </Button>
                        ) : null}
                    </div>
                ) : null}
            </div>

            <section className="space-y-3 rounded-lg border border-border/40 bg-white p-4">
                <h2 className="text-sm font-medium text-text-primary">Dados do pedido</h2>
                <dl className="grid gap-3 text-sm md:grid-cols-2">
                    <div>
                        <dt className="text-text-secondary">Unidade</dt>
                        <dd className="text-text-primary">{o.unitName}</dd>
                    </div>
                    <div>
                        <dt className="text-text-secondary">Criado em</dt>
                        <dd className="text-text-primary">
                            {new Date(o.createdAt).toLocaleString("pt-BR")}
                        </dd>
                    </div>
                    {o.startedAt ? (
                        <div>
                            <dt className="text-text-secondary">Iniciado em</dt>
                            <dd className="text-text-primary">
                                {new Date(o.startedAt).toLocaleString("pt-BR")}
                            </dd>
                        </div>
                    ) : null}
                    {o.completedAt ? (
                        <div>
                            <dt className="text-text-secondary">Concluído em</dt>
                            <dd className="text-text-primary">
                                {new Date(o.completedAt).toLocaleString("pt-BR")}
                            </dd>
                        </div>
                    ) : null}
                    {o.canceledAt ? (
                        <div>
                            <dt className="text-text-secondary">Cancelado em</dt>
                            <dd className="text-text-primary">
                                {new Date(o.canceledAt).toLocaleString("pt-BR")}
                            </dd>
                        </div>
                    ) : null}
                    <div className="md:col-span-2">
                        <dt className="text-text-secondary">Observações</dt>
                        <dd className="text-text-primary">{o.notes ?? "—"}</dd>
                    </div>
                </dl>
            </section>

            <section className="space-y-3 rounded-lg border border-border/40 bg-white p-4">
                <h2 className="text-sm font-medium text-text-primary">Itens</h2>
                <Table>
                    <THead>
                        <TR>
                            <TH>Produto</TH>
                            <TH>Qtd</TH>
                            <TH>Preço unit.</TH>
                            <TH>Subtotal</TH>
                        </TR>
                    </THead>
                    <TBody>
                        {o.items.map((it) => (
                            <TR key={it.id}>
                                <TD>{it.productName}</TD>
                                <TD>{it.quantity}</TD>
                                <TD>R$ {it.unitPrice.toFixed(2)}</TD>
                                <TD>R$ {it.subtotal.toFixed(2)}</TD>
                            </TR>
                        ))}
                    </TBody>
                </Table>
                <div className="border-t border-border/40 pt-3 text-right text-sm font-medium">
                    Total: R$ {o.totalPrice.toFixed(2)}
                </div>
            </section>

            <ConfirmDialog
                open={!!actionKind}
                title={actionKind ? dialogConfig[actionKind].title : ""}
                description={actionKind ? dialogConfig[actionKind].description : ""}
                confirmLabel={actionKind ? dialogConfig[actionKind].confirmLabel : ""}
                onConfirm={runAction}
                onCancel={() => setActionKind(null)}
            />
        </div>
    )
}
```

- [ ] **Step 2: Criar `frontend/tests/order-detail-page.test.tsx`**

```tsx
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/orders/o1",
    useParams: () => ({ id: "11111111-1111-1111-1111-111111111111" }),
}))

import OrderDetailPage from "@/app/(protected)/orders/[id]/page"
import { tokenStorage } from "@/lib/api"
import { getCalls, renderWithProviders, resetMockApi, setHandler } from "./helpers"

const ORDER = "11111111-1111-1111-1111-111111111111"

function detail(status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELED") {
    return {
        id: ORDER,
        unitId: "u-x",
        unitName: "Centro",
        status,
        totalPrice: 91.8,
        notes: null,
        createdById: "u1",
        startedAt: status === "PENDING" ? null : "2026-05-06T12:30:00Z",
        completedAt: status === "COMPLETED" ? "2026-05-06T13:00:00Z" : null,
        canceledAt: status === "CANCELED" ? "2026-05-06T12:35:00Z" : null,
        createdAt: "2026-05-06T12:00:00Z",
        items: [{ id: "i1", productId: "p1", productName: "Margherita G", quantity: 2, unitPrice: 45.9, subtotal: 91.8 }],
    }
}

function buildHandler(role: "OWNER" | "EMPLOYEE", status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELED") {
    return (cfg: { url?: string; method?: string }) => {
        const url = cfg.url ?? ""
        const method = (cfg.method ?? "GET").toUpperCase()
        if (url.endsWith("/users/me")) {
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
        if (url.includes(`/orders/${ORDER}/start`) && method === "POST") {
            return { status: 200, data: { data: detail("IN_PROGRESS") } }
        }
        if (url.includes(`/orders/${ORDER}/complete`) && method === "POST") {
            return { status: 200, data: { data: detail("COMPLETED") } }
        }
        if (url.includes(`/orders/${ORDER}/cancel`) && method === "POST") {
            return { status: 200, data: { data: detail("CANCELED") } }
        }
        if (url.includes(`/orders/${ORDER}`)) {
            return { status: 200, data: { data: detail(status) } }
        }
        return null
    }
}

describe("OrderDetailPage", () => {
    beforeEach(() => {
        resetMockApi()
        tokenStorage.setAccess("a1")
    })

    it("PENDING + OWNER shows Editar/Iniciar/Cancelar", async () => {
        setHandler(buildHandler("OWNER", "PENDING"))
        renderWithProviders(<OrderDetailPage />)

        await waitFor(() => expect(screen.getByText(/Pedido #11111111/)).toBeInTheDocument())
        expect(screen.getByRole("link", { name: /Editar/i })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /Iniciar/i })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /Cancelar/i })).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Concluir/i })).not.toBeInTheDocument()
    })

    it("IN_PROGRESS + OWNER shows only Concluir", async () => {
        setHandler(buildHandler("OWNER", "IN_PROGRESS"))
        renderWithProviders(<OrderDetailPage />)

        await waitFor(() => expect(screen.getByText(/Pedido #11111111/)).toBeInTheDocument())
        expect(screen.getByRole("button", { name: /Concluir/i })).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Iniciar/i })).not.toBeInTheDocument()
    })

    it("COMPLETED shows no actions", async () => {
        setHandler(buildHandler("OWNER", "COMPLETED"))
        renderWithProviders(<OrderDetailPage />)

        await waitFor(() => expect(screen.getByText(/Pedido #11111111/)).toBeInTheDocument())
        expect(screen.queryByRole("button", { name: /Iniciar/i })).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Concluir/i })).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Cancelar/i })).not.toBeInTheDocument()
    })

    it("EMPLOYEE never sees mutating actions", async () => {
        setHandler(buildHandler("EMPLOYEE", "PENDING"))
        renderWithProviders(<OrderDetailPage />)

        await waitFor(() => expect(screen.getByText(/Pedido #11111111/)).toBeInTheDocument())
        expect(screen.queryByRole("button", { name: /Iniciar/i })).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Concluir/i })).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Cancelar/i })).not.toBeInTheDocument()
    })

    it("clicking Iniciar opens dialog and triggers POST /start", async () => {
        setHandler(buildHandler("OWNER", "PENDING"))
        renderWithProviders(<OrderDetailPage />)

        await waitFor(() => expect(screen.getByText(/Pedido #11111111/)).toBeInTheDocument())
        const user = userEvent.setup()
        await user.click(screen.getByRole("button", { name: /Iniciar/i }))

        await waitFor(() => expect(screen.getByText(/serão descontados/i)).toBeInTheDocument())

        const confirmBtn = screen.getAllByRole("button", { name: /Iniciar/i }).pop()!
        await user.click(confirmBtn)

        await waitFor(() => {
            const calls = getCalls()
            expect(
                calls.some((c) => (c.url ?? "").includes(`/orders/${ORDER}/start`))
            ).toBe(true)
        })
    })
})
```

- [ ] **Step 3: Rodar suíte**

```bash
cd frontend && npx vitest run
```

Expected: passa.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/\(protected\)/orders/\[id\]/page.tsx frontend/tests/order-detail-page.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): /orders/[id] detail with start/complete/cancel actions

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Sanity final — full test run + build + smoke navigation

**Files:** nenhum (verificação)

**Why:** Validar que tudo está integrado e a sidebar (que já tinha as entradas) navega sem 404 em ambas as rotas. Confirmar build limpa antes de abrir PR.

- [ ] **Step 1: Rodar a suíte completa**

```bash
cd frontend && npx vitest run
```

Expected: 100% verde, incluindo todos os tests novos do SP3.

- [ ] **Step 2: Build de produção**

```bash
cd frontend && npm run build
```

Expected: build passa sem warnings novos.

- [ ] **Step 3: Smoke navigation manual** (com backend SP3 rodando: `docker-compose up -d` no `backend/` + `mvnw.cmd spring-boot:run`)

Subir o frontend dev (`cd frontend && npm run dev`) e validar manualmente:

1. Login como OWNER (via `/auth`).
2. Sidebar leva a `/products` e `/orders` sem 404.
3. Criar produto com 1 ingrediente → redireciona ao detalhe → ficha técnica visível.
4. Editar produto → trocar ingrediente → salvar → ficha atualiza.
5. Desativar produto → some da listagem com filtro `Ativo=Sim`.
6. Criar pedido com 1 produto → redireciona ao detalhe.
7. Iniciar pedido pendente → ConfirmDialog → confirmar → status muda para IN_PROGRESS; abrir `/stock` → saldos do(s) ingrediente(s) caíram; abrir `/stock-movements` → EXIT(s) registradas.
8. Concluir pedido em preparo → status COMPLETED.
9. Criar outro pedido pendente → cancelar → status CANCELED, estoque inalterado.
10. Login como EMPLOYEE → confirmar que os botões de ação não aparecem em nenhum dos 2 módulos.

- [ ] **Step 4: Push e abrir PR**

```bash
git push -u origin feat/sp3-frontend-products-orders
```

Abrir PR contra `main` com título `feat(sp3): frontend products + orders` e cobrir no body:
- Lista das rotas novas (`/products` e `/orders` + sub-rotas).
- Decisões-chave (default `status=PENDING`, simple ConfirmDialog para Iniciar, sem preview de impacto).
- Test plan (rodar `npx vitest run`, build, smoke manual descrito acima).

---

## Self-review notes

Cobertura da spec contra tarefas:
- Sidebar 2 entradas — confirmado já existir (notas iniciais); validado em Task 13.
- `/products` listagem com filtros (categoria, tamanho, ativo) — Task 5.
- `/products` rotas dedicadas (nova, [id], [id]/editar) — Tasks 3, 4, 6.
- Form de produto com `useFieldArray` para ficha técnica — Task 2.
- Validação client-side: ≥1 ingrediente, sem duplicados — Task 1 (schema) + Task 2 (form).
- `useAllCategories` — confirmado já existir (notas iniciais).
- `useAllProducts` (não paginado) — Task 1.
- `/orders` listagem com filtros (status default PENDING, unidade, datas) — Task 11.
- `/orders` rotas dedicadas (novo, [id], [id]/editar) — Tasks 9, 10, 12.
- Form de pedido com `useFieldArray` + total client-side — Task 8.
- Edição bloqueada se status ≠ PENDING — Task 10.
- ConfirmDialogs para start/complete/cancel — Task 12.
- Toast-only para erros de mutation — Tasks 3, 4, 5, 6, 9, 10, 12.
- EMPLOYEE bloqueado em rotas OWNER e ações mutativas — Tasks 3, 4, 9, 10 (`<NoAccess />`); Tasks 5, 11, 12 (botões condicionais ao role).
- Schema tests para products + orders — Tasks 1, 7.
- Page tests para listagens e detalhes — Tasks 5, 6, 11, 12.
- Form tests com cenários inclusos (default state, add/remove, submit, duplicate rejection) — Tasks 2, 8.
