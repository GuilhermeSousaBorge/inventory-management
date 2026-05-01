# SP1 Frontend — Categories + Suppliers + Ingredients Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar CRUD frontend de Categorias, Fornecedores e Ingredientes,
fechando o pareamento do SP1 frontend com o backend.

**Architecture:** Espelhar 1:1 os padrões já estabelecidos em `lib/users.ts`,
`lib/units.ts`, `app/(protected)/users/`, `app/(protected)/units/` e nos testes
existentes. Categories e Suppliers usam modal CRUD; Ingredients usa rotas
dedicadas para create/edit por causa do tamanho do form (8 campos, 2 selects de
FK). Filtros de Ingredient persistem na URL via querystring. Resolução de FKs
(categoryId/defaultSupplierId → nome) é client-side, reaproveitando as queries
que alimentam os selects.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, axios,
TanStack Query v5, react-hook-form, zod (`@hookform/resolvers/zod`), sonner,
Tailwind v4, lucide-react. Testes: Vitest + jsdom + @testing-library/react.

**Reference spec:** `frontend/docs/superpowers/specs/2026-05-01-sp1-frontend-categories-suppliers-ingredients-design.md`

---

## Convenções importantes do projeto (ler antes de começar)

1. **Diretório de trabalho:** todos os comandos rodam a partir de `frontend/`.
   Usar `cd frontend && <comando>` ou rodar com PWD apontando pra lá.

2. **Localização de testes:** `frontend/tests/` com glob `tests/**/*.test.{ts,tsx}`.
   - Schemas de zod: extender `tests/schemas.test.ts` (não criar arquivos novos).
   - Testes de página: criar `tests/<recurso>-page.test.tsx`.
   - **Não** criar `tests/lib/...` ou `tests/app/...` — o vitest.config não
     cria subpastas; é tudo flat.

3. **Helpers de teste:** `frontend/tests/helpers.tsx` exporta:
   - `setHandler(fn)` — define o mock da resposta HTTP.
   - `getCalls()` — array de requests interceptadas.
   - `resetMockApi()` — reseta handler+calls+localStorage e instala o adapter.
   - `renderWithProviders(ui)` — render com `QueryClientProvider` + `AuthProvider`.

4. **Mock do `next/navigation`** em testes de páginas:
   ```ts
   vi.mock("next/navigation", () => ({
     useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
     useSearchParams: () => new URLSearchParams(),
     usePathname: () => "/categories",
   }))
   ```
   Pode (e deve) variar `usePathname` por arquivo de teste.

5. **Envelope da resposta:** o interceptor do axios desembrulha `{ data: x }` →
   `x` para single-resource; mantém `{ data, page, size, total }` intacto para
   listas paginadas. Os mocks de teste devem retornar com `data` por dentro
   conforme o caso (ver `users-page.test.tsx`).

6. **Mensagens de erro em PT** nos zod schemas: `z.string().min(1, "Informe o nome")`.

7. **Indentação:** o projeto usa **4 espaços** (ver arquivos existentes). Respeitar.

8. **Imports com alias `@/`:** `@/lib/api`, `@/components/ui/...`, etc.

9. **Componentes de UI já existentes** (em `frontend/components/`):
   - `ui/button.tsx`, `ui/input.tsx`, `ui/field.tsx`, `ui/select.tsx`,
     `ui/badge.tsx`, `ui/table.tsx`
   - `overlays/modal.tsx`, `overlays/confirm-dialog.tsx`

10. **Sidebar** (`app/(protected)/layout.tsx`) já tem links pra `/categories`,
    `/ingredients`, `/suppliers`. Não mexer.

11. **Tratamento de erro:** mutações fazem `try { await mutateAsync(); toast.success } catch (err) { if (isApiError(err)) toast.error(err.message); else toast.error("...") }`. `isApiError` vem de `@/lib/auth`.

12. **Commits:** mensagem em pt/inglês mistos seguindo o padrão `feat(frontend): ...` ou `test(frontend): ...`. Co-author do Claude no rodapé do commit (ver histórico).

---

## Estrutura de arquivos (resultado final)

```
frontend/
├─ lib/
│  ├─ categories.ts                                   [NOVO]
│  ├─ suppliers.ts                                    [NOVO]
│  └─ ingredients.ts                                  [NOVO]
├─ app/(protected)/
│  ├─ categories/
│  │  ├─ page.tsx                                     [NOVO]
│  │  └─ category-dialog.tsx                          [NOVO]
│  ├─ suppliers/
│  │  ├─ page.tsx                                     [NOVO]
│  │  └─ supplier-dialog.tsx                          [NOVO]
│  └─ ingredients/
│     ├─ page.tsx                                     [NOVO]
│     ├─ ingredient-form.tsx                          [NOVO] (form compartilhado)
│     ├─ novo/page.tsx                                [NOVO]
│     └─ [id]/editar/page.tsx                         [NOVO]
└─ tests/
   ├─ schemas.test.ts                                 [MODIFICAR — adicionar describes]
   ├─ categories-page.test.tsx                        [NOVO]
   ├─ suppliers-page.test.tsx                         [NOVO]
   └─ ingredients-page.test.tsx                       [NOVO]
```

---

## Ordem de execução

```
1. Categories lib + tests
2. Categories page + dialog + page tests
3. Suppliers lib + tests
4. Suppliers page + dialog + page tests
5. Ingredients lib + tests
6. Ingredients form (componente compartilhado)
7. Ingredients novo + editar (rotas)
8. Ingredients lista + page tests
9. Sanity final: full test run + build
```

Ingredients depende de Categories+Suppliers (selects de FK), por isso vem
depois.

---

## Task 1: lib/categories.ts (types + schemas + hooks)

**Files:**
- Create: `frontend/lib/categories.ts`
- Modify: `frontend/tests/schemas.test.ts` (adicionar describes)

**Why:** Categorias é o módulo mais simples (2 campos). Estabelece o padrão de
hooks e schemas para o módulo de Suppliers e Ingredients que vêm depois.

- [ ] **Step 1: Adicionar testes de schema (failing) ao final de `frontend/tests/schemas.test.ts`**

Adicionar imports no topo (juntar com os imports já existentes):

```ts
import { createCategorySchema, updateCategorySchema } from "@/lib/categories"
```

Adicionar no fim do arquivo:

```ts
describe("createCategorySchema", () => {
    it("accepts a name with empty description", () => {
        const r = createCategorySchema.safeParse({ name: "Massas", description: "" })
        expect(r.success).toBe(true)
    })

    it("accepts a name with valid description", () => {
        const r = createCategorySchema.safeParse({
            name: "Massas",
            description: "Farinhas e variações",
        })
        expect(r.success).toBe(true)
    })

    it("rejects empty name", () => {
        const r = createCategorySchema.safeParse({ name: "", description: "" })
        expect(r.success).toBe(false)
    })

    it("rejects name > 100 chars", () => {
        const r = createCategorySchema.safeParse({
            name: "x".repeat(101),
            description: "",
        })
        expect(r.success).toBe(false)
    })

    it("rejects description > 255 chars", () => {
        const r = createCategorySchema.safeParse({
            name: "Massas",
            description: "x".repeat(256),
        })
        expect(r.success).toBe(false)
    })
})

describe("updateCategorySchema", () => {
    it("has the same shape as create", () => {
        const r = updateCategorySchema.safeParse({ name: "Massas", description: "" })
        expect(r.success).toBe(true)
    })
})
```

- [ ] **Step 2: Rodar os testes de schema — devem falhar (módulo não existe)**

```bash
cd frontend && npx vitest run tests/schemas.test.ts
```

Expected: erro de import "Cannot find module '@/lib/categories'" (ou similar).

- [ ] **Step 3: Criar `frontend/lib/categories.ts` com types + schemas + hooks**

```ts
import { api } from "@/lib/api"
import type { Page } from "@/lib/users"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

export type Category = {
    id: string
    name: string
    description: string | null
    createdAt: string
}

export const createCategorySchema = z.object({
    name: z.string().min(1, "Informe o nome").max(100),
    description: z.string().max(255).optional().or(z.literal("")),
})
export type CreateCategoryInput = z.infer<typeof createCategorySchema>

export const updateCategorySchema = createCategorySchema
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>

export function useCategories(page = 0, size = 20) {
    return useQuery({
        queryKey: ["categories", page, size],
        queryFn: () =>
            api
                .get<Page<Category>>("/categories", { params: { page, size } })
                .then((r) => r.data),
    })
}

export function useAllCategories() {
    return useQuery({
        queryKey: ["categories", "all"],
        queryFn: () =>
            api
                .get<Page<Category>>("/categories", { params: { page: 0, size: 1000 } })
                .then((r) => r.data.data),
        staleTime: 5 * 60 * 1000,
    })
}

export function useCategory(id: string) {
    return useQuery({
        queryKey: ["categories", id],
        queryFn: () => api.get<Category>(`/categories/${id}`).then((r) => r.data),
        enabled: !!id,
    })
}

export function useCreateCategory() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (input: CreateCategoryInput) =>
            api.post<Category>("/categories", input).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
    })
}

export function useUpdateCategory() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: UpdateCategoryInput }) =>
            api.put<Category>(`/categories/${id}`, input).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
    })
}

export function useDeleteCategory() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => api.delete(`/categories/${id}`).then(() => undefined),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
    })
}
```

- [ ] **Step 4: Rodar testes de schema — devem passar**

```bash
cd frontend && npx vitest run tests/schemas.test.ts
```

Expected: todos os describes passam, incluindo os de Categories.

- [ ] **Step 5: Rodar a suíte completa para garantir não-regressão**

```bash
cd frontend && npx vitest run
```

Expected: todos passam.

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/categories.ts frontend/tests/schemas.test.ts
git commit -m "$(cat <<'EOF'
feat(frontend): categories types, schemas and TanStack hooks

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: app/(protected)/categories — page + dialog + tests

**Files:**
- Create: `frontend/app/(protected)/categories/page.tsx`
- Create: `frontend/app/(protected)/categories/category-dialog.tsx`
- Create: `frontend/tests/categories-page.test.tsx`

**Why:** Tela de listagem com modal create/edit + delete com tratamento de 409
amigável.

- [ ] **Step 1: Criar `frontend/tests/categories-page.test.tsx` (failing)**

```tsx
import { screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/categories",
}))

import CategoriesPage from "@/app/(protected)/categories/page"
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

describe("CategoriesPage", () => {
    it("EMPLOYEE sees rows but no create button", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("EMPLOYEE")
            if (url.includes("/categories") && cfg.method === "get") {
                return {
                    status: 200,
                    data: {
                        data: [
                            { id: "c1", name: "Massas", description: null, createdAt: "2026-01-01T00:00:00Z" },
                        ],
                        page: 0,
                        size: 20,
                        total: 1,
                    },
                }
            }
            return { status: 500 }
        })
        renderWithProviders(<CategoriesPage />)
        await waitFor(() => expect(screen.getByText("Massas")).toBeInTheDocument())
        expect(screen.queryByRole("button", { name: /nova categoria/i })).not.toBeInTheDocument()
    })

    it("OWNER with empty list sees empty state and create CTA", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("OWNER")
            if (url.includes("/categories") && cfg.method === "get") {
                return { status: 200, data: { data: [], page: 0, size: 20, total: 0 } }
            }
            return { status: 500 }
        })
        renderWithProviders(<CategoriesPage />)
        await waitFor(() =>
            expect(screen.getByText(/nenhuma categoria cadastrada/i)).toBeInTheDocument(),
        )
        expect(screen.getByRole("button", { name: /criar primeira categoria/i })).toBeInTheDocument()
    })

    it("OWNER with rows sees create button", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("OWNER")
            if (url.includes("/categories") && cfg.method === "get") {
                return {
                    status: 200,
                    data: {
                        data: [
                            { id: "c1", name: "Massas", description: "Farinhas", createdAt: "2026-01-01T00:00:00Z" },
                        ],
                        page: 0,
                        size: 20,
                        total: 1,
                    },
                }
            }
            return { status: 500 }
        })
        renderWithProviders(<CategoriesPage />)
        await waitFor(() => expect(screen.getByText("Massas")).toBeInTheDocument())
        expect(screen.getByRole("button", { name: /nova categoria/i })).toBeInTheDocument()
        expect(screen.getByText("Farinhas")).toBeInTheDocument()
    })
})
```

- [ ] **Step 2: Rodar — devem falhar (page não existe)**

```bash
cd frontend && npx vitest run tests/categories-page.test.tsx
```

Expected: erro de import "Cannot find module '@/app/(protected)/categories/page'".

- [ ] **Step 3: Criar `frontend/app/(protected)/categories/category-dialog.tsx`**

```tsx
"use client"

import { Modal } from "@/components/overlays/modal"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { isApiError } from "@/lib/auth"
import {
    createCategorySchema,
    updateCategorySchema,
    useCreateCategory,
    useUpdateCategory,
    type Category,
    type CreateCategoryInput,
    type UpdateCategoryInput,
} from "@/lib/categories"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

type Props = {
    open: boolean
    onClose: () => void
    category: Category | null
}

export function CategoryDialog({ open, onClose, category }: Props) {
    const editing = !!category
    const create = useCreateCategory()
    const update = useUpdateCategory()

    const form = useForm<CreateCategoryInput | UpdateCategoryInput>({
        resolver: zodResolver(editing ? updateCategorySchema : createCategorySchema),
        defaultValues: editing
            ? { name: category.name, description: category.description ?? "" }
            : { name: "", description: "" },
    })

    useEffect(() => {
        if (open) {
            form.reset(
                editing
                    ? { name: category.name, description: category.description ?? "" }
                    : { name: "", description: "" },
            )
        }
    }, [open, editing, category, form])

    async function onSubmit(values: CreateCategoryInput | UpdateCategoryInput) {
        try {
            if (editing) {
                await update.mutateAsync({ id: category.id, input: values as UpdateCategoryInput })
                toast.success("Categoria atualizada")
            } else {
                await create.mutateAsync(values as CreateCategoryInput)
                toast.success("Categoria criada")
            }
            onClose()
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao salvar categoria")
        }
    }

    const submitting = create.isPending || update.isPending

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={editing ? "Editar categoria" : "Nova categoria"}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" form="category-form" disabled={submitting}>
                        {submitting ? "Salvando..." : "Salvar"}
                    </Button>
                </>
            }
        >
            <form id="category-form" className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                <Field
                    label="Nome"
                    htmlFor="category-name"
                    error={form.formState.errors.name?.message}
                >
                    <Input id="category-name" {...form.register("name")} />
                </Field>
                <Field
                    label="Descrição"
                    htmlFor="category-description"
                    error={form.formState.errors.description?.message}
                >
                    <Input id="category-description" {...form.register("description")} />
                </Field>
            </form>
        </Modal>
    )
}
```

- [ ] **Step 4: Criar `frontend/app/(protected)/categories/page.tsx`**

```tsx
"use client"

import { ConfirmDialog } from "@/components/overlays/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { isApiError, useAuth } from "@/lib/auth"
import { useCategories, useDeleteCategory, type Category } from "@/lib/categories"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { CategoryDialog } from "./category-dialog"

export default function CategoriesPage() {
    const { user } = useAuth()
    const isOwner = user?.role === "OWNER"
    const [page, setPage] = useState(0)
    const size = 20
    const categoriesQuery = useCategories(page, size)

    const [dialogOpen, setDialogOpen] = useState(false)
    const [editing, setEditing] = useState<Category | null>(null)
    const [confirm, setConfirm] = useState<Category | null>(null)
    const remove = useDeleteCategory()

    const data = categoriesQuery.data
    const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1

    async function onConfirm() {
        if (!confirm) return
        try {
            await remove.mutateAsync(confirm.id)
            toast.success("Categoria removida")
            setConfirm(null)
        } catch (err) {
            if (isApiError(err)) {
                if (err.status === 409 || err.status === 400) {
                    toast.error("Não é possível remover: existem ingredientes nesta categoria.")
                } else {
                    toast.error(err.message)
                }
            } else {
                toast.error("Erro ao remover categoria")
            }
        }
    }

    return (
        <div className="space-y-6">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-text-primary">Categorias</h1>
                    <p className="mt-1 text-sm text-text-secondary">
                        Agrupamentos para os ingredientes da pizzaria.
                    </p>
                </div>
                {isOwner ? (
                    <Button
                        onClick={() => {
                            setEditing(null)
                            setDialogOpen(true)
                        }}
                    >
                        <Plus className="mr-2 h-4 w-4" /> Nova categoria
                    </Button>
                ) : null}
            </header>

            {categoriesQuery.isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-12 animate-pulse rounded-lg bg-text-primary/5" />
                    ))}
                </div>
            ) : categoriesQuery.isError ? (
                <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
                    <p className="text-sm text-danger">Falha ao carregar categorias.</p>
                    <Button variant="ghost" size="sm" onClick={() => categoriesQuery.refetch()}>
                        Tentar novamente
                    </Button>
                </div>
            ) : data && data.data.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                    <p className="text-sm text-text-secondary">Nenhuma categoria cadastrada.</p>
                    {isOwner ? (
                        <Button
                            className="mt-4"
                            onClick={() => {
                                setEditing(null)
                                setDialogOpen(true)
                            }}
                        >
                            Criar primeira categoria
                        </Button>
                    ) : null}
                </div>
            ) : (
                <Table>
                    <THead>
                        <TR>
                            <TH>Nome</TH>
                            <TH>Descrição</TH>
                            {isOwner ? <TH className="w-px text-right">Ações</TH> : null}
                        </TR>
                    </THead>
                    <TBody>
                        {data!.data.map((c) => (
                            <TR key={c.id}>
                                <TD>{c.name}</TD>
                                <TD className="max-w-[420px] truncate">{c.description ?? "—"}</TD>
                                {isOwner ? (
                                    <TD className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditing(c)
                                                    setDialogOpen(true)
                                                }}
                                                className="rounded p-1.5 text-text-primary/70 hover:bg-text-primary/5 hover:text-text-primary"
                                                aria-label={`Editar ${c.name}`}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setConfirm(c)}
                                                className="rounded p-1.5 text-danger/80 hover:bg-danger/10"
                                                aria-label={`Remover ${c.name}`}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </TD>
                                ) : null}
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

            {isOwner ? (
                <CategoryDialog
                    open={dialogOpen}
                    onClose={() => setDialogOpen(false)}
                    category={editing}
                />
            ) : null}

            <ConfirmDialog
                open={!!confirm}
                onClose={() => setConfirm(null)}
                onConfirm={onConfirm}
                title="Remover categoria"
                message={confirm ? `Confirma remover ${confirm.name}? Esta ação não pode ser desfeita.` : ""}
                confirmLabel="Remover"
                confirmVariant="danger"
                loading={remove.isPending}
            />
        </div>
    )
}
```

- [ ] **Step 5: Rodar testes específicos da página — devem passar**

```bash
cd frontend && npx vitest run tests/categories-page.test.tsx
```

Expected: 3 describes verdes.

- [ ] **Step 6: Rodar suíte completa**

```bash
cd frontend && npx vitest run
```

Expected: todos passam, sem regressão.

- [ ] **Step 7: Commit**

```bash
git add frontend/app/\(protected\)/categories frontend/tests/categories-page.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): /categories CRUD with friendly delete error on 409

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: lib/suppliers.ts (types + schemas + hooks)

**Files:**
- Create: `frontend/lib/suppliers.ts`
- Modify: `frontend/tests/schemas.test.ts`

**Why:** Mesmo padrão de Categories. Suppliers tem mais campos, todos opcionais
exceto `name`. E-mail aceita string vazia (campo opcional).

- [ ] **Step 1: Adicionar testes de schema (failing) ao `frontend/tests/schemas.test.ts`**

Adicionar import:

```ts
import { createSupplierSchema, updateSupplierSchema } from "@/lib/suppliers"
```

Adicionar describes ao final:

```ts
describe("createSupplierSchema", () => {
    it("accepts only name (other fields empty)", () => {
        const r = createSupplierSchema.safeParse({
            name: "Distribuidora ABC",
            contactName: "",
            phone: "",
            email: "",
            address: "",
        })
        expect(r.success).toBe(true)
    })

    it("accepts a full payload", () => {
        const r = createSupplierSchema.safeParse({
            name: "Distribuidora ABC",
            contactName: "João",
            phone: "(11) 99999-9999",
            email: "joao@abc.com",
            address: "R. das Flores, 123",
        })
        expect(r.success).toBe(true)
    })

    it("rejects empty name", () => {
        const r = createSupplierSchema.safeParse({
            name: "",
            contactName: "",
            phone: "",
            email: "",
            address: "",
        })
        expect(r.success).toBe(false)
    })

    it("rejects invalid email", () => {
        const r = createSupplierSchema.safeParse({
            name: "ABC",
            contactName: "",
            phone: "",
            email: "not-an-email",
            address: "",
        })
        expect(r.success).toBe(false)
    })

    it("accepts empty email (optional)", () => {
        const r = createSupplierSchema.safeParse({
            name: "ABC",
            contactName: "",
            phone: "",
            email: "",
            address: "",
        })
        expect(r.success).toBe(true)
    })
})

describe("updateSupplierSchema", () => {
    it("requires active flag", () => {
        const r = updateSupplierSchema.safeParse({
            name: "ABC",
            contactName: "",
            phone: "",
            email: "",
            address: "",
        })
        expect(r.success).toBe(false)
    })

    it("accepts active flag", () => {
        const r = updateSupplierSchema.safeParse({
            name: "ABC",
            contactName: "",
            phone: "",
            email: "",
            address: "",
            active: true,
        })
        expect(r.success).toBe(true)
    })
})
```

- [ ] **Step 2: Rodar — devem falhar**

```bash
cd frontend && npx vitest run tests/schemas.test.ts
```

Expected: erro de import "Cannot find module '@/lib/suppliers'".

- [ ] **Step 3: Criar `frontend/lib/suppliers.ts`**

```ts
import { api } from "@/lib/api"
import type { Page } from "@/lib/users"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

export type Supplier = {
    id: string
    name: string
    contactName: string | null
    phone: string | null
    email: string | null
    address: string | null
    active: boolean
    createdAt: string
}

export const createSupplierSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(150),
    contactName: z.string().max(100).optional().or(z.literal("")),
    phone: z.string().max(20).optional().or(z.literal("")),
    email: z.union([z.string().email("E-mail inválido").max(150), z.literal("")]).optional(),
    address: z.string().max(255).optional().or(z.literal("")),
})
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>

export const updateSupplierSchema = createSupplierSchema.extend({
    active: z.boolean(),
})
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>

export function useSuppliers(params?: { active?: boolean; page?: number; size?: number }) {
    const page = params?.page ?? 0
    const size = params?.size ?? 20
    const active = params?.active
    return useQuery({
        queryKey: ["suppliers", { active, page, size }],
        queryFn: () =>
            api
                .get<Page<Supplier>>("/suppliers", {
                    params: { page, size, ...(active !== undefined ? { active } : {}) },
                })
                .then((r) => r.data),
    })
}

export function useActiveSuppliers() {
    return useQuery({
        queryKey: ["suppliers", "all-active"],
        queryFn: () =>
            api
                .get<Page<Supplier>>("/suppliers", {
                    params: { page: 0, size: 1000, active: true },
                })
                .then((r) => r.data.data),
        staleTime: 5 * 60 * 1000,
    })
}

export function useSupplier(id: string) {
    return useQuery({
        queryKey: ["suppliers", id],
        queryFn: () => api.get<Supplier>(`/suppliers/${id}`).then((r) => r.data),
        enabled: !!id,
    })
}

export function useCreateSupplier() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (input: CreateSupplierInput) =>
            api.post<Supplier>("/suppliers", input).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
    })
}

export function useUpdateSupplier() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: UpdateSupplierInput }) =>
            api.put<Supplier>(`/suppliers/${id}`, input).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
    })
}

export function useDeactivateSupplier() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => api.delete(`/suppliers/${id}`).then(() => undefined),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
    })
}
```

- [ ] **Step 4: Rodar testes de schema — devem passar**

```bash
cd frontend && npx vitest run tests/schemas.test.ts
```

Expected: passa.

- [ ] **Step 5: Rodar suíte completa**

```bash
cd frontend && npx vitest run
```

Expected: todos passam.

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/suppliers.ts frontend/tests/schemas.test.ts
git commit -m "$(cat <<'EOF'
feat(frontend): suppliers types, schemas and TanStack hooks

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: app/(protected)/suppliers — page + dialog + tests

**Files:**
- Create: `frontend/app/(protected)/suppliers/page.tsx`
- Create: `frontend/app/(protected)/suppliers/supplier-dialog.tsx`
- Create: `frontend/tests/suppliers-page.test.tsx`

**Why:** Tela de listagem com modal create/edit + soft-delete (mesmo padrão de
`/units`). Mais campos no form do que Categorias.

- [ ] **Step 1: Criar `frontend/tests/suppliers-page.test.tsx` (failing)**

```tsx
import { screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/suppliers",
}))

import SuppliersPage from "@/app/(protected)/suppliers/page"
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

describe("SuppliersPage", () => {
    it("EMPLOYEE sees rows but no create button", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("EMPLOYEE")
            if (url.includes("/suppliers") && cfg.method === "get") {
                return {
                    status: 200,
                    data: {
                        data: [
                            {
                                id: "s1",
                                name: "Distribuidora ABC",
                                contactName: "João",
                                phone: "(11) 9 9999-9999",
                                email: null,
                                address: null,
                                active: true,
                                createdAt: "2026-01-01T00:00:00Z",
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
        renderWithProviders(<SuppliersPage />)
        await waitFor(() => expect(screen.getByText("Distribuidora ABC")).toBeInTheDocument())
        expect(screen.queryByRole("button", { name: /novo fornecedor/i })).not.toBeInTheDocument()
    })

    it("OWNER with empty list sees empty state and create CTA", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("OWNER")
            if (url.includes("/suppliers") && cfg.method === "get") {
                return { status: 200, data: { data: [], page: 0, size: 20, total: 0 } }
            }
            return { status: 500 }
        })
        renderWithProviders(<SuppliersPage />)
        await waitFor(() =>
            expect(screen.getByText(/nenhum fornecedor cadastrado/i)).toBeInTheDocument(),
        )
        expect(
            screen.getByRole("button", { name: /criar primeiro fornecedor/i }),
        ).toBeInTheDocument()
    })

    it("OWNER with rows sees create button and inactive badge", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("OWNER")
            if (url.includes("/suppliers") && cfg.method === "get") {
                return {
                    status: 200,
                    data: {
                        data: [
                            {
                                id: "s1",
                                name: "Distribuidora ABC",
                                contactName: null,
                                phone: null,
                                email: null,
                                address: null,
                                active: true,
                                createdAt: "2026-01-01T00:00:00Z",
                            },
                            {
                                id: "s2",
                                name: "Velha Distribuidora",
                                contactName: null,
                                phone: null,
                                email: null,
                                address: null,
                                active: false,
                                createdAt: "2026-01-01T00:00:00Z",
                            },
                        ],
                        page: 0,
                        size: 20,
                        total: 2,
                    },
                }
            }
            return { status: 500 }
        })
        renderWithProviders(<SuppliersPage />)
        await waitFor(() => expect(screen.getByText("Distribuidora ABC")).toBeInTheDocument())
        expect(screen.getByRole("button", { name: /novo fornecedor/i })).toBeInTheDocument()
        expect(screen.getByText("Inativo")).toBeInTheDocument()
    })
})
```

- [ ] **Step 2: Rodar — devem falhar**

```bash
cd frontend && npx vitest run tests/suppliers-page.test.tsx
```

Expected: erro de import.

- [ ] **Step 3: Criar `frontend/app/(protected)/suppliers/supplier-dialog.tsx`**

```tsx
"use client"

import { Modal } from "@/components/overlays/modal"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { isApiError } from "@/lib/auth"
import {
    createSupplierSchema,
    updateSupplierSchema,
    useCreateSupplier,
    useUpdateSupplier,
    type CreateSupplierInput,
    type Supplier,
    type UpdateSupplierInput,
} from "@/lib/suppliers"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

type Props = {
    open: boolean
    onClose: () => void
    supplier: Supplier | null
}

export function SupplierDialog({ open, onClose, supplier }: Props) {
    const editing = !!supplier
    const create = useCreateSupplier()
    const update = useUpdateSupplier()

    const form = useForm<CreateSupplierInput | UpdateSupplierInput>({
        resolver: zodResolver(editing ? updateSupplierSchema : createSupplierSchema),
        defaultValues: editing
            ? {
                  name: supplier.name,
                  contactName: supplier.contactName ?? "",
                  phone: supplier.phone ?? "",
                  email: supplier.email ?? "",
                  address: supplier.address ?? "",
                  active: supplier.active,
              }
            : { name: "", contactName: "", phone: "", email: "", address: "" },
    })

    useEffect(() => {
        if (open) {
            form.reset(
                editing
                    ? {
                          name: supplier.name,
                          contactName: supplier.contactName ?? "",
                          phone: supplier.phone ?? "",
                          email: supplier.email ?? "",
                          address: supplier.address ?? "",
                          active: supplier.active,
                      }
                    : { name: "", contactName: "", phone: "", email: "", address: "" },
            )
        }
    }, [open, editing, supplier, form])

    async function onSubmit(values: CreateSupplierInput | UpdateSupplierInput) {
        try {
            if (editing) {
                await update.mutateAsync({ id: supplier.id, input: values as UpdateSupplierInput })
                toast.success("Fornecedor atualizado")
            } else {
                await create.mutateAsync(values as CreateSupplierInput)
                toast.success("Fornecedor criado")
            }
            onClose()
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao salvar fornecedor")
        }
    }

    const submitting = create.isPending || update.isPending

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={editing ? "Editar fornecedor" : "Novo fornecedor"}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" form="supplier-form" disabled={submitting}>
                        {submitting ? "Salvando..." : "Salvar"}
                    </Button>
                </>
            }
        >
            <form id="supplier-form" className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                <Field
                    label="Nome"
                    htmlFor="supplier-name"
                    error={form.formState.errors.name?.message}
                >
                    <Input id="supplier-name" {...form.register("name")} />
                </Field>
                <Field
                    label="Contato"
                    htmlFor="supplier-contact"
                    error={form.formState.errors.contactName?.message}
                >
                    <Input id="supplier-contact" {...form.register("contactName")} />
                </Field>
                <Field
                    label="Telefone"
                    htmlFor="supplier-phone"
                    error={form.formState.errors.phone?.message}
                >
                    <Input id="supplier-phone" {...form.register("phone")} />
                </Field>
                <Field
                    label="E-mail"
                    htmlFor="supplier-email"
                    error={form.formState.errors.email?.message}
                >
                    <Input id="supplier-email" type="email" {...form.register("email")} />
                </Field>
                <Field
                    label="Endereço"
                    htmlFor="supplier-address"
                    error={form.formState.errors.address?.message}
                >
                    <Input id="supplier-address" {...form.register("address")} />
                </Field>
                {editing ? (
                    <label className="flex items-center gap-2 text-sm text-text-primary">
                        <input type="checkbox" {...form.register("active" as never)} />
                        Ativo
                    </label>
                ) : null}
            </form>
        </Modal>
    )
}
```

- [ ] **Step 4: Criar `frontend/app/(protected)/suppliers/page.tsx`**

```tsx
"use client"

import { ConfirmDialog } from "@/components/overlays/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { isApiError, useAuth } from "@/lib/auth"
import { useDeactivateSupplier, useSuppliers, type Supplier } from "@/lib/suppliers"
import { Pencil, Plus, Power } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { SupplierDialog } from "./supplier-dialog"

export default function SuppliersPage() {
    const { user } = useAuth()
    const isOwner = user?.role === "OWNER"
    const [page, setPage] = useState(0)
    const size = 20
    const suppliersQuery = useSuppliers({ page, size })

    const [dialogOpen, setDialogOpen] = useState(false)
    const [editing, setEditing] = useState<Supplier | null>(null)
    const [confirm, setConfirm] = useState<Supplier | null>(null)
    const deactivate = useDeactivateSupplier()

    const data = suppliersQuery.data
    const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1

    async function onConfirm() {
        if (!confirm) return
        try {
            await deactivate.mutateAsync(confirm.id)
            toast.success("Fornecedor desativado")
            setConfirm(null)
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao desativar fornecedor")
        }
    }

    return (
        <div className="space-y-6">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-text-primary">Fornecedores</h1>
                    <p className="mt-1 text-sm text-text-secondary">
                        Quem fornece os ingredientes da pizzaria.
                    </p>
                </div>
                {isOwner ? (
                    <Button
                        onClick={() => {
                            setEditing(null)
                            setDialogOpen(true)
                        }}
                    >
                        <Plus className="mr-2 h-4 w-4" /> Novo fornecedor
                    </Button>
                ) : null}
            </header>

            {suppliersQuery.isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-12 animate-pulse rounded-lg bg-text-primary/5" />
                    ))}
                </div>
            ) : suppliersQuery.isError ? (
                <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
                    <p className="text-sm text-danger">Falha ao carregar fornecedores.</p>
                    <Button variant="ghost" size="sm" onClick={() => suppliersQuery.refetch()}>
                        Tentar novamente
                    </Button>
                </div>
            ) : data && data.data.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                    <p className="text-sm text-text-secondary">Nenhum fornecedor cadastrado.</p>
                    {isOwner ? (
                        <Button
                            className="mt-4"
                            onClick={() => {
                                setEditing(null)
                                setDialogOpen(true)
                            }}
                        >
                            Criar primeiro fornecedor
                        </Button>
                    ) : null}
                </div>
            ) : (
                <Table>
                    <THead>
                        <TR>
                            <TH>Nome</TH>
                            <TH>Contato</TH>
                            <TH>Telefone</TH>
                            <TH>Status</TH>
                            {isOwner ? <TH className="w-px text-right">Ações</TH> : null}
                        </TR>
                    </THead>
                    <TBody>
                        {data!.data.map((s) => (
                            <TR key={s.id}>
                                <TD>{s.name}</TD>
                                <TD>{s.contactName ?? "—"}</TD>
                                <TD>{s.phone ?? "—"}</TD>
                                <TD>
                                    <Badge variant={s.active ? "success" : "neutral"}>
                                        {s.active ? "Ativo" : "Inativo"}
                                    </Badge>
                                </TD>
                                {isOwner ? (
                                    <TD className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditing(s)
                                                    setDialogOpen(true)
                                                }}
                                                className="rounded p-1.5 text-text-primary/70 hover:bg-text-primary/5 hover:text-text-primary"
                                                aria-label={`Editar ${s.name}`}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            {s.active ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirm(s)}
                                                    className="rounded p-1.5 text-danger/80 hover:bg-danger/10"
                                                    aria-label={`Desativar ${s.name}`}
                                                >
                                                    <Power className="h-4 w-4" />
                                                </button>
                                            ) : null}
                                        </div>
                                    </TD>
                                ) : null}
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

            {isOwner ? (
                <SupplierDialog
                    open={dialogOpen}
                    onClose={() => setDialogOpen(false)}
                    supplier={editing}
                />
            ) : null}

            <ConfirmDialog
                open={!!confirm}
                onClose={() => setConfirm(null)}
                onConfirm={onConfirm}
                title="Desativar fornecedor"
                message={confirm ? `Confirma desativar ${confirm.name}?` : ""}
                confirmLabel="Desativar"
                confirmVariant="danger"
                loading={deactivate.isPending}
            />
        </div>
    )
}
```

- [ ] **Step 5: Rodar testes da página — devem passar**

```bash
cd frontend && npx vitest run tests/suppliers-page.test.tsx
```

Expected: verde.

- [ ] **Step 6: Rodar suíte completa**

```bash
cd frontend && npx vitest run
```

Expected: todos passam.

- [ ] **Step 7: Commit**

```bash
git add frontend/app/\(protected\)/suppliers frontend/tests/suppliers-page.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): /suppliers CRUD with soft-delete

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: lib/ingredients.ts (types + schemas + hooks)

**Files:**
- Create: `frontend/lib/ingredients.ts`
- Modify: `frontend/tests/schemas.test.ts`

**Why:** Modelo mais complexo: enum de unidade de medida, decimal, FKs UUID,
data opcional. As queries `useIngredients` aceitam filtros (`category`, `active`)
que vão na querystring.

- [ ] **Step 1: Adicionar testes de schema (failing) ao `frontend/tests/schemas.test.ts`**

Adicionar import:

```ts
import { createIngredientSchema, updateIngredientSchema, UNITS_OF_MEASURE } from "@/lib/ingredients"
```

Adicionar describes ao final:

```ts
describe("createIngredientSchema", () => {
    const validBase = {
        name: "Mussarela",
        description: "",
        categoryId: "11111111-1111-1111-1111-111111111111",
        unitOfMeasure: "kg",
        minimumQty: 5,
        expiryDate: "",
        defaultSupplierId: "",
    }

    it("accepts a minimal valid input", () => {
        const r = createIngredientSchema.safeParse(validBase)
        expect(r.success).toBe(true)
    })

    it("accepts every unit_of_measure", () => {
        for (const unit of UNITS_OF_MEASURE) {
            const r = createIngredientSchema.safeParse({ ...validBase, unitOfMeasure: unit })
            expect(r.success).toBe(true)
        }
    })

    it("rejects unknown unit_of_measure", () => {
        const r = createIngredientSchema.safeParse({ ...validBase, unitOfMeasure: "lb" })
        expect(r.success).toBe(false)
    })

    it("rejects negative minimumQty", () => {
        const r = createIngredientSchema.safeParse({ ...validBase, minimumQty: -1 })
        expect(r.success).toBe(false)
    })

    it("coerces minimumQty from string", () => {
        const r = createIngredientSchema.safeParse({ ...validBase, minimumQty: "5.5" })
        expect(r.success).toBe(true)
    })

    it("rejects empty name", () => {
        const r = createIngredientSchema.safeParse({ ...validBase, name: "" })
        expect(r.success).toBe(false)
    })

    it("rejects categoryId that is not a UUID", () => {
        const r = createIngredientSchema.safeParse({ ...validBase, categoryId: "not-a-uuid" })
        expect(r.success).toBe(false)
    })

    it("accepts empty defaultSupplierId (optional)", () => {
        const r = createIngredientSchema.safeParse({ ...validBase, defaultSupplierId: "" })
        expect(r.success).toBe(true)
    })

    it("accepts a valid UUID for defaultSupplierId", () => {
        const r = createIngredientSchema.safeParse({
            ...validBase,
            defaultSupplierId: "22222222-2222-2222-2222-222222222222",
        })
        expect(r.success).toBe(true)
    })

    it("accepts empty expiryDate", () => {
        const r = createIngredientSchema.safeParse({ ...validBase, expiryDate: "" })
        expect(r.success).toBe(true)
    })

    it("accepts a valid ISO date for expiryDate", () => {
        const r = createIngredientSchema.safeParse({ ...validBase, expiryDate: "2026-12-31" })
        expect(r.success).toBe(true)
    })
})

describe("updateIngredientSchema", () => {
    it("requires active", () => {
        const r = updateIngredientSchema.safeParse({
            name: "Mussarela",
            description: "",
            categoryId: "11111111-1111-1111-1111-111111111111",
            unitOfMeasure: "kg",
            minimumQty: 5,
            expiryDate: "",
            defaultSupplierId: "",
        })
        expect(r.success).toBe(false)
    })

    it("accepts active flag", () => {
        const r = updateIngredientSchema.safeParse({
            name: "Mussarela",
            description: "",
            categoryId: "11111111-1111-1111-1111-111111111111",
            unitOfMeasure: "kg",
            minimumQty: 5,
            expiryDate: "",
            defaultSupplierId: "",
            active: true,
        })
        expect(r.success).toBe(true)
    })
})
```

- [ ] **Step 2: Rodar — devem falhar**

```bash
cd frontend && npx vitest run tests/schemas.test.ts
```

Expected: erro de import.

- [ ] **Step 3: Criar `frontend/lib/ingredients.ts`**

```ts
import { api } from "@/lib/api"
import type { Page } from "@/lib/users"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

export const UNITS_OF_MEASURE = ["kg", "g", "L", "ml", "un", "cx"] as const
export type UnitOfMeasure = (typeof UNITS_OF_MEASURE)[number]

export type Ingredient = {
    id: string
    name: string
    description: string | null
    categoryId: string
    unitOfMeasure: UnitOfMeasure
    minimumQty: number
    averageCost: number
    expiryDate: string | null
    defaultSupplierId: string | null
    active: boolean
    createdAt: string
}

export const createIngredientSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(150),
    description: z.string().max(255).optional().or(z.literal("")),
    categoryId: z.string().uuid("Selecione uma categoria"),
    unitOfMeasure: z.enum(UNITS_OF_MEASURE),
    minimumQty: z.coerce.number().nonnegative("Não pode ser negativo"),
    expiryDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"), z.literal("")]).optional(),
    defaultSupplierId: z.union([z.string().uuid(), z.literal("")]).optional(),
})
export type CreateIngredientInput = z.infer<typeof createIngredientSchema>

export const updateIngredientSchema = createIngredientSchema.extend({
    active: z.boolean(),
})
export type UpdateIngredientInput = z.infer<typeof updateIngredientSchema>

export type IngredientFilters = {
    category?: string
    active?: boolean
    page?: number
    size?: number
}

export function useIngredients(filters: IngredientFilters = {}) {
    const page = filters.page ?? 0
    const size = filters.size ?? 20
    const params: Record<string, string | number | boolean> = { page, size }
    if (filters.category) params.category = filters.category
    if (filters.active !== undefined) params.active = filters.active
    return useQuery({
        queryKey: [
            "ingredients",
            { category: filters.category ?? null, active: filters.active ?? null, page, size },
        ],
        queryFn: () =>
            api.get<Page<Ingredient>>("/ingredients", { params }).then((r) => r.data),
    })
}

export function useIngredient(id: string) {
    return useQuery({
        queryKey: ["ingredients", id],
        queryFn: () => api.get<Ingredient>(`/ingredients/${id}`).then((r) => r.data),
        enabled: !!id,
    })
}

function normalizeIngredientPayload<
    T extends { description?: string; expiryDate?: string; defaultSupplierId?: string },
>(input: T) {
    return {
        ...input,
        description: input.description === "" ? null : input.description,
        expiryDate: input.expiryDate === "" ? null : input.expiryDate,
        defaultSupplierId: input.defaultSupplierId === "" ? null : input.defaultSupplierId,
    }
}

export function useCreateIngredient() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (input: CreateIngredientInput) =>
            api
                .post<Ingredient>("/ingredients", normalizeIngredientPayload(input))
                .then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["ingredients"] }),
    })
}

export function useUpdateIngredient() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: UpdateIngredientInput }) =>
            api
                .put<Ingredient>(`/ingredients/${id}`, normalizeIngredientPayload(input))
                .then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["ingredients"] }),
    })
}

export function useDeactivateIngredient() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => api.delete(`/ingredients/${id}`).then(() => undefined),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["ingredients"] }),
    })
}
```

- [ ] **Step 4: Rodar testes de schema — devem passar**

```bash
cd frontend && npx vitest run tests/schemas.test.ts
```

Expected: verde.

- [ ] **Step 5: Rodar suíte completa**

```bash
cd frontend && npx vitest run
```

Expected: todos passam.

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/ingredients.ts frontend/tests/schemas.test.ts
git commit -m "$(cat <<'EOF'
feat(frontend): ingredients types, schemas and TanStack hooks

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: ingredient-form.tsx (componente compartilhado)

**Files:**
- Create: `frontend/app/(protected)/ingredients/ingredient-form.tsx`

**Why:** O form de criação e o de edição compartilham praticamente todos os
campos. Componente recebe modo + dados iniciais + callback de sucesso. As
páginas `/novo` e `/[id]/editar` apenas plugam o estado inicial e o destino
após o submit.

- [ ] **Step 1: Criar `frontend/app/(protected)/ingredients/ingredient-form.tsx`**

```tsx
"use client"

import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { isApiError } from "@/lib/auth"
import { useAllCategories } from "@/lib/categories"
import {
    createIngredientSchema,
    updateIngredientSchema,
    UNITS_OF_MEASURE,
    useCreateIngredient,
    useUpdateIngredient,
    type CreateIngredientInput,
    type Ingredient,
    type UpdateIngredientInput,
} from "@/lib/ingredients"
import { useActiveSuppliers } from "@/lib/suppliers"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

type Props = {
    mode: "create" | "edit"
    initial?: Ingredient
}

export function IngredientForm({ mode, initial }: Props) {
    const router = useRouter()
    const categories = useAllCategories()
    const suppliers = useActiveSuppliers()
    const create = useCreateIngredient()
    const update = useUpdateIngredient()

    const form = useForm<CreateIngredientInput | UpdateIngredientInput>({
        resolver: zodResolver(mode === "edit" ? updateIngredientSchema : createIngredientSchema),
        defaultValues:
            mode === "edit" && initial
                ? {
                      name: initial.name,
                      description: initial.description ?? "",
                      categoryId: initial.categoryId,
                      unitOfMeasure: initial.unitOfMeasure,
                      minimumQty: initial.minimumQty,
                      expiryDate: initial.expiryDate ?? "",
                      defaultSupplierId: initial.defaultSupplierId ?? "",
                      active: initial.active,
                  }
                : {
                      name: "",
                      description: "",
                      categoryId: "",
                      unitOfMeasure: "kg",
                      minimumQty: 0,
                      expiryDate: "",
                      defaultSupplierId: "",
                  },
    })

    async function onSubmit(values: CreateIngredientInput | UpdateIngredientInput) {
        try {
            if (mode === "edit" && initial) {
                await update.mutateAsync({ id: initial.id, input: values as UpdateIngredientInput })
                toast.success("Ingrediente atualizado")
            } else {
                await create.mutateAsync(values as CreateIngredientInput)
                toast.success("Ingrediente criado")
            }
            router.replace("/ingredients")
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao salvar ingrediente")
        }
    }

    const submitting = create.isPending || update.isPending

    return (
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <Field
                label="Nome"
                htmlFor="ingredient-name"
                error={form.formState.errors.name?.message}
            >
                <Input id="ingredient-name" {...form.register("name")} />
            </Field>

            <Field
                label="Descrição"
                htmlFor="ingredient-description"
                error={form.formState.errors.description?.message}
            >
                <Input id="ingredient-description" {...form.register("description")} />
            </Field>

            <Field
                label="Categoria"
                htmlFor="ingredient-category"
                error={form.formState.errors.categoryId?.message}
            >
                <Select id="ingredient-category" {...form.register("categoryId")}>
                    <option value="">Selecione...</option>
                    {categories.data?.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </Select>
            </Field>

            <Field
                label="Unidade de medida"
                htmlFor="ingredient-unit"
                error={form.formState.errors.unitOfMeasure?.message}
            >
                <Select id="ingredient-unit" {...form.register("unitOfMeasure")}>
                    {UNITS_OF_MEASURE.map((u) => (
                        <option key={u} value={u}>
                            {u}
                        </option>
                    ))}
                </Select>
            </Field>

            <Field
                label="Quantidade mínima"
                htmlFor="ingredient-min"
                error={form.formState.errors.minimumQty?.message}
            >
                <Input
                    id="ingredient-min"
                    type="number"
                    step="0.001"
                    min="0"
                    {...form.register("minimumQty")}
                />
            </Field>

            <Field
                label="Validade"
                htmlFor="ingredient-expiry"
                error={form.formState.errors.expiryDate?.message}
            >
                <Input
                    id="ingredient-expiry"
                    type="date"
                    {...form.register("expiryDate")}
                />
            </Field>

            <Field
                label="Fornecedor padrão"
                htmlFor="ingredient-supplier"
                error={form.formState.errors.defaultSupplierId?.message}
            >
                <Select id="ingredient-supplier" {...form.register("defaultSupplierId")}>
                    <option value="">Nenhum</option>
                    {suppliers.data?.map((s) => (
                        <option key={s.id} value={s.id}>
                            {s.name}
                        </option>
                    ))}
                </Select>
            </Field>

            {mode === "edit" ? (
                <label className="flex items-center gap-2 text-sm text-text-primary">
                    <input type="checkbox" {...form.register("active" as never)} />
                    Ativo
                </label>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => router.replace("/ingredients")}
                    disabled={submitting}
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

- [ ] **Step 2: Verificar que o tsc não acusa erro**

```bash
cd frontend && npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 3: Rodar suíte completa (sanidade)**

```bash
cd frontend && npx vitest run
```

Expected: todos passam (esse arquivo ainda não tem teste direto — será coberto pelos testes da página em Task 8).

- [ ] **Step 4: Commit**

```bash
git add frontend/app/\(protected\)/ingredients/ingredient-form.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): shared IngredientForm with FK selects and unit enum

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: rotas /ingredients/novo e /ingredients/[id]/editar

**Files:**
- Create: `frontend/app/(protected)/ingredients/novo/page.tsx`
- Create: `frontend/app/(protected)/ingredients/[id]/editar/page.tsx`

**Why:** Páginas finas que reusam o `IngredientForm`. Cada uma faz guard de role
(EMPLOYEE → `<NoAccess />`); a de edição busca o ingrediente por id.

- [ ] **Step 1: Criar `frontend/app/(protected)/ingredients/novo/page.tsx`**

```tsx
"use client"

import { useAuth } from "@/lib/auth"
import Link from "next/link"
import { IngredientForm } from "../ingredient-form"

export default function NewIngredientPage() {
    const { user } = useAuth()

    if (user?.role !== "OWNER") return <NoAccess />

    return (
        <div className="space-y-6">
            <header>
                <p className="text-sm text-text-secondary">
                    <Link href="/ingredients" className="hover:underline">
                        Ingredientes
                    </Link>{" "}
                    › Novo
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-text-primary">Novo ingrediente</h1>
            </header>

            <div className="mx-auto max-w-2xl rounded-xl border border-border/40 bg-white p-6">
                <IngredientForm mode="create" />
            </div>
        </div>
    )
}

function NoAccess() {
    return (
        <div className="mx-auto max-w-md rounded-xl border border-border/40 bg-white p-8 text-center">
            <h2 className="text-base font-semibold text-text-primary">Sem permissão</h2>
            <p className="mt-2 text-sm text-text-secondary">
                Apenas o proprietário pode criar ingredientes.
            </p>
        </div>
    )
}
```

- [ ] **Step 2: Criar `frontend/app/(protected)/ingredients/[id]/editar/page.tsx`**

```tsx
"use client"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import { useIngredient } from "@/lib/ingredients"
import Link from "next/link"
import { useParams } from "next/navigation"
import { IngredientForm } from "../../ingredient-form"

export default function EditIngredientPage() {
    const { user } = useAuth()
    const params = useParams<{ id: string }>()
    const id = params.id
    const ingredientQuery = useIngredient(id)

    if (user?.role !== "OWNER") return <NoAccess />

    return (
        <div className="space-y-6">
            <header>
                <p className="text-sm text-text-secondary">
                    <Link href="/ingredients" className="hover:underline">
                        Ingredientes
                    </Link>{" "}
                    › Editar
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-text-primary">Editar ingrediente</h1>
            </header>

            <div className="mx-auto max-w-2xl rounded-xl border border-border/40 bg-white p-6">
                {ingredientQuery.isLoading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-10 animate-pulse rounded-lg bg-text-primary/5" />
                        ))}
                    </div>
                ) : ingredientQuery.isError ? (
                    <div className="text-center">
                        <p className="text-sm text-danger">Ingrediente não encontrado.</p>
                        <Link href="/ingredients">
                            <Button variant="ghost" size="sm" className="mt-3">
                                Voltar
                            </Button>
                        </Link>
                    </div>
                ) : ingredientQuery.data ? (
                    <IngredientForm mode="edit" initial={ingredientQuery.data} />
                ) : null}
            </div>
        </div>
    )
}

function NoAccess() {
    return (
        <div className="mx-auto max-w-md rounded-xl border border-border/40 bg-white p-8 text-center">
            <h2 className="text-base font-semibold text-text-primary">Sem permissão</h2>
            <p className="mt-2 text-sm text-text-secondary">
                Apenas o proprietário pode editar ingredientes.
            </p>
        </div>
    )
}
```

- [ ] **Step 3: Verificar tsc**

```bash
cd frontend && npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 4: Rodar suíte completa**

```bash
cd frontend && npx vitest run
```

Expected: todos passam.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/\(protected\)/ingredients/novo frontend/app/\(protected\)/ingredients/\[id\]
git commit -m "$(cat <<'EOF'
feat(frontend): /ingredients/novo and /ingredients/[id]/editar routes

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: /ingredients lista + filtros + page tests

**Files:**
- Create: `frontend/app/(protected)/ingredients/page.tsx`
- Create: `frontend/tests/ingredients-page.test.tsx`

**Why:** Lista com filtros que persistem na URL e resolução client-side de
nomes de FK.

- [ ] **Step 1: Criar `frontend/tests/ingredients-page.test.tsx` (failing)**

```tsx
import { screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockReplace = vi.fn()
const searchParamsRef = { current: new URLSearchParams() }

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: mockReplace, back: vi.fn() }),
    useSearchParams: () => searchParamsRef.current,
    usePathname: () => "/ingredients",
}))

import IngredientsPage from "@/app/(protected)/ingredients/page"
import { tokenStorage } from "@/lib/api"
import { getCalls, renderWithProviders, resetMockApi, setHandler } from "./helpers"

beforeEach(() => {
    resetMockApi()
    mockReplace.mockReset()
    searchParamsRef.current = new URLSearchParams()
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

const CAT_ID = "11111111-1111-1111-1111-111111111111"
const SUP_ID = "22222222-2222-2222-2222-222222222222"

function categoriesPage(items: Array<{ id: string; name: string }>) {
    return {
        status: 200,
        data: {
            data: items.map((i) => ({ ...i, description: null, createdAt: "2026-01-01T00:00:00Z" })),
            page: 0,
            size: 1000,
            total: items.length,
        },
    }
}

function suppliersPage(items: Array<{ id: string; name: string }>) {
    return {
        status: 200,
        data: {
            data: items.map((i) => ({
                ...i,
                contactName: null,
                phone: null,
                email: null,
                address: null,
                active: true,
                createdAt: "2026-01-01T00:00:00Z",
            })),
            page: 0,
            size: 1000,
            total: items.length,
        },
    }
}

describe("IngredientsPage", () => {
    it("renders rows with resolved category and supplier names", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("OWNER")
            if (url.endsWith("/categories")) return categoriesPage([{ id: CAT_ID, name: "Massas" }])
            if (url.endsWith("/suppliers")) return suppliersPage([{ id: SUP_ID, name: "Distribuidora ABC" }])
            if (url.includes("/ingredients") && cfg.method === "get") {
                return {
                    status: 200,
                    data: {
                        data: [
                            {
                                id: "i1",
                                name: "Mussarela",
                                description: null,
                                categoryId: CAT_ID,
                                unitOfMeasure: "kg",
                                minimumQty: 5,
                                averageCost: 30,
                                expiryDate: null,
                                defaultSupplierId: SUP_ID,
                                active: true,
                                createdAt: "2026-01-01T00:00:00Z",
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
        renderWithProviders(<IngredientsPage />)
        await waitFor(() => expect(screen.getByText("Mussarela")).toBeInTheDocument())
        expect(screen.getByText("Massas")).toBeInTheDocument()
        expect(screen.getByText("Distribuidora ABC")).toBeInTheDocument()
        expect(screen.getByText("5 kg")).toBeInTheDocument()
    })

    it("EMPLOYEE does not see the create button", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("EMPLOYEE")
            if (url.endsWith("/categories")) return categoriesPage([])
            if (url.endsWith("/suppliers")) return suppliersPage([])
            if (url.includes("/ingredients") && cfg.method === "get") {
                return { status: 200, data: { data: [], page: 0, size: 20, total: 0 } }
            }
            return { status: 500 }
        })
        renderWithProviders(<IngredientsPage />)
        await waitFor(() =>
            expect(screen.getByText(/nenhum ingrediente cadastrado/i)).toBeInTheDocument(),
        )
        expect(screen.queryByRole("link", { name: /novo ingrediente/i })).not.toBeInTheDocument()
    })

    it("defaults to active=true on the ingredients query", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("OWNER")
            if (url.endsWith("/categories")) return categoriesPage([])
            if (url.endsWith("/suppliers")) return suppliersPage([])
            if (url.includes("/ingredients") && cfg.method === "get") {
                return { status: 200, data: { data: [], page: 0, size: 20, total: 0 } }
            }
            return { status: 500 }
        })
        renderWithProviders(<IngredientsPage />)
        await waitFor(() => expect(screen.getByText(/nenhum ingrediente cadastrado/i)).toBeInTheDocument())
        const ingredientsCall = getCalls().find(
            (c) => (c.url ?? "").endsWith("/ingredients") && c.method === "get",
        )
        expect(ingredientsCall?.params).toMatchObject({ active: true })
    })

    it("respects ?category and ?active in URL", async () => {
        tokenStorage.setAccess("a1")
        searchParamsRef.current = new URLSearchParams(`category=${CAT_ID}&active=false`)
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("OWNER")
            if (url.endsWith("/categories")) return categoriesPage([{ id: CAT_ID, name: "Massas" }])
            if (url.endsWith("/suppliers")) return suppliersPage([])
            if (url.includes("/ingredients") && cfg.method === "get") {
                return { status: 200, data: { data: [], page: 0, size: 20, total: 0 } }
            }
            return { status: 500 }
        })
        renderWithProviders(<IngredientsPage />)
        await waitFor(() =>
            expect(screen.getByText(/nenhum ingrediente cadastrado/i)).toBeInTheDocument(),
        )
        const ingredientsCall = getCalls().find(
            (c) => (c.url ?? "").endsWith("/ingredients") && c.method === "get",
        )
        expect(ingredientsCall?.params).toMatchObject({ category: CAT_ID, active: false })
    })
})
```

- [ ] **Step 2: Rodar — devem falhar**

```bash
cd frontend && npx vitest run tests/ingredients-page.test.tsx
```

Expected: erro de import.

- [ ] **Step 3: Criar `frontend/app/(protected)/ingredients/page.tsx`**

```tsx
"use client"

import { ConfirmDialog } from "@/components/overlays/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Select } from "@/components/ui/select"
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { isApiError, useAuth } from "@/lib/auth"
import { useAllCategories } from "@/lib/categories"
import {
    useDeactivateIngredient,
    useIngredients,
    type Ingredient,
} from "@/lib/ingredients"
import { useActiveSuppliers } from "@/lib/suppliers"
import { Pencil, Plus, Power } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useMemo, useState } from "react"
import { toast } from "sonner"

function parseActive(v: string | null): boolean | undefined {
    if (v === "true") return true
    if (v === "false") return false
    return undefined
}

function IngredientsPageInner() {
    const { user } = useAuth()
    const isOwner = user?.role === "OWNER"
    const router = useRouter()
    const searchParams = useSearchParams()

    const categoryParam = searchParams.get("category") ?? ""
    const activeParam = searchParams.get("active")
    const activeFilter =
        activeParam === null ? true : parseActive(activeParam)

    const [page, setPage] = useState(0)
    const size = 20

    const ingredientsQuery = useIngredients({
        category: categoryParam || undefined,
        active: activeFilter,
        page,
        size,
    })

    const categories = useAllCategories()
    const suppliers = useActiveSuppliers()

    const categoryNameById = useMemo(() => {
        const m = new Map<string, string>()
        categories.data?.forEach((c) => m.set(c.id, c.name))
        return m
    }, [categories.data])

    const supplierNameById = useMemo(() => {
        const m = new Map<string, string>()
        suppliers.data?.forEach((s) => m.set(s.id, s.name))
        return m
    }, [suppliers.data])

    const [confirm, setConfirm] = useState<Ingredient | null>(null)
    const deactivate = useDeactivateIngredient()

    const data = ingredientsQuery.data
    const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1

    function setFilter(key: "category" | "active", value: string) {
        const params = new URLSearchParams(searchParams.toString())
        if (value === "" && key === "active") {
            params.delete("active")
        } else if (value === "") {
            params.delete(key)
        } else {
            params.set(key, value)
        }
        setPage(0)
        router.replace(`/ingredients?${params.toString()}`)
    }

    async function onConfirm() {
        if (!confirm) return
        try {
            await deactivate.mutateAsync(confirm.id)
            toast.success("Ingrediente desativado")
            setConfirm(null)
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao desativar ingrediente")
        }
    }

    return (
        <div className="space-y-6">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-text-primary">Ingredientes</h1>
                    <p className="mt-1 text-sm text-text-secondary">
                        Insumos controlados no estoque.
                    </p>
                </div>
                {isOwner ? (
                    <Link href="/ingredients/novo">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Novo ingrediente
                        </Button>
                    </Link>
                ) : null}
            </header>

            <div className="flex flex-wrap items-end gap-3">
                <Field label="Categoria" htmlFor="filter-category">
                    <Select
                        id="filter-category"
                        value={categoryParam}
                        onChange={(e) => setFilter("category", e.target.value)}
                    >
                        <option value="">Todas</option>
                        {categories.data?.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field label="Status" htmlFor="filter-status">
                    <Select
                        id="filter-status"
                        value={activeParam ?? "true"}
                        onChange={(e) => setFilter("active", e.target.value)}
                    >
                        <option value="true">Ativos</option>
                        <option value="false">Inativos</option>
                        <option value="">Todos</option>
                    </Select>
                </Field>
            </div>

            {ingredientsQuery.isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-12 animate-pulse rounded-lg bg-text-primary/5" />
                    ))}
                </div>
            ) : ingredientsQuery.isError ? (
                <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
                    <p className="text-sm text-danger">Falha ao carregar ingredientes.</p>
                    <Button variant="ghost" size="sm" onClick={() => ingredientsQuery.refetch()}>
                        Tentar novamente
                    </Button>
                </div>
            ) : data && data.data.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                    <p className="text-sm text-text-secondary">Nenhum ingrediente cadastrado.</p>
                    {isOwner ? (
                        <Link href="/ingredients/novo">
                            <Button className="mt-4">Criar primeiro ingrediente</Button>
                        </Link>
                    ) : null}
                </div>
            ) : (
                <Table>
                    <THead>
                        <TR>
                            <TH>Nome</TH>
                            <TH>Categoria</TH>
                            <TH>Mínimo</TH>
                            <TH>Fornecedor padrão</TH>
                            <TH>Status</TH>
                            {isOwner ? <TH className="w-px text-right">Ações</TH> : null}
                        </TR>
                    </THead>
                    <TBody>
                        {data!.data.map((ing) => (
                            <TR key={ing.id}>
                                <TD>{ing.name}</TD>
                                <TD>{categoryNameById.get(ing.categoryId) ?? "—"}</TD>
                                <TD>
                                    {ing.minimumQty} {ing.unitOfMeasure}
                                </TD>
                                <TD>
                                    {ing.defaultSupplierId
                                        ? supplierNameById.get(ing.defaultSupplierId) ?? "—"
                                        : "—"}
                                </TD>
                                <TD>
                                    <Badge variant={ing.active ? "success" : "neutral"}>
                                        {ing.active ? "Ativo" : "Inativo"}
                                    </Badge>
                                </TD>
                                {isOwner ? (
                                    <TD className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Link
                                                href={`/ingredients/${ing.id}/editar`}
                                                className="rounded p-1.5 text-text-primary/70 hover:bg-text-primary/5 hover:text-text-primary"
                                                aria-label={`Editar ${ing.name}`}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Link>
                                            {ing.active ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirm(ing)}
                                                    className="rounded p-1.5 text-danger/80 hover:bg-danger/10"
                                                    aria-label={`Desativar ${ing.name}`}
                                                >
                                                    <Power className="h-4 w-4" />
                                                </button>
                                            ) : null}
                                        </div>
                                    </TD>
                                ) : null}
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

            <ConfirmDialog
                open={!!confirm}
                onClose={() => setConfirm(null)}
                onConfirm={onConfirm}
                title="Desativar ingrediente"
                message={confirm ? `Confirma desativar ${confirm.name}?` : ""}
                confirmLabel="Desativar"
                confirmVariant="danger"
                loading={deactivate.isPending}
            />
        </div>
    )
}

export default function IngredientsPage() {
    return (
        <Suspense fallback={null}>
            <IngredientsPageInner />
        </Suspense>
    )
}
```

> **Nota:** O `<Suspense>` no export default replica o padrão usado em
> `/auth/page.tsx` (commit `78a4b30`) para evitar problema de prerender com
> `useSearchParams`.

- [ ] **Step 4: Rodar testes da página — devem passar**

```bash
cd frontend && npx vitest run tests/ingredients-page.test.tsx
```

Expected: 4 testes verdes.

- [ ] **Step 5: Rodar suíte completa**

```bash
cd frontend && npx vitest run
```

Expected: todos passam (sem regressão).

- [ ] **Step 6: Verificar tsc**

```bash
cd frontend && npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add frontend/app/\(protected\)/ingredients/page.tsx frontend/tests/ingredients-page.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): /ingredients list with URL-persisted filters and FK name resolution

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Sanity final — build + smoke manual

**Files:** nenhum.

**Why:** Garantir que `npm run build` passa (Next compila tudo) e fazer um
smoke manual rápido no navegador antes de pedir review.

- [ ] **Step 1: Rodar build**

```bash
cd frontend && npm run build
```

Expected: build conclui sem erros nem warnings novos.

- [ ] **Step 2: Subir o backend (em outro terminal, na pasta `backend/`)**

```bash
cd backend && ./mvnw spring-boot:run
```

(Em Windows: `mvnw.cmd spring-boot:run`)

Expected: servidor sobe em `http://localhost:8080`.

- [ ] **Step 3: Subir o frontend em modo dev**

```bash
cd frontend && npm run dev
```

Expected: server sobe em `http://localhost:3000`.

- [ ] **Step 4: Smoke manual — checklist**

Logar como `admin@pizzaria.com / admin123` (credenciais da migration `V5`).

  - [ ] Acessar `/categories` — listagem aparece, botão "Nova categoria" visível.
  - [ ] Criar uma categoria "Massas" — modal abre, salva, toast aparece, lista atualiza.
  - [ ] Editar a categoria — alteração persiste.
  - [ ] Acessar `/suppliers` — criar fornecedor "Distribuidora ABC" só com `name`.
  - [ ] Acessar `/ingredients` — vê a lista vazia (CTA aparece).
  - [ ] Clicar em "Novo ingrediente" — `/ingredients/novo` abre.
  - [ ] Selecionar a categoria criada, "kg", min 5, fornecedor padrão = ABC. Salvar.
  - [ ] Volta para `/ingredients`, ingrediente aparece com nome de categoria e fornecedor resolvidos.
  - [ ] Mudar filtro "Status" para "Inativos" — URL atualiza com `?active=false`, lista vazia.
  - [ ] Voltar para "Ativos" — ingrediente reaparece.
  - [ ] Tentar acessar `/ingredients/novo` em aba anônima sem login — vai para `/auth`.
  - [ ] Tentar excluir a categoria "Massas" — toast vermelho com a mensagem amigável.

- [ ] **Step 5: Caso encontre algum bug, criar um commit "fix" antes de finalizar**

(Não é necessário se o smoke passou.)

---

## Critérios de pronto

- [ ] Sidebar leva às 3 rotas sem 404.
- [ ] Categories: OWNER cria/edita/exclui; EMPLOYEE só lê. Excluir categoria com
      ingredientes vinculados mostra toast amigável.
- [ ] Suppliers: OWNER cria/edita/desativa; EMPLOYEE só lê.
- [ ] Ingredients lista: filtros de categoria e status persistem na URL e
      sobrevivem a refresh; coluna "Mínimo" exibe `{qty} {unit}`; coluna
      Categoria/Fornecedor mostra nomes (não UUIDs).
- [ ] Ingredients form: rotas dedicadas; selects populados das queries em cache;
      validação client-side coincide com backend; sucesso volta para a lista.
- [ ] EMPLOYEE acessando `/ingredients/novo` ou `/ingredients/[id]/editar`
      direto pela URL vê `<NoAccess />`.
- [ ] Toasts em sucesso/erro de todas as mutations.
- [ ] `npx vitest run` verde, `npm run build` sem warnings novos.
