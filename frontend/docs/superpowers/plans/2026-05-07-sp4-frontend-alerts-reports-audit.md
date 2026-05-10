# SP4 Frontend — Alerts + Reports + Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar frontend completo do SP4 — sino + página de notificações de estoque baixo (`/notifications`), 4 relatórios operacionais com export CSV (`/reports/*`) e auditoria OWNER-only (`/audit-logs`) — pareados 1:1 com os endpoints do backend SP4.

**Architecture:** Espelhar 1:1 os padrões de SP1/SP2/SP3 frontend. Notifications é leitura paginada + 1 mutation (resolve manual). Reports são 4 telas read-only com filtros não persistidos em URL e export CSV client-side. Audit-logs é leitura OWNER-only com diff before/after no detalhe. O sino do header e o badge da sidebar consomem o mesmo cache TanStack (`useActiveNotificationsBell`) com polling de 60s.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, axios, TanStack Query v5, react-hook-form, zod (`@hookform/resolvers/zod`), sonner, Tailwind v4, lucide-react. Testes: Vitest + jsdom + @testing-library/react.

**Reference spec:** `frontend/docs/superpowers/specs/2026-05-07-sp4-frontend-alerts-reports-audit-design.md`

---

## Reconciliação spec ↔ código atual

A spec assume alguns componentes/padrões que **não existem como genéricos** — o código real usa convenções diferentes. Antes de começar, ler isto:

1. **`<NoAccess />` não é componente compartilhado.** Cada página declara uma função local `function NoAccess()` retornando um `<div>`. Replicar esse padrão; **não criar** componente em `components/`. Exemplo de referência: `app/(protected)/ingredients/[id]/editar/page.tsx:63-72`.

2. **`<ConfirmDialog>`** existe em `components/overlays/confirm-dialog.tsx`. Props: `{ open, onClose, onConfirm, title, message, confirmLabel?, confirmVariant?: "primary" | "danger", loading? }`.

3. **`<Field>`** (`components/ui/field.tsx`) usa prop `hint` (não `helperText`).

4. **`<Badge>`** (`components/ui/badge.tsx`) usa prop `variant: "neutral" | "success" | "danger" | "warning"`. Não existe `tone`, `info`, `amber`, `red` etc — para esses, usar `warning`/`danger`/`neutral`.

5. **Filtros de data nas listagens existentes** (ex: `app/(protected)/stock-movements/page.tsx:131-146`) passam **a string crua** do `<input type="date">` (ex: `"2026-05-07"`) sem enrichment 00:00/23:59. Replicar esse comportamento — backend SP1/SP2/SP3 já aceita.

6. **Listagens com filtros URL-persisted** envolvem o componente interno em `<Suspense fallback={null}>` no default export. Padrão: `function FooPageInner() { ... } export default function FooPage() { return <Suspense fallback={null}><FooPageInner /></Suspense> }`. Necessário porque `useSearchParams` exige Suspense em Next 16.

7. **Pagination param**: backend usa `?page=&size=` para a maioria das rotas (orders, purchase-orders, stock-movements, ingredients, units, etc); **só `/products` usa `?pageSize=`**. Plano assume `&size=` para `/notifications` e `/audit-logs` (validar empiricamente; se backend devolver 400, ajustar pra `pageSize`).

8. **Sidebar (`app/(protected)/layout.tsx:42-83`) já tem entradas, mas com URLs erradas:**
   - "Notificações" → `/notifications` ✓ alinhado.
   - "Relatórios" → `/relatorios` ✗ deve virar `/reports`.
   - "Auditoria" → `/auditoria` ✗ deve virar `/audit-logs`.
   - Auditoria precisa ganhar `requireRole: "OWNER"`.
   Correção sai numa task dedicada (mesma postura do `chore` 33d8275 que alinhou hrefs SP2).

9. **Topbar (`app/(protected)/layout.tsx:204-211`) já tem ícone de sino**, mas é um `<button>` decorativo sem função. Será **substituído** por `<NotificationsBell />` no momento da Task 4.

10. **`useAllUsers`** não existe; criar em `lib/users.ts` espelhando `useAllUnits` (`lib/units.ts:61-69`). Como só é consumido em `/audit-logs` (que já é OWNER), o backend exigir OWNER para `GET /users` não é problema.

11. **Spec menciona "URL-persisted" para filtros de auditoria**. Replicar o padrão de `stock-movements/page.tsx` (Suspense + setFilter via `router.replace`). Filtros de relatório **NÃO** persistem (decisão consciente registrada na spec, premissa #6).

12. **Validação backend dos formatos de data**: `<input type="date">` produz `YYYY-MM-DD`. Backend aceita esse formato em SP1/SP2 (já testado em `useStockMovements`). Para `notifications`/`reports`/`audit-logs` o plano envia o mesmo formato; se backend rejeitar e exigir `LocalDateTime` completo, ajustar para `${value}T00:00:00` / `${value}T23:59:59` na função `setFilter`.

---

## Convenções importantes do projeto (ler antes de começar)

1. **Diretório de trabalho:** todos os comandos rodam a partir de `frontend/`.

2. **Localização de testes:** `frontend/tests/` flat — não há subpastas. Glob: `tests/**/*.test.{ts,tsx}`.
   - Schemas zod: extender `tests/schemas.test.ts` (não criar arquivos novos).
   - Hooks/API com mock do axios: criar `tests/<recurso>-hooks.test.ts` quando justifica isolamento.
   - Testes de página: criar `tests/<recurso>-page.test.tsx`.
   - Componentes isolados: `tests/<componente>.test.tsx`.

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
       usePathname: () => "/notifications",
       useParams: () => ({}),
   }))
   ```
   Variar `usePathname` / `useParams` por arquivo de teste.

5. **Envelope de resposta:** o interceptor do axios desembrulha `{ data: x }` → `x` quando o body tem **só** a chave `data`. Listas paginadas mantêm `{ data, page, size, total }` intactas (mais de uma chave). Mocks devem retornar com `data` interno conforme o caso.

6. **Mensagens de erro em pt** nos zod schemas: `z.string().min(1, "Informe a data inicial")`.

7. **Indentação:** projeto usa **4 espaços**.

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

12. **Commits:** padrão `feat(frontend): ...`, `test(frontend): ...`, `chore(frontend): ...`, `docs(sp4): ...`. Co-author do Claude no rodapé:
    ```
    Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
    ```

13. **Branch:** `feat/sp4-frontend-alerts-reports-audit` (já criada e com o spec commitado em `3c349b1`).

---

## Estrutura de arquivos (resultado final)

```
frontend/
├─ lib/
│  ├─ csv.ts                                            [NOVO]
│  ├─ notifications.ts                                  [NOVO]
│  ├─ reports.ts                                        [NOVO]
│  ├─ audit-logs.ts                                     [NOVO]
│  ├─ users.ts                                          [MODIFICAR — adicionar useAllUsers]
│  ├─ stock-movements.ts                                [MODIFICAR — invalidate ['notifications']]
│  ├─ orders.ts                                         [MODIFICAR — useStartOrder invalida ['notifications']]
│  └─ purchase-orders.ts                                [MODIFICAR — useReceivePurchaseOrder invalida ['notifications']]
├─ components/
│  ├─ notifications/
│  │  └─ notifications-bell.tsx                         [NOVO]
│  └─ reports/
│     ├─ kpi-card.tsx                                   [NOVO]
│     └─ export-csv-button.tsx                          [NOVO]
├─ app/(protected)/
│  ├─ layout.tsx                                        [MODIFICAR — sidebar URLs + topbar bell]
│  ├─ notifications/
│  │  ├─ page.tsx                                       [NOVO]
│  │  └─ [id]/page.tsx                                  [NOVO]
│  ├─ reports/
│  │  ├─ page.tsx                                       [NOVO]
│  │  ├─ consumption/page.tsx                           [NOVO]
│  │  ├─ sales/page.tsx                                 [NOVO]
│  │  ├─ waste/page.tsx                                 [NOVO]
│  │  └─ stock-status/page.tsx                          [NOVO]
│  └─ audit-logs/
│     ├─ page.tsx                                       [NOVO]
│     └─ [id]/page.tsx                                  [NOVO]
└─ tests/
   ├─ schemas.test.ts                                   [MODIFICAR — describes para reportsFiltersSchema]
   ├─ csv.test.ts                                       [NOVO]
   ├─ notifications-hooks.test.ts                       [NOVO]
   ├─ notifications-page.test.tsx                       [NOVO]
   ├─ notifications-detail-page.test.tsx                [NOVO]
   ├─ notifications-bell.test.tsx                       [NOVO]
   ├─ reports-hooks.test.ts                             [NOVO]
   ├─ reports-page.test.tsx                             [NOVO — cobre os 4 relatórios em describes]
   ├─ audit-logs-hooks.test.ts                          [NOVO]
   ├─ audit-logs-page.test.tsx                          [NOVO]
   └─ audit-logs-detail-page.test.tsx                   [NOVO]
```

---

## Ordem de execução

```
1.  lib/csv.ts (helper isolado, sem deps)
2.  lib/users.ts: + useAllUsers (consumido em audit-logs)
3.  lib/notifications.ts (types + hooks)
4.  components/notifications/notifications-bell.tsx
5.  /notifications listagem
6.  /notifications/[id] detalhe
7.  lib/reports.ts (types + filters schema + 4 hooks) + schemas tests
8.  components/reports/{kpi-card, export-csv-button}.tsx
9.  /reports hub + 4 sub-rotas (consumption, sales, waste, stock-status)
10. lib/audit-logs.ts (types + helpers + hooks)
11. /audit-logs listagem
12. /audit-logs/[id] detalhe
13. Cross-module invalidation: stock-movements, orders, purchase-orders
14. Sidebar URLs + topbar bell wiring
15. Sanity final: full test run + build
```

A ordem garante que cada task tem dependências já implementadas. CSV vem antes dos relatórios. Notifications vem antes do bell. `useAllUsers` antes de audit-logs.

---

## Task 1: `lib/csv.ts` — helper de CSV

**Files:**
- Create: `frontend/lib/csv.ts`
- Create: `frontend/tests/csv.test.ts`

**Why:** Helper puro consumido pelo `<ExportCsvButton />`. Encoding UTF-8 + BOM para compatibilidade com Excel pt-BR; separador `;`; escape correto de aspas/separadores/newlines.

- [ ] **Step 1: Criar `frontend/lib/csv.ts`**

```ts
const CSV_BOM = "﻿"
const CSV_SEP = ";"

function escapeCell(value: string | number): string {
    const s = typeof value === "number" ? value.toLocaleString("pt-BR") : value
    if (s.includes(CSV_SEP) || s.includes('"') || s.includes("\n") || s.includes("\r")) {
        return `"${s.replace(/"/g, '""')}"`
    }
    return s
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
    const lines = [headers.map(escapeCell).join(CSV_SEP)]
    for (const row of rows) {
        lines.push(row.map(escapeCell).join(CSV_SEP))
    }
    return CSV_BOM + lines.join("\r\n")
}

export function downloadCsv(filename: string, csv: string): void {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}
```

- [ ] **Step 2: Criar `frontend/tests/csv.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest"

import { downloadCsv, toCsv } from "@/lib/csv"

describe("toCsv", () => {
    it("prefixes BOM and joins headers with `;`", () => {
        const out = toCsv(["A", "B"], [])
        expect(out.startsWith("﻿")).toBe(true)
        expect(out.slice(1)).toBe("A;B")
    })

    it("formats numbers in pt-BR", () => {
        const out = toCsv(["Total"], [[1234.56]])
        expect(out).toContain("1.234,56")
    })

    it("escapes cells containing `;`, `\"`, newline", () => {
        const out = toCsv(["X"], [["a;b"], ['he said "hi"'], ["line1\nline2"]])
        expect(out).toContain('"a;b"')
        expect(out).toContain('"he said ""hi"""')
        expect(out).toContain('"line1\nline2"')
    })

    it("uses CRLF between rows", () => {
        const out = toCsv(["A"], [["1"], ["2"]])
        expect(out).toBe("﻿A\r\n1\r\n2")
    })
})

describe("downloadCsv", () => {
    it("creates a temporary anchor and clicks it", () => {
        const createObjectURL = vi.fn(() => "blob:mock")
        const revokeObjectURL = vi.fn()
        Object.defineProperty(window.URL, "createObjectURL", { value: createObjectURL, writable: true })
        Object.defineProperty(window.URL, "revokeObjectURL", { value: revokeObjectURL, writable: true })
        const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

        downloadCsv("test.csv", "﻿A;B")

        expect(createObjectURL).toHaveBeenCalledTimes(1)
        expect(click).toHaveBeenCalledTimes(1)
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock")
        click.mockRestore()
    })
})
```

- [ ] **Step 3: Rodar tests e verificar verde**

```bash
cd frontend && npm run test -- csv.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/csv.ts frontend/tests/csv.test.ts
git commit -m "$(cat <<'EOF'
feat(frontend): csv helper with UTF-8 BOM + pt-BR number formatting

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `lib/users.ts` — adicionar `useAllUsers`

**Files:**
- Modify: `frontend/lib/users.ts` (após `useUsers`, ~linha 44)

**Why:** Necessário para popular o select de "Ator" nos filtros de `/audit-logs`. Espelhar `useAllUnits`/`useAllProducts`. Como o consumidor (`/audit-logs`) é OWNER-only, não há risco com permissão de `GET /users`.

- [ ] **Step 1: Modificar `frontend/lib/users.ts` adicionando `useAllUsers` depois de `useUsers`**

Inserir entre `useUsers` (linha 44) e `useCreateUser` (linha 46):

```ts
export function useAllUsers() {
    return useQuery({
        queryKey: ["users", "all"],
        queryFn: () =>
            api
                .get<Page<User>>("/users", { params: { page: 0, size: 1000 } })
                .then((r) => r.data.data),
        staleTime: 5 * 60 * 1000,
    })
}
```

- [ ] **Step 2: Verificar que o app ainda buildA (sanity)**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/users.ts
git commit -m "$(cat <<'EOF'
feat(frontend): useAllUsers helper for SP4 audit-logs select

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `lib/notifications.ts` — types + hooks

**Files:**
- Create: `frontend/lib/notifications.ts`
- Create: `frontend/tests/notifications-hooks.test.ts`

**Why:** Camada de dados de notifications. Inclui `useActiveNotificationsBell` (compartilhado entre sino e badge da sidebar) com `refetchInterval: 60_000`.

- [ ] **Step 1: Criar `frontend/lib/notifications.ts`**

```ts
import { api } from "@/lib/api"
import type { Page } from "@/lib/users"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

export const NOTIFICATION_TYPES = ["LOW_STOCK"] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const NOTIFICATION_STATUSES = ["ACTIVE", "RESOLVED"] as const
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
    resolvedBy: { id: string; name: string } | null
}

export type NotificationFilters = {
    status?: NotificationStatus
    unit?: string
    from?: string
    to?: string
    page?: number
    size?: number
}

export function useNotifications(filters: NotificationFilters = {}) {
    const page = filters.page ?? 0
    const size = filters.size ?? 20
    const params: Record<string, string | number> = { page, size }
    if (filters.status) params.status = filters.status
    if (filters.unit) params.unit = filters.unit
    if (filters.from) params.from = filters.from
    if (filters.to) params.to = filters.to
    return useQuery({
        queryKey: [
            "notifications",
            {
                status: filters.status ?? null,
                unit: filters.unit ?? null,
                from: filters.from ?? null,
                to: filters.to ?? null,
                page,
                size,
            },
        ],
        queryFn: () =>
            api.get<Page<Notification>>("/notifications", { params }).then((r) => r.data),
    })
}

export function useNotification(id: string) {
    return useQuery({
        queryKey: ["notifications", id],
        queryFn: () =>
            api.get<Notification>(`/notifications/${id}`).then((r) => r.data),
        enabled: !!id,
    })
}

export function useResolveNotification() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) =>
            api.post<Notification>(`/notifications/${id}/resolve`).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
    })
}

export function useActiveNotificationsBell() {
    const query = useQuery({
        queryKey: [
            "notifications",
            { status: "ACTIVE", unit: null, from: null, to: null, page: 0, size: 5 },
        ],
        queryFn: () =>
            api
                .get<Page<Notification>>("/notifications", {
                    params: { page: 0, size: 5, status: "ACTIVE" },
                })
                .then((r) => r.data),
        refetchInterval: 60_000,
        staleTime: 30_000,
        refetchOnWindowFocus: true,
    })
    return {
        total: query.data?.total ?? 0,
        items: query.data?.data ?? [],
        isLoading: query.isLoading,
        isError: query.isError,
        refetch: query.refetch,
    }
}
```

- [ ] **Step 2: Criar `frontend/tests/notifications-hooks.test.ts`**

```ts
import { renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
    useActiveNotificationsBell,
    useNotification,
    useNotifications,
    useResolveNotification,
} from "@/lib/notifications"

import { getCalls, renderWithProviders, resetMockApi, setHandler } from "./helpers"
import type { ReactNode } from "react"

function wrapper({ children }: { children: ReactNode }) {
    return renderWithProviders(<>{children}</>) as unknown as ReactNode
}

beforeEach(() => resetMockApi())
afterEach(() => resetMockApi())

describe("useNotifications", () => {
    it("sends status, unit, from, to, page, size when present", async () => {
        setHandler(() => ({
            status: 200,
            data: { data: [], page: 0, size: 20, total: 0 },
        }))
        const { result } = renderHook(
            () =>
                useNotifications({
                    status: "ACTIVE",
                    unit: "u-1",
                    from: "2026-05-01",
                    to: "2026-05-07",
                }),
            { wrapper },
        )
        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        const params = getCalls()[0]?.params as Record<string, unknown>
        expect(params.status).toBe("ACTIVE")
        expect(params.unit).toBe("u-1")
        expect(params.from).toBe("2026-05-01")
        expect(params.to).toBe("2026-05-07")
        expect(params.page).toBe(0)
        expect(params.size).toBe(20)
    })

    it("omits filters that are absent", async () => {
        setHandler(() => ({
            status: 200,
            data: { data: [], page: 0, size: 20, total: 0 },
        }))
        renderHook(() => useNotifications(), { wrapper })
        await waitFor(() => expect(getCalls().length).toBeGreaterThan(0))
        const params = getCalls()[0]?.params as Record<string, unknown>
        expect(params.status).toBeUndefined()
        expect(params.unit).toBeUndefined()
    })
})

describe("useNotification", () => {
    it("fetches single by id and unwraps envelope", async () => {
        setHandler(() => ({
            status: 200,
            data: { data: { id: "n-1", type: "LOW_STOCK" } },
        }))
        const { result } = renderHook(() => useNotification("n-1"), { wrapper })
        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect((result.current.data as { id: string }).id).toBe("n-1")
        expect(getCalls()[0]?.url).toBe("/notifications/n-1")
    })
})

describe("useResolveNotification", () => {
    it("posts to /notifications/{id}/resolve and invalidates", async () => {
        setHandler(() => ({ status: 200, data: { data: { id: "n-1" } } }))
        const { result } = renderHook(() => useResolveNotification(), { wrapper })
        await result.current.mutateAsync("n-1")
        const call = getCalls()[0]
        expect(call?.method).toBe("post")
        expect(call?.url).toBe("/notifications/n-1/resolve")
    })
})

describe("useActiveNotificationsBell", () => {
    it("fetches with status=ACTIVE and size=5; exposes total", async () => {
        setHandler(() => ({
            status: 200,
            data: {
                data: [{ id: "n-1" }],
                page: 0,
                size: 5,
                total: 7,
            },
        }))
        const { result } = renderHook(() => useActiveNotificationsBell(), {
            wrapper,
        })
        await waitFor(() => expect(result.current.total).toBe(7))
        const params = getCalls()[0]?.params as Record<string, unknown>
        expect(params.status).toBe("ACTIVE")
        expect(params.size).toBe(5)
        expect(result.current.items).toHaveLength(1)
    })
})
```

- [ ] **Step 3: Rodar tests**

```bash
cd frontend && npm run test -- notifications-hooks.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/notifications.ts frontend/tests/notifications-hooks.test.ts
git commit -m "$(cat <<'EOF'
feat(frontend): notifications types and TanStack hooks

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `<NotificationsBell />` — sino do header

**Files:**
- Create: `frontend/components/notifications/notifications-bell.tsx`
- Create: `frontend/tests/notifications-bell.test.tsx`

**Why:** Substitui o botão decorativo do header existente em `app/(protected)/layout.tsx:204-211`. Mostra badge contador, popover com 5 alertas mais recentes, link para `/notifications`. Usa `useActiveNotificationsBell` (polling 60s).

- [ ] **Step 1: Criar `frontend/components/notifications/notifications-bell.tsx`**

```tsx
"use client"

import { useActiveNotificationsBell } from "@/lib/notifications"
import { Bell } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

function relativeTime(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime()
    const m = Math.floor(ms / 60_000)
    if (m < 1) return "agora"
    if (m < 60) return `há ${m}min`
    const h = Math.floor(m / 60)
    if (h < 24) return `há ${h}h`
    const d = Math.floor(h / 24)
    return `há ${d}d`
}

export function NotificationsBell() {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    const { total, items, isLoading, isError, refetch } = useActiveNotificationsBell()

    useEffect(() => {
        function onClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        if (open) document.addEventListener("mousedown", onClickOutside)
        return () => document.removeEventListener("mousedown", onClickOutside)
    }, [open])

    const badge = total > 9 ? "9+" : total > 0 ? String(total) : null

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="relative flex h-9 w-9 items-center justify-center rounded-md text-text-primary/70 transition hover:bg-text-primary/5 hover:text-text-primary"
                aria-label="Notificações"
            >
                <Bell className="h-5 w-5" />
                {badge ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                        {badge}
                    </span>
                ) : null}
            </button>

            {open ? (
                <div className="absolute right-0 mt-2 w-80 max-w-sm overflow-hidden rounded-lg border border-border/40 bg-white shadow-lg">
                    <div className="flex items-center justify-between border-b border-border/40 px-4 py-2">
                        <p className="text-sm font-medium text-text-primary">
                            Alertas ativos ({total})
                        </p>
                        <Link
                            href="/notifications"
                            onClick={() => setOpen(false)}
                            className="text-xs text-primary hover:underline"
                        >
                            Ver todos →
                        </Link>
                    </div>
                    {isLoading ? (
                        <div className="space-y-2 p-3">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="h-12 animate-pulse rounded-md bg-text-primary/5"
                                />
                            ))}
                        </div>
                    ) : isError ? (
                        <div className="px-4 py-6 text-center">
                            <p className="text-sm text-danger">
                                Não foi possível carregar alertas.
                            </p>
                            <button
                                type="button"
                                onClick={() => refetch()}
                                className="mt-2 text-xs text-primary hover:underline"
                            >
                                Tentar novamente
                            </button>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="px-4 py-6 text-center">
                            <p className="text-sm text-text-secondary">
                                Nenhum alerta ativo no momento.
                            </p>
                        </div>
                    ) : (
                        <ul className="max-h-80 overflow-y-auto">
                            {items.map((n) => (
                                <li key={n.id} className="border-b border-border/30 last:border-0">
                                    <Link
                                        href={`/notifications/${n.id}`}
                                        onClick={() => setOpen(false)}
                                        className="block px-4 py-2 hover:bg-text-primary/5"
                                    >
                                        <p className="truncate text-sm font-medium text-text-primary">
                                            {n.ingredientName} · {n.unitName}
                                        </p>
                                        <p className="truncate text-xs text-text-secondary">
                                            {n.message}
                                        </p>
                                        <p className="mt-0.5 text-[10px] text-text-secondary/70">
                                            {relativeTime(n.createdAt)}
                                        </p>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            ) : null}
        </div>
    )
}
```

- [ ] **Step 2: Criar `frontend/tests/notifications-bell.test.tsx`**

```tsx
import { fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { NotificationsBell } from "@/components/notifications/notifications-bell"

import { renderWithProviders, resetMockApi, setHandler } from "./helpers"

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/home",
    useParams: () => ({}),
}))

function withItems(total: number, items: unknown[]) {
    setHandler(() => ({
        status: 200,
        data: { data: items, page: 0, size: 5, total },
    }))
}

beforeEach(() => resetMockApi())
afterEach(() => resetMockApi())

describe("<NotificationsBell />", () => {
    it("shows badge with count", async () => {
        withItems(3, [
            {
                id: "n-1",
                ingredientName: "Mozzarella",
                unitName: "Centro",
                message: "abaixo do mínimo",
                createdAt: new Date().toISOString(),
            },
        ])
        renderWithProviders(<NotificationsBell />)
        await waitFor(() => expect(screen.getByText("3")).toBeInTheDocument())
    })

    it("renders 9+ when total >= 10", async () => {
        withItems(10, [])
        renderWithProviders(<NotificationsBell />)
        await waitFor(() => expect(screen.getByText("9+")).toBeInTheDocument())
    })

    it("opens popover on click and shows empty state", async () => {
        withItems(0, [])
        renderWithProviders(<NotificationsBell />)
        await waitFor(() =>
            expect(screen.queryByText(/Carregando/)).not.toBeInTheDocument(),
        )
        fireEvent.click(screen.getByLabelText("Notificações"))
        expect(
            screen.getByText("Nenhum alerta ativo no momento."),
        ).toBeInTheDocument()
    })

    it("links to /notifications via 'Ver todos'", async () => {
        withItems(2, [
            {
                id: "n-1",
                ingredientName: "Mozzarella",
                unitName: "Centro",
                message: "msg",
                createdAt: new Date().toISOString(),
            },
        ])
        renderWithProviders(<NotificationsBell />)
        await waitFor(() => expect(screen.getByText("2")).toBeInTheDocument())
        fireEvent.click(screen.getByLabelText("Notificações"))
        const link = screen.getByText(/Ver todos/) as HTMLAnchorElement
        expect(link.getAttribute("href")).toBe("/notifications")
    })
})
```

- [ ] **Step 3: Rodar tests**

```bash
cd frontend && npm run test -- notifications-bell.test.tsx
```

Expected: 4 tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/notifications frontend/tests/notifications-bell.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): NotificationsBell with 60s polling and popover

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `/notifications` — listagem

**Files:**
- Create: `frontend/app/(protected)/notifications/page.tsx`
- Create: `frontend/tests/notifications-page.test.tsx`

**Why:** Lista paginada com filtros URL-persisted (status default ACTIVE, unidade, datas). Tabela read-only (mutação só no detalhe).

- [ ] **Step 1: Criar `frontend/app/(protected)/notifications/page.tsx`**

```tsx
"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import {
    NOTIFICATION_STATUSES,
    useNotifications,
    type NotificationStatus,
} from "@/lib/notifications"
import { useAllUnits } from "@/lib/units"
import { Eye } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

function statusVariant(s: NotificationStatus) {
    return s === "ACTIVE" ? "danger" : "neutral"
}

function statusLabel(s: NotificationStatus) {
    return s === "ACTIVE" ? "Ativo" : "Resolvido"
}

function extractUom(message: string): string {
    // formato backend: "<ing> abaixo do mínimo na unidade <unit>: <qty> <uom> ≤ <min> <uom>"
    const match = message.match(/:\s*[\d.,]+\s+(\S+)\s+≤/)
    return match?.[1] ?? ""
}

function NotificationsPageInner() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const statusParam =
        (searchParams.get("status") as NotificationStatus | null) ?? "ACTIVE"
    const unitParam = searchParams.get("unit") ?? ""
    const fromParam = searchParams.get("from") ?? ""
    const toParam = searchParams.get("to") ?? ""

    const [page, setPage] = useState(0)
    const size = 20

    const query = useNotifications({
        status: statusParam || undefined,
        unit: unitParam || undefined,
        from: fromParam || undefined,
        to: toParam || undefined,
        page,
        size,
    })
    const units = useAllUnits()

    function setFilter(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString())
        if (value === "") params.delete(key)
        else params.set(key, value)
        setPage(0)
        router.replace(`/notifications?${params.toString()}`)
    }

    const data = query.data
    const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-semibold text-text-primary">Alertas</h1>
                <p className="mt-1 text-sm text-text-secondary">
                    Alertas operacionais — estoque abaixo do mínimo.
                </p>
            </header>

            <div className="flex flex-wrap items-end gap-3">
                <Field label="Status" htmlFor="filter-status">
                    <Select
                        id="filter-status"
                        value={statusParam}
                        onChange={(e) => setFilter("status", e.target.value)}
                    >
                        <option value="">Todos</option>
                        {NOTIFICATION_STATUSES.map((s) => (
                            <option key={s} value={s}>
                                {statusLabel(s)}
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
                    <p className="text-sm text-danger">Falha ao carregar alertas.</p>
                    <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
                        Tentar novamente
                    </Button>
                </div>
            ) : data && data.data.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                    <p className="text-sm text-text-secondary">Nenhum alerta no período.</p>
                </div>
            ) : (
                <Table>
                    <THead>
                        <TR>
                            <TH>Ingrediente</TH>
                            <TH>Unidade</TH>
                            <TH>Mensagem</TH>
                            <TH>Saldo / Mínimo</TH>
                            <TH>Status</TH>
                            <TH>Disparado em</TH>
                            <TH>Resolvido em</TH>
                            <TH>Ações</TH>
                        </TR>
                    </THead>
                    <TBody>
                        {data!.data.map((n) => {
                            const uom = extractUom(n.message)
                            return (
                                <TR key={n.id}>
                                    <TD>{n.ingredientName}</TD>
                                    <TD>{n.unitName}</TD>
                                    <TD className="max-w-xs truncate" title={n.message}>
                                        {n.message}
                                    </TD>
                                    <TD>
                                        {n.triggeredQuantity} / {n.minQuantity} {uom}
                                    </TD>
                                    <TD>
                                        <Badge variant={statusVariant(n.status)}>
                                            {statusLabel(n.status)}
                                        </Badge>
                                    </TD>
                                    <TD>
                                        {new Date(n.createdAt).toLocaleString("pt-BR")}
                                    </TD>
                                    <TD>
                                        {n.resolvedAt
                                            ? new Date(n.resolvedAt).toLocaleString("pt-BR")
                                            : "—"}
                                    </TD>
                                    <TD>
                                        <Link
                                            href={`/notifications/${n.id}`}
                                            className="inline-flex items-center gap-1 text-primary hover:underline"
                                        >
                                            <Eye className="h-4 w-4" />
                                            Ver
                                        </Link>
                                    </TD>
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

export default function NotificationsPage() {
    return (
        <Suspense fallback={null}>
            <NotificationsPageInner />
        </Suspense>
    )
}
```

- [ ] **Step 2: Criar `frontend/tests/notifications-page.test.tsx`**

```tsx
import { screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import NotificationsPage from "@/app/(protected)/notifications/page"

import { renderWithProviders, resetMockApi, setHandler } from "./helpers"

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/notifications",
    useParams: () => ({}),
}))

beforeEach(() => resetMockApi())
afterEach(() => resetMockApi())

const sample = {
    id: "n-1",
    type: "LOW_STOCK",
    status: "ACTIVE",
    ingredientId: "i-1",
    ingredientName: "Mozzarella",
    unitId: "u-1",
    unitName: "Centro",
    message: "Mozzarella abaixo do mínimo na unidade Centro: 0.500 kg ≤ 1.000 kg",
    triggeredQuantity: 0.5,
    minQuantity: 1.0,
    createdAt: "2026-05-07T12:00:00",
    resolvedAt: null,
    resolvedBy: null,
}

describe("/notifications", () => {
    it("renders rows with extracted unit of measure", async () => {
        setHandler((cfg) => {
            if (cfg.url === "/notifications") {
                return {
                    status: 200,
                    data: { data: [sample], page: 0, size: 20, total: 1 },
                }
            }
            return { status: 200, data: { data: [], page: 0, size: 1000, total: 0 } }
        })
        renderWithProviders(<NotificationsPage />)
        await waitFor(() =>
            expect(screen.getByText("Mozzarella")).toBeInTheDocument(),
        )
        expect(screen.getByText("0.5 / 1 kg")).toBeInTheDocument()
        expect(screen.getByText("Ativo")).toBeInTheDocument()
    })

    it("shows empty state when no rows", async () => {
        setHandler(() => ({
            status: 200,
            data: { data: [], page: 0, size: 20, total: 0 },
        }))
        renderWithProviders(<NotificationsPage />)
        await waitFor(() =>
            expect(screen.getByText("Nenhum alerta no período.")).toBeInTheDocument(),
        )
    })

    it("requests with status=ACTIVE by default", async () => {
        const calls: { params?: Record<string, unknown> }[] = []
        setHandler((cfg) => {
            calls.push({ params: cfg.params as Record<string, unknown> })
            return {
                status: 200,
                data: { data: [], page: 0, size: 20, total: 0 },
            }
        })
        renderWithProviders(<NotificationsPage />)
        await waitFor(() => expect(calls.length).toBeGreaterThan(0))
        const notifCall = calls.find((c) => c.params && "status" in c.params)
        expect(notifCall?.params?.status).toBe("ACTIVE")
    })
})
```

- [ ] **Step 3: Rodar tests**

```bash
cd frontend && npm run test -- notifications-page.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/\(protected\)/notifications/page.tsx frontend/tests/notifications-page.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): /notifications listing with status/unit/date filters

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `/notifications/[id]` — detalhe + ação resolver

**Files:**
- Create: `frontend/app/(protected)/notifications/[id]/page.tsx`
- Create: `frontend/tests/notifications-detail-page.test.tsx`

**Why:** Detalhe read-only com 2 cards (alerta + saldo no disparo). Botão "Resolver" só para OWNER + status ACTIVE, com `<ConfirmDialog>`.

- [ ] **Step 1: Criar `frontend/app/(protected)/notifications/[id]/page.tsx`**

```tsx
"use client"

import { ConfirmDialog } from "@/components/overlays/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { isApiError, useAuth } from "@/lib/auth"
import {
    useNotification,
    useResolveNotification,
    type NotificationStatus,
} from "@/lib/notifications"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

function statusVariant(s: NotificationStatus) {
    return s === "ACTIVE" ? "danger" : "neutral"
}

function statusLabel(s: NotificationStatus) {
    return s === "ACTIVE" ? "Ativo" : "Resolvido"
}

function extractUom(message: string): string {
    const match = message.match(/:\s*[\d.,]+\s+(\S+)\s+≤/)
    return match?.[1] ?? ""
}

export default function NotificationDetailPage() {
    const { user } = useAuth()
    const params = useParams<{ id: string }>()
    const id = params.id
    const query = useNotification(id)
    const resolveMutation = useResolveNotification()
    const [confirmOpen, setConfirmOpen] = useState(false)

    if (query.isLoading) {
        return (
            <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-10 animate-pulse rounded-lg bg-text-primary/5" />
                ))}
            </div>
        )
    }

    if (query.isError || !query.data) {
        return (
            <div className="text-center">
                <p className="text-sm text-danger">Não foi possível carregar o alerta.</p>
                <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
                    Tentar novamente
                </Button>
            </div>
        )
    }

    const n = query.data
    const uom = extractUom(n.message)
    const canResolve = user?.role === "OWNER" && n.status === "ACTIVE"

    async function onConfirmResolve() {
        try {
            await resolveMutation.mutateAsync(n.id)
            toast.success("Alerta marcado como resolvido")
            setConfirmOpen(false)
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao resolver alerta")
        }
    }

    return (
        <div className="space-y-6">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-sm text-text-secondary">
                        <Link href="/notifications" className="hover:underline">
                            Alertas
                        </Link>{" "}
                        › #{n.id.slice(0, 8)}
                    </p>
                    <h1 className="mt-1 text-2xl font-semibold text-text-primary">
                        Alerta de estoque baixo
                    </h1>
                </div>
                {canResolve ? (
                    <Button onClick={() => setConfirmOpen(true)}>Resolver</Button>
                ) : null}
            </header>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border/40 bg-white p-5">
                    <h2 className="text-base font-semibold text-text-primary">Alerta</h2>
                    <dl className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between gap-3">
                            <dt className="text-text-secondary">Tipo</dt>
                            <dd className="text-text-primary">{n.type}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                            <dt className="text-text-secondary">Status</dt>
                            <dd>
                                <Badge variant={statusVariant(n.status)}>
                                    {statusLabel(n.status)}
                                </Badge>
                            </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                            <dt className="text-text-secondary">Ingrediente</dt>
                            <dd>
                                <Link
                                    href={`/ingredients/${n.ingredientId}`}
                                    className="text-primary hover:underline"
                                >
                                    {n.ingredientName}
                                </Link>
                            </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                            <dt className="text-text-secondary">Unidade</dt>
                            <dd className="text-text-primary">{n.unitName}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                            <dt className="text-text-secondary">Mensagem</dt>
                            <dd className="text-right text-text-primary">{n.message}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                            <dt className="text-text-secondary">Disparado em</dt>
                            <dd className="text-text-primary">
                                {new Date(n.createdAt).toLocaleString("pt-BR")}
                            </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                            <dt className="text-text-secondary">Resolvido em</dt>
                            <dd className="text-text-primary">
                                {n.resolvedAt
                                    ? new Date(n.resolvedAt).toLocaleString("pt-BR")
                                    : "—"}
                            </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                            <dt className="text-text-secondary">Resolvido por</dt>
                            <dd className="text-text-primary">
                                {n.resolvedBy
                                    ? n.resolvedBy.name
                                    : n.status === "RESOLVED"
                                      ? "Resolução automática"
                                      : "—"}
                            </dd>
                        </div>
                    </dl>
                </div>

                <div className="rounded-xl border border-border/40 bg-white p-5">
                    <h2 className="text-base font-semibold text-text-primary">
                        Saldo no disparo
                    </h2>
                    <dl className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between gap-3">
                            <dt className="text-text-secondary">Quantidade no momento</dt>
                            <dd className="text-text-primary">
                                {n.triggeredQuantity} {uom}
                            </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                            <dt className="text-text-secondary">Mínimo configurado</dt>
                            <dd className="text-text-primary">
                                {n.minQuantity} {uom}
                            </dd>
                        </div>
                    </dl>
                    <Link
                        href={`/stock?ingredient=${n.ingredientId}&unit=${n.unitId}`}
                        className="mt-4 inline-block text-sm text-primary hover:underline"
                    >
                        Ver estoque atual deste ingrediente nesta unidade →
                    </Link>
                </div>
            </div>

            <ConfirmDialog
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={onConfirmResolve}
                title="Resolver alerta"
                message="Marcar este alerta como resolvido? A resolução manual não recoloca estoque — confirme apenas se o problema já foi tratado (compra recebida, ajuste lançado, etc.)."
                confirmLabel="Resolver"
                confirmVariant="primary"
                loading={resolveMutation.isPending}
            />
        </div>
    )
}
```

- [ ] **Step 2: Criar `frontend/tests/notifications-detail-page.test.tsx`**

```tsx
import { fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import NotificationDetailPage from "@/app/(protected)/notifications/[id]/page"
import { tokenStorage } from "@/lib/api"

import { getCalls, renderWithProviders, resetMockApi, setHandler } from "./helpers"

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/notifications/n-1",
    useParams: () => ({ id: "n-1" }),
}))

const sample = {
    id: "n-1",
    type: "LOW_STOCK",
    status: "ACTIVE",
    ingredientId: "i-1",
    ingredientName: "Mozzarella",
    unitId: "u-1",
    unitName: "Centro",
    message: "Mozzarella abaixo do mínimo na unidade Centro: 0.500 kg ≤ 1.000 kg",
    triggeredQuantity: 0.5,
    minQuantity: 1.0,
    createdAt: "2026-05-07T12:00:00",
    resolvedAt: null,
    resolvedBy: null,
}

function setAuth(role: "OWNER" | "EMPLOYEE") {
    tokenStorage.setAccess("fake")
    tokenStorage.setRefresh("fake")
    localStorage.setItem(
        "fv.user",
        JSON.stringify({
            id: "u-1",
            name: "Test",
            email: "t@t.com",
            role,
            active: true,
        }),
    )
}

beforeEach(() => resetMockApi())
afterEach(() => resetMockApi())

describe("/notifications/[id]", () => {
    it("OWNER sees Resolver button on ACTIVE alert", async () => {
        setAuth("OWNER")
        setHandler(() => ({ status: 200, data: { data: sample } }))
        renderWithProviders(<NotificationDetailPage />)
        await waitFor(() =>
            expect(screen.getByText("Mozzarella")).toBeInTheDocument(),
        )
        expect(screen.getByText("Resolver")).toBeInTheDocument()
    })

    it("EMPLOYEE does not see Resolver button", async () => {
        setAuth("EMPLOYEE")
        setHandler(() => ({ status: 200, data: { data: sample } }))
        renderWithProviders(<NotificationDetailPage />)
        await waitFor(() =>
            expect(screen.getByText("Mozzarella")).toBeInTheDocument(),
        )
        expect(screen.queryByText("Resolver")).not.toBeInTheDocument()
    })

    it("clicking Resolver opens dialog and confirming POSTs", async () => {
        setAuth("OWNER")
        setHandler((cfg) => {
            if (cfg.method === "post") {
                return {
                    status: 200,
                    data: { data: { ...sample, status: "RESOLVED" } },
                }
            }
            return { status: 200, data: { data: sample } }
        })
        renderWithProviders(<NotificationDetailPage />)
        await waitFor(() => expect(screen.getByText("Resolver")).toBeInTheDocument())
        fireEvent.click(screen.getByText("Resolver"))
        // dialog visível
        const confirmBtn = await screen.findByText("Resolver", { selector: "button" })
        fireEvent.click(confirmBtn)
        await waitFor(() => {
            const post = getCalls().find((c) => c.method === "post")
            expect(post?.url).toBe("/notifications/n-1/resolve")
        })
    })

    it("shows 'Resolução automática' when resolvedBy is null and status RESOLVED", async () => {
        setAuth("OWNER")
        setHandler(() => ({
            status: 200,
            data: {
                data: {
                    ...sample,
                    status: "RESOLVED",
                    resolvedAt: "2026-05-07T13:00:00",
                    resolvedBy: null,
                },
            },
        }))
        renderWithProviders(<NotificationDetailPage />)
        await waitFor(() =>
            expect(screen.getByText("Resolução automática")).toBeInTheDocument(),
        )
    })
})
```

- [ ] **Step 3: Rodar tests**

```bash
cd frontend && npm run test -- notifications-detail-page.test.tsx
```

Expected: 4 tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/\(protected\)/notifications/\[id\]/page.tsx frontend/tests/notifications-detail-page.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): /notifications/[id] detail with resolve action

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `lib/reports.ts` — types + filters schema + 4 hooks

**Files:**
- Create: `frontend/lib/reports.ts`
- Modify: `frontend/tests/schemas.test.ts` (adicionar describe `reportsFiltersSchema`)
- Create: `frontend/tests/reports-hooks.test.ts`

**Why:** Camada de dados dos 4 relatórios. Cada hook tem `enabled` baseado em presença de filtros mandatórios. Validação client-side de `from <= to` em filtros via zod.

- [ ] **Step 1: Criar `frontend/lib/reports.ts`**

```ts
import { api } from "@/lib/api"
import { useQuery } from "@tanstack/react-query"
import { z } from "zod"

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

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
    size: "P" | "M" | "G" | "GG"
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
    level: "LOW" | "WARNING" | "OK"
}

export const reportsRangeFiltersSchema = z
    .object({
        from: z.string().min(1, "Informe a data inicial"),
        to: z.string().min(1, "Informe a data final"),
        unit: z.string().regex(UUID_REGEX).optional().or(z.literal("")),
        ingredient: z.string().regex(UUID_REGEX).optional().or(z.literal("")),
        product: z.string().regex(UUID_REGEX).optional().or(z.literal("")),
    })
    .refine((v) => new Date(v.from) <= new Date(v.to), {
        path: ["to"],
        message: '"Até" deve ser maior ou igual a "De"',
    })
export type ReportsRangeFiltersInput = z.infer<typeof reportsRangeFiltersSchema>

export type RangeReportFilters = {
    from: string
    to: string
    unit?: string
    ingredient?: string
    product?: string
}

function buildRangeParams(filters: RangeReportFilters) {
    const params: Record<string, string> = { from: filters.from, to: filters.to }
    if (filters.unit) params.unit = filters.unit
    if (filters.ingredient) params.ingredient = filters.ingredient
    if (filters.product) params.product = filters.product
    return params
}

export function useConsumptionReport(filters: RangeReportFilters) {
    const enabled = !!filters.from && !!filters.to
    return useQuery({
        queryKey: ["reports", "consumption", filters],
        queryFn: () =>
            api
                .get<ConsumptionReportRow[]>("/reports/consumption", {
                    params: buildRangeParams(filters),
                })
                .then((r) => r.data),
        enabled,
    })
}

export function useSalesReport(filters: RangeReportFilters) {
    const enabled = !!filters.from && !!filters.to
    return useQuery({
        queryKey: ["reports", "sales", filters],
        queryFn: () =>
            api
                .get<SalesReportRow[]>("/reports/sales", {
                    params: buildRangeParams(filters),
                })
                .then((r) => r.data),
        enabled,
    })
}

export function useWasteReport(filters: RangeReportFilters) {
    const enabled = !!filters.from && !!filters.to
    return useQuery({
        queryKey: ["reports", "waste", filters],
        queryFn: () =>
            api
                .get<WasteReportRow[]>("/reports/waste", {
                    params: buildRangeParams(filters),
                })
                .then((r) => r.data),
        enabled,
    })
}

export function useStockStatusReport(filters: { unit?: string }) {
    const params: Record<string, string> = {}
    if (filters.unit) params.unit = filters.unit
    return useQuery({
        queryKey: ["reports", "stock-status", filters],
        queryFn: () =>
            api
                .get<StockStatusRow[]>("/reports/stock-status", { params })
                .then((r) => r.data),
    })
}
```

> **Nota sobre desembrulhamento:** o interceptor desembrulha `{ data: x }` → `x` somente quando o body tem **apenas** a chave `data`. Os endpoints de relatório retornam `{ data: [...] }` (uma chave) → o resultado de `r.data` no hook já é o array `Row[]`.

- [ ] **Step 2: Modificar `frontend/tests/schemas.test.ts` adicionando describe**

Inserir no final do arquivo (antes do último `})` do último describe block — usar editor; aqui o describe novo:

```ts
describe("reportsRangeFiltersSchema", () => {
    const valid = {
        from: "2026-05-01",
        to: "2026-05-07",
        unit: "550e8400-e29b-41d4-a716-446655440000",
    }

    it("accepts valid input with optional unit", () => {
        const r = reportsRangeFiltersSchema.safeParse(valid)
        expect(r.success).toBe(true)
    })

    it("accepts empty optional fields", () => {
        const r = reportsRangeFiltersSchema.safeParse({
            from: "2026-05-01",
            to: "2026-05-07",
        })
        expect(r.success).toBe(true)
    })

    it("rejects from > to", () => {
        const r = reportsRangeFiltersSchema.safeParse({
            from: "2026-05-10",
            to: "2026-05-07",
        })
        expect(r.success).toBe(false)
        if (!r.success) {
            expect(r.error.issues[0]?.path).toEqual(["to"])
        }
    })

    it("rejects empty from/to", () => {
        const r = reportsRangeFiltersSchema.safeParse({ from: "", to: "" })
        expect(r.success).toBe(false)
    })

    it("rejects invalid UUID in optional unit", () => {
        const r = reportsRangeFiltersSchema.safeParse({
            ...valid,
            unit: "not-a-uuid",
        })
        expect(r.success).toBe(false)
    })
})
```

E adicionar no topo do arquivo (junto com os outros imports):

```ts
import { reportsRangeFiltersSchema } from "@/lib/reports"
```

- [ ] **Step 3: Criar `frontend/tests/reports-hooks.test.ts`**

```ts
import { renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
    useConsumptionReport,
    useSalesReport,
    useStockStatusReport,
    useWasteReport,
} from "@/lib/reports"

import { getCalls, renderWithProviders, resetMockApi, setHandler } from "./helpers"
import type { ReactNode } from "react"

function wrapper({ children }: { children: ReactNode }) {
    return renderWithProviders(<>{children}</>) as unknown as ReactNode
}

beforeEach(() => resetMockApi())
afterEach(() => resetMockApi())

describe("useConsumptionReport", () => {
    it("is disabled when from/to missing", () => {
        const { result } = renderHook(
            () => useConsumptionReport({ from: "", to: "" }),
            { wrapper },
        )
        expect(result.current.fetchStatus).toBe("idle")
        expect(getCalls().length).toBe(0)
    })

    it("sends from, to, unit, ingredient when present", async () => {
        setHandler(() => ({ status: 200, data: { data: [] } }))
        renderHook(
            () =>
                useConsumptionReport({
                    from: "2026-05-01",
                    to: "2026-05-07",
                    unit: "u-1",
                    ingredient: "i-1",
                }),
            { wrapper },
        )
        await waitFor(() => expect(getCalls().length).toBeGreaterThan(0))
        const params = getCalls()[0]?.params as Record<string, unknown>
        expect(params.from).toBe("2026-05-01")
        expect(params.to).toBe("2026-05-07")
        expect(params.unit).toBe("u-1")
        expect(params.ingredient).toBe("i-1")
    })
})

describe("useSalesReport", () => {
    it("sends product param", async () => {
        setHandler(() => ({ status: 200, data: { data: [] } }))
        renderHook(
            () =>
                useSalesReport({
                    from: "2026-05-01",
                    to: "2026-05-07",
                    product: "p-1",
                }),
            { wrapper },
        )
        await waitFor(() => expect(getCalls().length).toBeGreaterThan(0))
        expect(
            (getCalls()[0]?.params as Record<string, unknown>).product,
        ).toBe("p-1")
    })
})

describe("useWasteReport", () => {
    it("hits /reports/waste", async () => {
        setHandler(() => ({ status: 200, data: { data: [] } }))
        renderHook(
            () => useWasteReport({ from: "2026-05-01", to: "2026-05-07" }),
            { wrapper },
        )
        await waitFor(() => expect(getCalls()[0]?.url).toBe("/reports/waste"))
    })
})

describe("useStockStatusReport", () => {
    it("does not require date range", async () => {
        setHandler(() => ({ status: 200, data: { data: [] } }))
        renderHook(() => useStockStatusReport({}), { wrapper })
        await waitFor(() => expect(getCalls()[0]?.url).toBe("/reports/stock-status"))
    })

    it("sends unit when provided", async () => {
        setHandler(() => ({ status: 200, data: { data: [] } }))
        renderHook(() => useStockStatusReport({ unit: "u-1" }), { wrapper })
        await waitFor(() => expect(getCalls()[0]?.params).toBeDefined())
        expect(
            (getCalls()[0]?.params as Record<string, unknown>).unit,
        ).toBe("u-1")
    })
})
```

- [ ] **Step 4: Rodar tests**

```bash
cd frontend && npm run test -- schemas.test.ts reports-hooks.test.ts
```

Expected: schemas existentes continuam passando + 5 novos describes em `reportsRangeFiltersSchema` + 7 testes em hooks.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/reports.ts frontend/tests/schemas.test.ts frontend/tests/reports-hooks.test.ts
git commit -m "$(cat <<'EOF'
feat(frontend): reports types, filters schema and read-only hooks

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Componentes auxiliares de relatório

**Files:**
- Create: `frontend/components/reports/kpi-card.tsx`
- Create: `frontend/components/reports/export-csv-button.tsx`

**Why:** Componentes reutilizados pelas 4 telas de relatório. KPI mostra título + valor + opcional sublinha. Export gera CSV via `lib/csv.ts`.

- [ ] **Step 1: Criar `frontend/components/reports/kpi-card.tsx`**

```tsx
import type { ReactNode } from "react"

type Props = {
    label: string
    value: ReactNode
    subline?: string
}

export function KpiCard({ label, value, subline }: Props) {
    return (
        <div className="rounded-xl border border-border/40 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                {label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">{value}</p>
            {subline ? (
                <p className="mt-1 text-xs text-text-secondary">{subline}</p>
            ) : null}
        </div>
    )
}
```

- [ ] **Step 2: Criar `frontend/components/reports/export-csv-button.tsx`**

```tsx
"use client"

import { Button } from "@/components/ui/button"
import { downloadCsv, toCsv } from "@/lib/csv"
import { Download } from "lucide-react"

type Props = {
    filename: string
    headers: string[]
    rows: (string | number)[][]
}

export function ExportCsvButton({ filename, headers, rows }: Props) {
    const disabled = rows.length === 0

    function onClick() {
        const csv = toCsv(headers, rows)
        downloadCsv(filename, csv)
    }

    return (
        <Button variant="outline" size="sm" onClick={onClick} disabled={disabled}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
        </Button>
    )
}
```

- [ ] **Step 3: Verificar typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/reports
git commit -m "$(cat <<'EOF'
feat(frontend): KpiCard and ExportCsvButton for reports

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: `/reports` hub + 4 sub-rotas + tests

**Files:**
- Create: `frontend/app/(protected)/reports/page.tsx`
- Create: `frontend/app/(protected)/reports/consumption/page.tsx`
- Create: `frontend/app/(protected)/reports/sales/page.tsx`
- Create: `frontend/app/(protected)/reports/waste/page.tsx`
- Create: `frontend/app/(protected)/reports/stock-status/page.tsx`
- Create: `frontend/tests/reports-page.test.tsx`

**Why:** Hub é grid simples 2x2 de cards-link. Cada sub-rota tem mesmo esqueleto (filtros via RHF+zod, 3 KPIs, tabela, export CSV). Para reduzir duplicação no plano, mostro `consumption/page.tsx` completo e indico variações para os outros 3.

- [ ] **Step 1: Criar `frontend/app/(protected)/reports/page.tsx`**

```tsx
import { DollarSign, Package, Trash2, TrendingDown } from "lucide-react"
import Link from "next/link"

const CARDS = [
    {
        href: "/reports/consumption",
        icon: TrendingDown,
        title: "Consumo",
        description: "Total de saídas por ingrediente no período.",
    },
    {
        href: "/reports/sales",
        icon: DollarSign,
        title: "Vendas",
        description: "Pedidos concluídos por produto e receita gerada.",
    },
    {
        href: "/reports/waste",
        icon: Trash2,
        title: "Desperdício",
        description: "Ajustes negativos (perdas, quebras) por ingrediente.",
    },
    {
        href: "/reports/stock-status",
        icon: Package,
        title: "Status de estoque",
        description: "Visão atual de saldos vs. mínimos por unidade.",
    },
]

export default function ReportsHubPage() {
    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-semibold text-text-primary">Relatórios</h1>
                <p className="mt-1 text-sm text-text-secondary">
                    Indicadores operacionais para a gestão diária.
                </p>
            </header>

            <div className="grid gap-4 md:grid-cols-2">
                {CARDS.map(({ href, icon: Icon, title, description }) => (
                    <Link
                        key={href}
                        href={href}
                        className="flex items-start gap-3 rounded-xl border border-border/40 bg-white p-5 transition hover:border-primary/50 hover:bg-primary/5"
                    >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-base font-semibold text-text-primary">
                                {title}
                            </p>
                            <p className="mt-1 text-sm text-text-secondary">
                                {description}
                            </p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    )
}
```

- [ ] **Step 2: Criar `frontend/app/(protected)/reports/consumption/page.tsx`**

```tsx
"use client"

import { ExportCsvButton } from "@/components/reports/export-csv-button"
import { KpiCard } from "@/components/reports/kpi-card"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { useAllIngredients } from "@/lib/ingredients"
import {
    reportsRangeFiltersSchema,
    useConsumptionReport,
    type ReportsRangeFiltersInput,
} from "@/lib/reports"
import { useAllUnits } from "@/lib/units"
import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useState } from "react"
import { useForm } from "react-hook-form"

function startOfMonthISO(): string {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
function todayISO(): string {
    return new Date().toISOString().slice(0, 10)
}

export default function ConsumptionReportPage() {
    const [applied, setApplied] = useState<ReportsRangeFiltersInput | null>(null)
    const units = useAllUnits()
    const ingredients = useAllIngredients()

    const form = useForm<ReportsRangeFiltersInput>({
        resolver: zodResolver(reportsRangeFiltersSchema),
        defaultValues: {
            from: startOfMonthISO(),
            to: todayISO(),
            unit: "",
            ingredient: "",
        },
    })

    const query = useConsumptionReport({
        from: applied?.from ?? "",
        to: applied?.to ?? "",
        unit: applied?.unit || undefined,
        ingredient: applied?.ingredient || undefined,
    })

    function onSubmit(values: ReportsRangeFiltersInput) {
        setApplied(values)
    }

    const data = query.data ?? []
    const totalQty = data.reduce((acc, r) => acc + r.totalQuantity, 0)
    const distinctItems = data.length
    const top = [...data].sort((a, b) => b.totalQuantity - a.totalQuantity)[0]

    return (
        <div className="space-y-6">
            <header>
                <p className="text-sm text-text-secondary">
                    <Link href="/reports" className="hover:underline">
                        Relatórios
                    </Link>{" "}
                    › Consumo
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-text-primary">
                    Relatório de consumo
                </h1>
                <p className="mt-1 text-sm text-text-secondary">
                    Total de saídas (EXIT) por ingrediente no período.
                </p>
            </header>

            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="rounded-xl border border-border/40 bg-white p-5"
            >
                <div className="flex flex-wrap items-end gap-3">
                    <Field
                        label="De"
                        htmlFor="f-from"
                        error={form.formState.errors.from?.message}
                    >
                        <Input id="f-from" type="date" {...form.register("from")} />
                    </Field>
                    <Field
                        label="Até"
                        htmlFor="f-to"
                        error={form.formState.errors.to?.message}
                    >
                        <Input id="f-to" type="date" {...form.register("to")} />
                    </Field>
                    <Field label="Unidade" htmlFor="f-unit">
                        <Select id="f-unit" {...form.register("unit")}>
                            <option value="">Todas</option>
                            {units.data?.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.name}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Ingrediente" htmlFor="f-ingredient">
                        <Select id="f-ingredient" {...form.register("ingredient")}>
                            <option value="">Todos</option>
                            {ingredients.data?.map((i) => (
                                <option key={i.id} value={i.id}>
                                    {i.name}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Button type="submit">Aplicar</Button>
                </div>
            </form>

            {!applied ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                    <p className="text-sm text-text-secondary">
                        Selecione um período e clique em Aplicar.
                    </p>
                </div>
            ) : query.isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-12 animate-pulse rounded-lg bg-text-primary/5" />
                    ))}
                </div>
            ) : query.isError ? (
                <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
                    <p className="text-sm text-danger">Falha ao carregar relatório.</p>
                    <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
                        Tentar novamente
                    </Button>
                </div>
            ) : (
                <>
                    <div className="grid gap-3 md:grid-cols-3">
                        <KpiCard
                            label="Total geral"
                            value={totalQty.toLocaleString("pt-BR")}
                        />
                        <KpiCard label="Itens distintos" value={distinctItems} />
                        <KpiCard
                            label="Mais consumido"
                            value={top?.ingredientName ?? "—"}
                            subline={
                                top
                                    ? `${top.totalQuantity.toLocaleString("pt-BR")} ${top.unitOfMeasure}`
                                    : undefined
                            }
                        />
                    </div>

                    <div className="flex justify-end">
                        <ExportCsvButton
                            filename={`consumo_${todayISO()}.csv`}
                            headers={[
                                "Ingrediente",
                                "Unidade de medida",
                                "Total",
                                "Movimentos",
                            ]}
                            rows={data.map((r) => [
                                r.ingredientName,
                                r.unitOfMeasure,
                                r.totalQuantity,
                                r.movementCount,
                            ])}
                        />
                    </div>

                    {data.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                            <p className="text-sm text-text-secondary">
                                Nenhum dado para os filtros selecionados.
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <THead>
                                <TR>
                                    <TH>Ingrediente</TH>
                                    <TH>Unidade de medida</TH>
                                    <TH>Total</TH>
                                    <TH># movimentos</TH>
                                </TR>
                            </THead>
                            <TBody>
                                {data.map((r) => (
                                    <TR key={r.ingredientId}>
                                        <TD>{r.ingredientName}</TD>
                                        <TD>{r.unitOfMeasure}</TD>
                                        <TD>{r.totalQuantity.toLocaleString("pt-BR")}</TD>
                                        <TD>{r.movementCount}</TD>
                                    </TR>
                                ))}
                            </TBody>
                        </Table>
                    )}
                </>
            )}
        </div>
    )
}
```

- [ ] **Step 3: Criar `frontend/app/(protected)/reports/sales/page.tsx`**

Mesmo esqueleto, com as seguintes diferenças concretas:
- Usar `useSalesReport` em vez de `useConsumptionReport`.
- Filtro adicional `Produto` em vez de `Ingrediente`: `useAllProducts()` em vez de `useAllIngredients()`. Field key `product` no form.
- Breadcrumb "Vendas". Title "Relatório de vendas". Descrição "Pedidos concluídos por produto e receita gerada."
- KPIs:
  - "Receita total" → `data.reduce((a, r) => a + r.revenue, 0)` formatado como `R$ 1.234,56` via `value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })`.
  - "Pedidos distintos" → `data.reduce((a, r) => a + r.ordersCount, 0)` (somatório, não unique cross-row).
  - "Produto top" → `top?.productName ?? "—"`, subline `R$ {top.revenue}`.
- Tabela colunas: "Produto" (mostra `productName` + `<Badge variant="neutral">{r.size}</Badge>`), "Unidades vendidas", "Receita" (`R$ X,XX`), "# pedidos".
- CSV headers: `["Produto", "Tamanho", "Unidades", "Receita", "Pedidos"]`. Rows: `[r.productName, r.size, r.unitsSold, r.revenue, r.ordersCount]`. Filename `vendas_{date}.csv`.

```tsx
"use client"

import { ExportCsvButton } from "@/components/reports/export-csv-button"
import { KpiCard } from "@/components/reports/kpi-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { useAllProducts } from "@/lib/products"
import {
    reportsRangeFiltersSchema,
    useSalesReport,
    type ReportsRangeFiltersInput,
} from "@/lib/reports"
import { useAllUnits } from "@/lib/units"
import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useState } from "react"
import { useForm } from "react-hook-form"

function startOfMonthISO(): string {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
function todayISO(): string {
    return new Date().toISOString().slice(0, 10)
}
function brl(n: number): string {
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export default function SalesReportPage() {
    const [applied, setApplied] = useState<ReportsRangeFiltersInput | null>(null)
    const units = useAllUnits()
    const products = useAllProducts()

    const form = useForm<ReportsRangeFiltersInput>({
        resolver: zodResolver(reportsRangeFiltersSchema),
        defaultValues: {
            from: startOfMonthISO(),
            to: todayISO(),
            unit: "",
            product: "",
        },
    })

    const query = useSalesReport({
        from: applied?.from ?? "",
        to: applied?.to ?? "",
        unit: applied?.unit || undefined,
        product: applied?.product || undefined,
    })

    function onSubmit(values: ReportsRangeFiltersInput) {
        setApplied(values)
    }

    const data = query.data ?? []
    const totalRevenue = data.reduce((a, r) => a + r.revenue, 0)
    const totalOrders = data.reduce((a, r) => a + r.ordersCount, 0)
    const top = [...data].sort((a, b) => b.revenue - a.revenue)[0]

    return (
        <div className="space-y-6">
            <header>
                <p className="text-sm text-text-secondary">
                    <Link href="/reports" className="hover:underline">
                        Relatórios
                    </Link>{" "}
                    › Vendas
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-text-primary">
                    Relatório de vendas
                </h1>
                <p className="mt-1 text-sm text-text-secondary">
                    Pedidos concluídos por produto e receita gerada.
                </p>
            </header>

            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="rounded-xl border border-border/40 bg-white p-5"
            >
                <div className="flex flex-wrap items-end gap-3">
                    <Field
                        label="De"
                        htmlFor="f-from"
                        error={form.formState.errors.from?.message}
                    >
                        <Input id="f-from" type="date" {...form.register("from")} />
                    </Field>
                    <Field
                        label="Até"
                        htmlFor="f-to"
                        error={form.formState.errors.to?.message}
                    >
                        <Input id="f-to" type="date" {...form.register("to")} />
                    </Field>
                    <Field label="Unidade" htmlFor="f-unit">
                        <Select id="f-unit" {...form.register("unit")}>
                            <option value="">Todas</option>
                            {units.data?.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.name}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Produto" htmlFor="f-product">
                        <Select id="f-product" {...form.register("product")}>
                            <option value="">Todos</option>
                            {products.data?.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name} {p.size}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Button type="submit">Aplicar</Button>
                </div>
            </form>

            {!applied ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                    <p className="text-sm text-text-secondary">
                        Selecione um período e clique em Aplicar.
                    </p>
                </div>
            ) : query.isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-12 animate-pulse rounded-lg bg-text-primary/5" />
                    ))}
                </div>
            ) : query.isError ? (
                <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
                    <p className="text-sm text-danger">Falha ao carregar relatório.</p>
                    <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
                        Tentar novamente
                    </Button>
                </div>
            ) : (
                <>
                    <div className="grid gap-3 md:grid-cols-3">
                        <KpiCard label="Receita total" value={brl(totalRevenue)} />
                        <KpiCard label="Pedidos" value={totalOrders} />
                        <KpiCard
                            label="Produto top"
                            value={top ? `${top.productName} ${top.size}` : "—"}
                            subline={top ? brl(top.revenue) : undefined}
                        />
                    </div>

                    <div className="flex justify-end">
                        <ExportCsvButton
                            filename={`vendas_${todayISO()}.csv`}
                            headers={[
                                "Produto",
                                "Tamanho",
                                "Unidades",
                                "Receita",
                                "Pedidos",
                            ]}
                            rows={data.map((r) => [
                                r.productName,
                                r.size,
                                r.unitsSold,
                                r.revenue,
                                r.ordersCount,
                            ])}
                        />
                    </div>

                    {data.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                            <p className="text-sm text-text-secondary">
                                Nenhum dado para os filtros selecionados.
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <THead>
                                <TR>
                                    <TH>Produto</TH>
                                    <TH>Unidades</TH>
                                    <TH>Receita</TH>
                                    <TH># pedidos</TH>
                                </TR>
                            </THead>
                            <TBody>
                                {data.map((r) => (
                                    <TR key={r.productId}>
                                        <TD>
                                            {r.productName}{" "}
                                            <Badge variant="neutral">{r.size}</Badge>
                                        </TD>
                                        <TD>{r.unitsSold}</TD>
                                        <TD>{brl(r.revenue)}</TD>
                                        <TD>{r.ordersCount}</TD>
                                    </TR>
                                ))}
                            </TBody>
                        </Table>
                    )}
                </>
            )}
        </div>
    )
}
```

- [ ] **Step 4: Criar `frontend/app/(protected)/reports/waste/page.tsx`**

```tsx
"use client"

import { ExportCsvButton } from "@/components/reports/export-csv-button"
import { KpiCard } from "@/components/reports/kpi-card"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { useAllIngredients } from "@/lib/ingredients"
import {
    reportsRangeFiltersSchema,
    useWasteReport,
    type ReportsRangeFiltersInput,
} from "@/lib/reports"
import { useAllUnits } from "@/lib/units"
import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useState } from "react"
import { useForm } from "react-hook-form"

function startOfMonthISO(): string {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
function todayISO(): string {
    return new Date().toISOString().slice(0, 10)
}

export default function WasteReportPage() {
    const [applied, setApplied] = useState<ReportsRangeFiltersInput | null>(null)
    const units = useAllUnits()
    const ingredients = useAllIngredients()

    const form = useForm<ReportsRangeFiltersInput>({
        resolver: zodResolver(reportsRangeFiltersSchema),
        defaultValues: {
            from: startOfMonthISO(),
            to: todayISO(),
            unit: "",
            ingredient: "",
        },
    })

    const query = useWasteReport({
        from: applied?.from ?? "",
        to: applied?.to ?? "",
        unit: applied?.unit || undefined,
        ingredient: applied?.ingredient || undefined,
    })

    function onSubmit(values: ReportsRangeFiltersInput) {
        setApplied(values)
    }

    const data = query.data ?? []
    const totalWaste = data.reduce((acc, r) => acc + r.wasteQuantity, 0)
    const totalAdjustments = data.reduce((acc, r) => acc + r.adjustmentCount, 0)
    const top = [...data].sort((a, b) => b.wasteQuantity - a.wasteQuantity)[0]

    return (
        <div className="space-y-6">
            <header>
                <p className="text-sm text-text-secondary">
                    <Link href="/reports" className="hover:underline">
                        Relatórios
                    </Link>{" "}
                    › Desperdício
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-text-primary">
                    Relatório de desperdício
                </h1>
                <p className="mt-1 text-sm text-text-secondary">
                    Ajustes negativos (perdas, quebras, vencimentos) por ingrediente.
                </p>
                <p className="mt-2 rounded-lg bg-secondary/30 px-3 py-2 text-xs text-text-primary">
                    Apenas ajustes do tipo DECREASE entram aqui. Ajustes anteriores ao
                    SP4 (sem direção registrada) são ignorados.
                </p>
            </header>

            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="rounded-xl border border-border/40 bg-white p-5"
            >
                <div className="flex flex-wrap items-end gap-3">
                    <Field
                        label="De"
                        htmlFor="f-from"
                        error={form.formState.errors.from?.message}
                    >
                        <Input id="f-from" type="date" {...form.register("from")} />
                    </Field>
                    <Field
                        label="Até"
                        htmlFor="f-to"
                        error={form.formState.errors.to?.message}
                    >
                        <Input id="f-to" type="date" {...form.register("to")} />
                    </Field>
                    <Field label="Unidade" htmlFor="f-unit">
                        <Select id="f-unit" {...form.register("unit")}>
                            <option value="">Todas</option>
                            {units.data?.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.name}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Ingrediente" htmlFor="f-ingredient">
                        <Select id="f-ingredient" {...form.register("ingredient")}>
                            <option value="">Todos</option>
                            {ingredients.data?.map((i) => (
                                <option key={i.id} value={i.id}>
                                    {i.name}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Button type="submit">Aplicar</Button>
                </div>
            </form>

            {!applied ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                    <p className="text-sm text-text-secondary">
                        Selecione um período e clique em Aplicar.
                    </p>
                </div>
            ) : query.isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-12 animate-pulse rounded-lg bg-text-primary/5" />
                    ))}
                </div>
            ) : query.isError ? (
                <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
                    <p className="text-sm text-danger">Falha ao carregar relatório.</p>
                    <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
                        Tentar novamente
                    </Button>
                </div>
            ) : (
                <>
                    <div className="grid gap-3 md:grid-cols-3">
                        <KpiCard
                            label="Volume desperdiçado"
                            value={totalWaste.toLocaleString("pt-BR")}
                        />
                        <KpiCard label="Ajustes registrados" value={totalAdjustments} />
                        <KpiCard
                            label="Mais afetado"
                            value={top?.ingredientName ?? "—"}
                            subline={
                                top
                                    ? `${top.wasteQuantity.toLocaleString("pt-BR")} ${top.unitOfMeasure}`
                                    : undefined
                            }
                        />
                    </div>

                    <div className="flex justify-end">
                        <ExportCsvButton
                            filename={`desperdicio_${todayISO()}.csv`}
                            headers={[
                                "Ingrediente",
                                "Unidade de medida",
                                "Desperdiçado",
                                "Ajustes",
                            ]}
                            rows={data.map((r) => [
                                r.ingredientName,
                                r.unitOfMeasure,
                                r.wasteQuantity,
                                r.adjustmentCount,
                            ])}
                        />
                    </div>

                    {data.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                            <p className="text-sm text-text-secondary">
                                Nenhum dado para os filtros selecionados.
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <THead>
                                <TR>
                                    <TH>Ingrediente</TH>
                                    <TH>UoM</TH>
                                    <TH>Desperdiçado</TH>
                                    <TH># ajustes</TH>
                                </TR>
                            </THead>
                            <TBody>
                                {data.map((r) => (
                                    <TR key={r.ingredientId}>
                                        <TD>{r.ingredientName}</TD>
                                        <TD>{r.unitOfMeasure}</TD>
                                        <TD>{r.wasteQuantity.toLocaleString("pt-BR")}</TD>
                                        <TD>{r.adjustmentCount}</TD>
                                    </TR>
                                ))}
                            </TBody>
                        </Table>
                    )}
                </>
            )}
        </div>
    )
}
```

- [ ] **Step 5: Criar `frontend/app/(protected)/reports/stock-status/page.tsx`**

```tsx
"use client"

import { ExportCsvButton } from "@/components/reports/export-csv-button"
import { KpiCard } from "@/components/reports/kpi-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Select } from "@/components/ui/select"
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { useStockStatusReport, type StockStatusRow } from "@/lib/reports"
import { useAllUnits } from "@/lib/units"
import Link from "next/link"
import { useState } from "react"

function todayISO(): string {
    return new Date().toISOString().slice(0, 10)
}

function levelVariant(l: StockStatusRow["level"]) {
    return l === "LOW" ? "danger" : l === "WARNING" ? "warning" : "success"
}

function levelLabel(l: StockStatusRow["level"]) {
    return l === "LOW" ? "Baixo" : l === "WARNING" ? "Atenção" : "OK"
}

export default function StockStatusReportPage() {
    const [unit, setUnit] = useState("")
    const units = useAllUnits()
    const query = useStockStatusReport({ unit: unit || undefined })

    const data = query.data ?? []
    const total = data.length
    const lowCount = data.filter((r) => r.level === "LOW").length
    const warnCount = data.filter((r) => r.level === "WARNING").length

    return (
        <div className="space-y-6">
            <header>
                <p className="text-sm text-text-secondary">
                    <Link href="/reports" className="hover:underline">
                        Relatórios
                    </Link>{" "}
                    › Status de estoque
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-text-primary">
                    Status de estoque
                </h1>
                <p className="mt-1 text-sm text-text-secondary">
                    Visão atual de saldos vs. mínimos por unidade.
                </p>
            </header>

            <div className="rounded-xl border border-border/40 bg-white p-5">
                <Field label="Unidade" htmlFor="f-unit">
                    <Select
                        id="f-unit"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                    >
                        <option value="">Todas</option>
                        {units.data?.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.name}
                            </option>
                        ))}
                    </Select>
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
                    <p className="text-sm text-danger">Falha ao carregar relatório.</p>
                    <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
                        Tentar novamente
                    </Button>
                </div>
            ) : (
                <>
                    <div className="grid gap-3 md:grid-cols-3">
                        <KpiCard label="Total de itens" value={total} />
                        <KpiCard label="Em alerta (LOW)" value={lowCount} />
                        <KpiCard label="Em atenção (WARNING)" value={warnCount} />
                    </div>

                    <div className="flex justify-end">
                        <ExportCsvButton
                            filename={`estoque_${todayISO()}.csv`}
                            headers={[
                                "Ingrediente",
                                "Unidade de medida",
                                "Saldo",
                                "Mínimo",
                                "Nível",
                            ]}
                            rows={data.map((r) => [
                                r.ingredientName,
                                r.unitOfMeasure,
                                r.currentQuantity,
                                r.minQuantity,
                                r.level,
                            ])}
                        />
                    </div>

                    {data.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                            <p className="text-sm text-text-secondary">
                                Nenhum dado para os filtros selecionados.
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <THead>
                                <TR>
                                    <TH>Ingrediente</TH>
                                    <TH>UoM</TH>
                                    <TH>Saldo</TH>
                                    <TH>Mínimo</TH>
                                    <TH>Nível</TH>
                                </TR>
                            </THead>
                            <TBody>
                                {data.map((r) => (
                                    <TR key={r.ingredientId}>
                                        <TD>{r.ingredientName}</TD>
                                        <TD>{r.unitOfMeasure}</TD>
                                        <TD>{r.currentQuantity.toLocaleString("pt-BR")}</TD>
                                        <TD>{r.minQuantity.toLocaleString("pt-BR")}</TD>
                                        <TD>
                                            <Badge variant={levelVariant(r.level)}>
                                                {levelLabel(r.level)}
                                            </Badge>
                                        </TD>
                                    </TR>
                                ))}
                            </TBody>
                        </Table>
                    )}
                </>
            )}
        </div>
    )
}
```

- [ ] **Step 6: Criar `frontend/tests/reports-page.test.tsx`**

```tsx
import { fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import ConsumptionReportPage from "@/app/(protected)/reports/consumption/page"
import ReportsHubPage from "@/app/(protected)/reports/page"
import StockStatusReportPage from "@/app/(protected)/reports/stock-status/page"

import { getCalls, renderWithProviders, resetMockApi, setHandler } from "./helpers"

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/reports",
    useParams: () => ({}),
}))

beforeEach(() => resetMockApi())
afterEach(() => resetMockApi())

describe("/reports hub", () => {
    it("renders 4 cards linking to subroutes", () => {
        renderWithProviders(<ReportsHubPage />)
        expect(screen.getByText("Consumo")).toBeInTheDocument()
        expect(screen.getByText("Vendas")).toBeInTheDocument()
        expect(screen.getByText("Desperdício")).toBeInTheDocument()
        expect(screen.getByText("Status de estoque")).toBeInTheDocument()
    })
})

describe("/reports/consumption", () => {
    it("renders initial state until Apply is clicked", async () => {
        setHandler(() => ({ status: 200, data: { data: [] } }))
        renderWithProviders(<ConsumptionReportPage />)
        expect(
            screen.getByText("Selecione um período e clique em Aplicar."),
        ).toBeInTheDocument()
        // not yet fetched
        const reportCalls = getCalls().filter((c) =>
            c.url?.startsWith("/reports/"),
        )
        expect(reportCalls.length).toBe(0)
    })

    it("after Apply, renders KPIs and table from data", async () => {
        setHandler((cfg) => {
            if (cfg.url === "/reports/consumption") {
                return {
                    status: 200,
                    data: {
                        data: [
                            {
                                ingredientId: "i-1",
                                ingredientName: "Mozzarella",
                                unitOfMeasure: "kg",
                                totalQuantity: 12.5,
                                movementCount: 4,
                            },
                        ],
                    },
                }
            }
            return { status: 200, data: { data: [], page: 0, size: 1000, total: 0 } }
        })
        renderWithProviders(<ConsumptionReportPage />)
        fireEvent.click(screen.getByText("Aplicar"))
        await waitFor(() =>
            expect(screen.getByText("Mozzarella")).toBeInTheDocument(),
        )
        expect(screen.getAllByText("Total geral").length).toBeGreaterThan(0)
    })
})

describe("/reports/stock-status", () => {
    it("does not require period — fetches immediately", async () => {
        setHandler((cfg) => {
            if (cfg.url === "/reports/stock-status") {
                return { status: 200, data: { data: [] } }
            }
            return { status: 200, data: { data: [], page: 0, size: 1000, total: 0 } }
        })
        renderWithProviders(<StockStatusReportPage />)
        await waitFor(() => {
            const c = getCalls().find((x) => x.url === "/reports/stock-status")
            expect(c).toBeDefined()
        })
    })
})

describe("ExportCsvButton inside reports", () => {
    it("is disabled when there is no data", async () => {
        setHandler(() => ({ status: 200, data: { data: [] } }))
        renderWithProviders(<ConsumptionReportPage />)
        fireEvent.click(screen.getByText("Aplicar"))
        await waitFor(() => {
            const btn = screen.getByText("Exportar CSV").closest("button")
            expect(btn).toBeDisabled()
        })
    })
})
```

- [ ] **Step 7: Rodar tests**

```bash
cd frontend && npm run test -- reports-page.test.tsx
```

Expected: 5 tests pass.

- [ ] **Step 8: Commit**

```bash
git add frontend/app/\(protected\)/reports frontend/tests/reports-page.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): /reports hub and 4 sub-routes with CSV export

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: `lib/audit-logs.ts` — types + helpers + hooks

**Files:**
- Create: `frontend/lib/audit-logs.ts`
- Create: `frontend/tests/audit-logs-hooks.test.ts`

**Why:** Camada de dados de audit-logs. Inclui helpers `formatAuditAction` e `summarizeAuditDetails` consumidos pelas páginas.

- [ ] **Step 1: Criar `frontend/lib/audit-logs.ts`**

```ts
import { api } from "@/lib/api"
import type { Page } from "@/lib/users"
import { useQuery } from "@tanstack/react-query"

export const AUDIT_ACTIONS = [
    "USER_CREATED",
    "USER_UPDATED",
    "USER_DEACTIVATED",
    "USER_ROLE_CHANGED",
    "UNIT_CREATED",
    "UNIT_UPDATED",
    "UNIT_DEACTIVATED",
    "INGREDIENT_CREATED",
    "INGREDIENT_UPDATED",
    "INGREDIENT_MIN_UPDATED",
    "INGREDIENT_DEACTIVATED",
    "PRODUCT_CREATED",
    "PRODUCT_UPDATED",
    "PRODUCT_PRICE_CHANGED",
    "PRODUCT_RECIPE_CHANGED",
    "PRODUCT_DEACTIVATED",
    "STOCK_ENTRY",
    "STOCK_EXIT",
    "STOCK_ADJUSTMENT",
    "PURCHASE_ORDER_CREATED",
    "PURCHASE_ORDER_RECEIVED",
    "PURCHASE_ORDER_CANCELED",
    "ORDER_CREATED",
    "ORDER_UPDATED",
    "ORDER_STARTED",
    "ORDER_COMPLETED",
    "ORDER_CANCELED",
] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export const AUDIT_ENTITY_TYPES = [
    "User",
    "Unit",
    "Ingredient",
    "Product",
    "StockMovement",
    "PurchaseOrder",
    "Order",
] as const
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number]

export type AuditLog = {
    id: string
    action: AuditAction
    entityType: AuditEntityType | string
    entityId: string
    actorId: string
    actorName: string
    details: Record<string, unknown> | null
    createdAt: string
}

export type AuditLogFilters = {
    entityType?: AuditEntityType
    entityId?: string
    actorId?: string
    action?: AuditAction
    from?: string
    to?: string
    page?: number
    size?: number
}

const ACTION_LABELS: Record<AuditAction, string> = {
    USER_CREATED: "Usuário: criação",
    USER_UPDATED: "Usuário: alteração",
    USER_DEACTIVATED: "Usuário: desativação",
    USER_ROLE_CHANGED: "Usuário: papel alterado",
    UNIT_CREATED: "Unidade: criação",
    UNIT_UPDATED: "Unidade: alteração",
    UNIT_DEACTIVATED: "Unidade: desativação",
    INGREDIENT_CREATED: "Ingrediente: criação",
    INGREDIENT_UPDATED: "Ingrediente: alteração",
    INGREDIENT_MIN_UPDATED: "Ingrediente: mínimo alterado",
    INGREDIENT_DEACTIVATED: "Ingrediente: desativação",
    PRODUCT_CREATED: "Produto: criação",
    PRODUCT_UPDATED: "Produto: alteração",
    PRODUCT_PRICE_CHANGED: "Produto: preço alterado",
    PRODUCT_RECIPE_CHANGED: "Produto: ficha alterada",
    PRODUCT_DEACTIVATED: "Produto: desativação",
    STOCK_ENTRY: "Estoque: entrada",
    STOCK_EXIT: "Estoque: saída",
    STOCK_ADJUSTMENT: "Estoque: ajuste",
    PURCHASE_ORDER_CREATED: "Compra: criação",
    PURCHASE_ORDER_RECEIVED: "Compra: recebida",
    PURCHASE_ORDER_CANCELED: "Compra: cancelada",
    ORDER_CREATED: "Pedido: criação",
    ORDER_UPDATED: "Pedido: alteração",
    ORDER_STARTED: "Pedido: iniciado",
    ORDER_COMPLETED: "Pedido: concluído",
    ORDER_CANCELED: "Pedido: cancelado",
}

export function formatAuditAction(action: AuditAction): string {
    return ACTION_LABELS[action] ?? action
}

export function actionBadgeVariant(
    action: AuditAction,
): "success" | "neutral" | "warning" | "danger" {
    if (action.endsWith("_CREATED")) return "success"
    if (action.endsWith("_DEACTIVATED") || action.endsWith("_CANCELED")) return "neutral"
    if (
        action.startsWith("STOCK_") ||
        action.startsWith("ORDER_") ||
        action.startsWith("PURCHASE_ORDER_")
    )
        return "warning"
    return "neutral"
}

function fmtNum(v: unknown): string {
    if (typeof v === "number") return v.toLocaleString("pt-BR")
    return String(v)
}

export function summarizeAuditDetails(
    action: AuditAction,
    details: Record<string, unknown> | null,
): string {
    if (!details) return "—"
    const before = details.before as Record<string, unknown> | undefined
    const after = details.after as Record<string, unknown> | undefined

    if (action === "PRODUCT_PRICE_CHANGED" && before && after) {
        return `${fmtNum(before.price)} → ${fmtNum(after.price)}`
    }
    if (action === "INGREDIENT_MIN_UPDATED" && before && after) {
        return `${fmtNum(before.minQuantity)} → ${fmtNum(after.minQuantity)}`
    }
    if (action === "USER_ROLE_CHANGED" && before && after) {
        return `${before.role} → ${after.role}`
    }
    if (action === "STOCK_ENTRY" || action === "STOCK_EXIT" || action === "STOCK_ADJUSTMENT") {
        const qty = details.quantity
        const dir = details.direction
        if (qty !== undefined && dir) return `${dir} ${fmtNum(qty)}`
        if (qty !== undefined) return `${fmtNum(qty)}`
    }
    if (action === "ORDER_CREATED" || action === "ORDER_UPDATED") {
        const items = details.itemsCount ?? details.totalItems
        const total = details.totalPrice
        if (items !== undefined && total !== undefined) {
            return `${items} itens, ${fmtNum(total)}`
        }
    }

    const keys = Object.keys(details).filter((k) => k !== "before" && k !== "after")
    if (keys.length > 0) return keys.slice(0, 2).join(", ")
    return "—"
}

export function useAuditLogs(filters: AuditLogFilters = {}) {
    const page = filters.page ?? 0
    const size = filters.size ?? 20
    const params: Record<string, string | number> = { page, size }
    if (filters.entityType) params.entityType = filters.entityType
    if (filters.entityId) params.entityId = filters.entityId
    if (filters.actorId) params.actorId = filters.actorId
    if (filters.action) params.action = filters.action
    if (filters.from) params.from = filters.from
    if (filters.to) params.to = filters.to
    return useQuery({
        queryKey: [
            "audit-logs",
            {
                entityType: filters.entityType ?? null,
                entityId: filters.entityId ?? null,
                actorId: filters.actorId ?? null,
                action: filters.action ?? null,
                from: filters.from ?? null,
                to: filters.to ?? null,
                page,
                size,
            },
        ],
        queryFn: () =>
            api.get<Page<AuditLog>>("/audit-logs", { params }).then((r) => r.data),
    })
}

export function useAuditLog(id: string) {
    return useQuery({
        queryKey: ["audit-logs", id],
        queryFn: () => api.get<AuditLog>(`/audit-logs/${id}`).then((r) => r.data),
        enabled: !!id,
    })
}
```

- [ ] **Step 2: Criar `frontend/tests/audit-logs-hooks.test.ts`**

```ts
import { renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
    formatAuditAction,
    summarizeAuditDetails,
    useAuditLog,
    useAuditLogs,
} from "@/lib/audit-logs"

import { getCalls, renderWithProviders, resetMockApi, setHandler } from "./helpers"
import type { ReactNode } from "react"

function wrapper({ children }: { children: ReactNode }) {
    return renderWithProviders(<>{children}</>) as unknown as ReactNode
}

beforeEach(() => resetMockApi())
afterEach(() => resetMockApi())

describe("useAuditLogs", () => {
    it("sends all filter params when present", async () => {
        setHandler(() => ({
            status: 200,
            data: { data: [], page: 0, size: 20, total: 0 },
        }))
        renderHook(
            () =>
                useAuditLogs({
                    entityType: "Product",
                    entityId: "p-1",
                    actorId: "u-1",
                    action: "PRODUCT_PRICE_CHANGED",
                    from: "2026-05-01",
                    to: "2026-05-07",
                }),
            { wrapper },
        )
        await waitFor(() => expect(getCalls().length).toBeGreaterThan(0))
        const params = getCalls()[0]?.params as Record<string, unknown>
        expect(params.entityType).toBe("Product")
        expect(params.action).toBe("PRODUCT_PRICE_CHANGED")
    })
})

describe("useAuditLog", () => {
    it("fetches single by id", async () => {
        setHandler(() => ({ status: 200, data: { data: { id: "a-1" } } }))
        const { result } = renderHook(() => useAuditLog("a-1"), { wrapper })
        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect((result.current.data as { id: string }).id).toBe("a-1")
    })
})

describe("formatAuditAction", () => {
    it("returns pt-BR labels", () => {
        expect(formatAuditAction("PRODUCT_PRICE_CHANGED")).toBe("Produto: preço alterado")
        expect(formatAuditAction("STOCK_ENTRY")).toBe("Estoque: entrada")
    })
})

describe("summarizeAuditDetails", () => {
    it("renders X → Y for PRODUCT_PRICE_CHANGED", () => {
        const out = summarizeAuditDetails("PRODUCT_PRICE_CHANGED", {
            before: { price: 45.9 },
            after: { price: 49.9 },
        })
        expect(out).toBe("45,9 → 49,9")
    })

    it("renders OWNER → EMPLOYEE for USER_ROLE_CHANGED", () => {
        const out = summarizeAuditDetails("USER_ROLE_CHANGED", {
            before: { role: "OWNER" },
            after: { role: "EMPLOYEE" },
        })
        expect(out).toBe("OWNER → EMPLOYEE")
    })

    it("returns — for null details", () => {
        expect(summarizeAuditDetails("PRODUCT_UPDATED", null)).toBe("—")
    })

    it("falls back to keys when no curated case matches", () => {
        const out = summarizeAuditDetails("PRODUCT_UPDATED", { name: "x", desc: "y" })
        expect(out).toContain("name")
    })
})
```

- [ ] **Step 3: Rodar tests**

```bash
cd frontend && npm run test -- audit-logs-hooks.test.ts
```

Expected: 7 tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/audit-logs.ts frontend/tests/audit-logs-hooks.test.ts
git commit -m "$(cat <<'EOF'
feat(frontend): audit-logs types, hooks and pt-BR action labels

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: `/audit-logs` — listagem (OWNER)

**Files:**
- Create: `frontend/app/(protected)/audit-logs/page.tsx`
- Create: `frontend/tests/audit-logs-page.test.tsx`

**Why:** Listagem OWNER-only com filtros URL-persisted (entityType, entityId, actorId, action, from, to). Tabela mostra preview resumido via `summarizeAuditDetails`.

- [ ] **Step 1: Criar `frontend/app/(protected)/audit-logs/page.tsx`**

```tsx
"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import {
    actionBadgeVariant,
    AUDIT_ACTIONS,
    AUDIT_ENTITY_TYPES,
    formatAuditAction,
    summarizeAuditDetails,
    useAuditLogs,
    type AuditAction,
    type AuditEntityType,
} from "@/lib/audit-logs"
import { useAuth } from "@/lib/auth"
import { useAllUsers } from "@/lib/users"
import { Eye } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

function AuditLogsPageInner() {
    const { user } = useAuth()
    const router = useRouter()
    const searchParams = useSearchParams()

    const entityTypeParam = (searchParams.get("entityType") as AuditEntityType | null) ?? ""
    const entityIdParam = searchParams.get("entityId") ?? ""
    const actorParam = searchParams.get("actorId") ?? ""
    const actionParam = (searchParams.get("action") as AuditAction | null) ?? ""
    const fromParam = searchParams.get("from") ?? ""
    const toParam = searchParams.get("to") ?? ""

    const [page, setPage] = useState(0)
    const size = 20

    const enabled = user?.role === "OWNER"

    const query = useAuditLogs(
        enabled
            ? {
                  entityType: entityTypeParam || undefined,
                  entityId: entityIdParam || undefined,
                  actorId: actorParam || undefined,
                  action: actionParam || undefined,
                  from: fromParam || undefined,
                  to: toParam || undefined,
                  page,
                  size,
              }
            : {},
    )
    const users = useAllUsers()

    if (user?.role !== "OWNER") return <NoAccess />

    function setFilter(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString())
        if (value === "") params.delete(key)
        else params.set(key, value)
        setPage(0)
        router.replace(`/audit-logs?${params.toString()}`)
    }

    const data = query.data
    const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-semibold text-text-primary">Auditoria</h1>
                <p className="mt-1 text-sm text-text-secondary">
                    Histórico imutável de mutações sensíveis no sistema.
                </p>
            </header>

            <div className="flex flex-wrap items-end gap-3">
                <Field label="Tipo de entidade" htmlFor="f-entity-type">
                    <Select
                        id="f-entity-type"
                        value={entityTypeParam}
                        onChange={(e) => setFilter("entityType", e.target.value)}
                    >
                        <option value="">Todos</option>
                        {AUDIT_ENTITY_TYPES.map((t) => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field label="ID da entidade" htmlFor="f-entity-id">
                    <Input
                        id="f-entity-id"
                        value={entityIdParam}
                        onChange={(e) => setFilter("entityId", e.target.value)}
                        placeholder="UUID"
                    />
                </Field>
                <Field label="Ação" htmlFor="f-action">
                    <Select
                        id="f-action"
                        value={actionParam}
                        onChange={(e) => setFilter("action", e.target.value)}
                    >
                        <option value="">Todas</option>
                        {AUDIT_ACTIONS.map((a) => (
                            <option key={a} value={a}>
                                {formatAuditAction(a)}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field label="Ator" htmlFor="f-actor">
                    <Select
                        id="f-actor"
                        value={actorParam}
                        onChange={(e) => setFilter("actorId", e.target.value)}
                    >
                        <option value="">Todos</option>
                        {users.data?.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.name}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field label="De" htmlFor="f-from">
                    <Input
                        id="f-from"
                        type="date"
                        value={fromParam}
                        onChange={(e) => setFilter("from", e.target.value)}
                    />
                </Field>
                <Field label="Até" htmlFor="f-to">
                    <Input
                        id="f-to"
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
                    <p className="text-sm text-danger">Falha ao carregar auditoria.</p>
                    <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
                        Tentar novamente
                    </Button>
                </div>
            ) : data && data.data.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                    <p className="text-sm text-text-secondary">
                        Nenhum registro para os filtros selecionados.
                    </p>
                </div>
            ) : (
                <Table>
                    <THead>
                        <TR>
                            <TH>Data</TH>
                            <TH>Ação</TH>
                            <TH>Entidade</TH>
                            <TH>Ator</TH>
                            <TH>Detalhes</TH>
                            <TH>Ações</TH>
                        </TR>
                    </THead>
                    <TBody>
                        {data!.data.map((log) => (
                            <TR key={log.id}>
                                <TD>{new Date(log.createdAt).toLocaleString("pt-BR")}</TD>
                                <TD>
                                    <Badge variant={actionBadgeVariant(log.action)}>
                                        {formatAuditAction(log.action)}
                                    </Badge>
                                </TD>
                                <TD>
                                    {log.entityType}{" "}
                                    <span className="font-mono text-xs text-text-secondary">
                                        #{log.entityId.slice(0, 8)}
                                    </span>
                                </TD>
                                <TD>{log.actorName}</TD>
                                <TD className="max-w-xs truncate">
                                    {summarizeAuditDetails(log.action, log.details)}
                                </TD>
                                <TD>
                                    <Link
                                        href={`/audit-logs/${log.id}`}
                                        className="inline-flex items-center gap-1 text-primary hover:underline"
                                    >
                                        <Eye className="h-4 w-4" /> Ver
                                    </Link>
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

function NoAccess() {
    return (
        <div className="mx-auto max-w-md rounded-xl border border-border/40 bg-white p-8 text-center">
            <h2 className="text-base font-semibold text-text-primary">Sem permissão</h2>
            <p className="mt-2 text-sm text-text-secondary">
                Apenas o proprietário pode acessar a auditoria.
            </p>
        </div>
    )
}

export default function AuditLogsPage() {
    return (
        <Suspense fallback={null}>
            <AuditLogsPageInner />
        </Suspense>
    )
}
```

- [ ] **Step 2: Criar `frontend/tests/audit-logs-page.test.tsx`**

```tsx
import { screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import AuditLogsPage from "@/app/(protected)/audit-logs/page"
import { tokenStorage } from "@/lib/api"

import { renderWithProviders, resetMockApi, setHandler } from "./helpers"

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/audit-logs",
    useParams: () => ({}),
}))

function setAuth(role: "OWNER" | "EMPLOYEE") {
    tokenStorage.setAccess("fake")
    tokenStorage.setRefresh("fake")
    localStorage.setItem(
        "fv.user",
        JSON.stringify({
            id: "u-1",
            name: "Test",
            email: "t@t.com",
            role,
            active: true,
        }),
    )
}

beforeEach(() => resetMockApi())
afterEach(() => resetMockApi())

describe("/audit-logs", () => {
    it("EMPLOYEE sees NoAccess", async () => {
        setAuth("EMPLOYEE")
        renderWithProviders(<AuditLogsPage />)
        await waitFor(() =>
            expect(screen.getByText("Sem permissão")).toBeInTheDocument(),
        )
    })

    it("OWNER sees rows with formatted action labels", async () => {
        setAuth("OWNER")
        setHandler((cfg) => {
            if (cfg.url === "/audit-logs") {
                return {
                    status: 200,
                    data: {
                        data: [
                            {
                                id: "a-1",
                                action: "PRODUCT_PRICE_CHANGED",
                                entityType: "Product",
                                entityId: "p-12345678abcd",
                                actorId: "u-1",
                                actorName: "guilherme",
                                details: {
                                    before: { price: 45.9 },
                                    after: { price: 49.9 },
                                },
                                createdAt: "2026-05-07T12:00:00",
                            },
                        ],
                        page: 0,
                        size: 20,
                        total: 1,
                    },
                }
            }
            return { status: 200, data: { data: [], page: 0, size: 1000, total: 0 } }
        })
        renderWithProviders(<AuditLogsPage />)
        await waitFor(() =>
            expect(screen.getByText("Produto: preço alterado")).toBeInTheDocument(),
        )
        expect(screen.getByText("guilherme")).toBeInTheDocument()
        expect(screen.getByText("45,9 → 49,9")).toBeInTheDocument()
    })
})
```

- [ ] **Step 3: Rodar tests**

```bash
cd frontend && npm run test -- audit-logs-page.test.tsx
```

Expected: 2 tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/\(protected\)/audit-logs/page.tsx frontend/tests/audit-logs-page.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): /audit-logs OWNER-only listing with filters

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: `/audit-logs/[id]` — detalhe com diff before/after

**Files:**
- Create: `frontend/app/(protected)/audit-logs/[id]/page.tsx`
- Create: `frontend/tests/audit-logs-detail-page.test.tsx`

**Why:** Detalhe mostra metadados + diff before/after lado a lado quando aplicável; senão JSON pretty-printed.

- [ ] **Step 1: Criar `frontend/app/(protected)/audit-logs/[id]/page.tsx`**

```tsx
"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    actionBadgeVariant,
    formatAuditAction,
    useAuditLog,
} from "@/lib/audit-logs"
import { useAuth } from "@/lib/auth"
import Link from "next/link"
import { useParams } from "next/navigation"

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v)
}

function DiffView({
    before,
    after,
}: {
    before: Record<string, unknown>
    after: Record<string, unknown>
}) {
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
    return (
        <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border/40 bg-text-primary/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    Antes
                </p>
                <dl className="mt-2 space-y-1 font-mono text-xs">
                    {keys.map((k) => {
                        const changed = JSON.stringify(before[k]) !== JSON.stringify(after[k])
                        return (
                            <div
                                key={k}
                                className={`flex justify-between gap-3 ${changed ? "text-warning-foreground" : ""}`}
                            >
                                <dt className="text-text-secondary">{k}</dt>
                                <dd
                                    className={
                                        changed
                                            ? "rounded bg-secondary/40 px-1 text-text-primary"
                                            : "text-text-primary"
                                    }
                                >
                                    {JSON.stringify(before[k] ?? null)}
                                </dd>
                            </div>
                        )
                    })}
                </dl>
            </div>
            <div className="rounded-lg border border-border/40 bg-primary/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    Depois
                </p>
                <dl className="mt-2 space-y-1 font-mono text-xs">
                    {keys.map((k) => {
                        const changed = JSON.stringify(before[k]) !== JSON.stringify(after[k])
                        return (
                            <div key={k} className="flex justify-between gap-3">
                                <dt className="text-text-secondary">{k}</dt>
                                <dd
                                    className={
                                        changed
                                            ? "rounded bg-secondary/40 px-1 text-text-primary"
                                            : "text-text-primary"
                                    }
                                >
                                    {JSON.stringify(after[k] ?? null)}
                                </dd>
                            </div>
                        )
                    })}
                </dl>
            </div>
        </div>
    )
}

const ENTITY_LINK_BASE: Partial<Record<string, string>> = {
    Product: "/products",
    Ingredient: "/ingredients",
    Order: "/orders",
    PurchaseOrder: "/purchase-orders",
    User: "/users",
    Unit: "/units",
}

export default function AuditLogDetailPage() {
    const { user } = useAuth()
    const params = useParams<{ id: string }>()
    const id = params.id
    const query = useAuditLog(user?.role === "OWNER" ? id : "")

    if (user?.role !== "OWNER") return <NoAccess />

    if (query.isLoading) {
        return (
            <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-10 animate-pulse rounded-lg bg-text-primary/5" />
                ))}
            </div>
        )
    }

    if (query.isError || !query.data) {
        return (
            <div className="text-center">
                <p className="text-sm text-danger">Não foi possível carregar o registro.</p>
                <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
                    Tentar novamente
                </Button>
            </div>
        )
    }

    const log = query.data
    const before = isPlainObject(log.details?.before) ? (log.details!.before as Record<string, unknown>) : null
    const after = isPlainObject(log.details?.after) ? (log.details!.after as Record<string, unknown>) : null
    const entityHref = ENTITY_LINK_BASE[log.entityType as string]

    return (
        <div className="space-y-6">
            <header>
                <p className="text-sm text-text-secondary">
                    <Link href="/audit-logs" className="hover:underline">
                        Auditoria
                    </Link>{" "}
                    › {formatAuditAction(log.action)}
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-text-primary">
                    {formatAuditAction(log.action)}
                </h1>
            </header>

            <div className="rounded-xl border border-border/40 bg-white p-5">
                <h2 className="text-base font-semibold text-text-primary">Informações</h2>
                <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                    <div className="flex justify-between gap-3">
                        <dt className="text-text-secondary">Data</dt>
                        <dd className="text-text-primary">
                            {new Date(log.createdAt).toLocaleString("pt-BR", {
                                second: "2-digit",
                            })}
                        </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                        <dt className="text-text-secondary">Ação</dt>
                        <dd>
                            <Badge variant={actionBadgeVariant(log.action)}>
                                {formatAuditAction(log.action)}
                            </Badge>
                        </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                        <dt className="text-text-secondary">Tipo de entidade</dt>
                        <dd className="text-text-primary">{log.entityType}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                        <dt className="text-text-secondary">ID da entidade</dt>
                        <dd className="font-mono text-xs text-text-primary">
                            {log.entityId}
                            {entityHref ? (
                                <>
                                    {" "}
                                    <Link
                                        href={`${entityHref}/${log.entityId}`}
                                        className="ml-2 text-primary hover:underline"
                                    >
                                        Ver recurso →
                                    </Link>
                                </>
                            ) : null}
                        </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                        <dt className="text-text-secondary">Ator</dt>
                        <dd className="text-text-primary">{log.actorName}</dd>
                    </div>
                </dl>
            </div>

            <div className="rounded-xl border border-border/40 bg-white p-5">
                <h2 className="text-base font-semibold text-text-primary">Payload</h2>
                {before && after ? (
                    <div className="mt-3">
                        <DiffView before={before} after={after} />
                    </div>
                ) : log.details ? (
                    <pre className="mt-3 overflow-x-auto rounded-lg bg-text-primary/5 p-3 font-mono text-xs">
                        {JSON.stringify(log.details, null, 2)}
                    </pre>
                ) : (
                    <p className="mt-3 text-sm text-text-secondary">
                        Sem detalhes adicionais.
                    </p>
                )}
            </div>
        </div>
    )
}

function NoAccess() {
    return (
        <div className="mx-auto max-w-md rounded-xl border border-border/40 bg-white p-8 text-center">
            <h2 className="text-base font-semibold text-text-primary">Sem permissão</h2>
            <p className="mt-2 text-sm text-text-secondary">
                Apenas o proprietário pode acessar a auditoria.
            </p>
        </div>
    )
}
```

- [ ] **Step 2: Criar `frontend/tests/audit-logs-detail-page.test.tsx`**

```tsx
import { screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import AuditLogDetailPage from "@/app/(protected)/audit-logs/[id]/page"
import { tokenStorage } from "@/lib/api"

import { renderWithProviders, resetMockApi, setHandler } from "./helpers"

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/audit-logs/a-1",
    useParams: () => ({ id: "a-1" }),
}))

function setAuth(role: "OWNER" | "EMPLOYEE") {
    tokenStorage.setAccess("fake")
    tokenStorage.setRefresh("fake")
    localStorage.setItem(
        "fv.user",
        JSON.stringify({
            id: "u-1",
            name: "Test",
            email: "t@t.com",
            role,
            active: true,
        }),
    )
}

beforeEach(() => resetMockApi())
afterEach(() => resetMockApi())

describe("/audit-logs/[id]", () => {
    it("EMPLOYEE sees NoAccess", async () => {
        setAuth("EMPLOYEE")
        renderWithProviders(<AuditLogDetailPage />)
        await waitFor(() =>
            expect(screen.getByText("Sem permissão")).toBeInTheDocument(),
        )
    })

    it("OWNER sees diff for before/after", async () => {
        setAuth("OWNER")
        setHandler(() => ({
            status: 200,
            data: {
                data: {
                    id: "a-1",
                    action: "PRODUCT_PRICE_CHANGED",
                    entityType: "Product",
                    entityId: "p-1",
                    actorId: "u-1",
                    actorName: "guilherme",
                    details: { before: { price: 45.9 }, after: { price: 49.9 } },
                    createdAt: "2026-05-07T12:00:00",
                },
            },
        }))
        renderWithProviders(<AuditLogDetailPage />)
        await waitFor(() =>
            expect(screen.getByText("Antes")).toBeInTheDocument(),
        )
        expect(screen.getByText("Depois")).toBeInTheDocument()
        // both sides render price key
        const priceCells = screen.getAllByText("price")
        expect(priceCells.length).toBe(2)
    })

    it("OWNER sees JSON pretty when no before/after", async () => {
        setAuth("OWNER")
        setHandler(() => ({
            status: 200,
            data: {
                data: {
                    id: "a-1",
                    action: "STOCK_ENTRY",
                    entityType: "StockMovement",
                    entityId: "m-1",
                    actorId: "u-1",
                    actorName: "guilherme",
                    details: { quantity: 10, ingredientId: "i-1" },
                    createdAt: "2026-05-07T12:00:00",
                },
            },
        }))
        renderWithProviders(<AuditLogDetailPage />)
        await waitFor(() =>
            expect(screen.getByText(/quantity/)).toBeInTheDocument(),
        )
        expect(screen.queryByText("Antes")).not.toBeInTheDocument()
    })

    it("shows 'Sem detalhes' when details is null", async () => {
        setAuth("OWNER")
        setHandler(() => ({
            status: 200,
            data: {
                data: {
                    id: "a-1",
                    action: "PRODUCT_DEACTIVATED",
                    entityType: "Product",
                    entityId: "p-1",
                    actorId: "u-1",
                    actorName: "guilherme",
                    details: null,
                    createdAt: "2026-05-07T12:00:00",
                },
            },
        }))
        renderWithProviders(<AuditLogDetailPage />)
        await waitFor(() =>
            expect(screen.getByText("Sem detalhes adicionais.")).toBeInTheDocument(),
        )
    })
})
```

- [ ] **Step 3: Rodar tests**

```bash
cd frontend && npm run test -- audit-logs-detail-page.test.tsx
```

Expected: 4 tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/\(protected\)/audit-logs/\[id\]/page.tsx frontend/tests/audit-logs-detail-page.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): /audit-logs/[id] detail with before/after diff view

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Cross-module invalidation de `['notifications']`

**Files:**
- Modify: `frontend/lib/stock-movements.ts:92-95` (`useCreateAdjustment.onSuccess`)
- Modify: `frontend/lib/orders.ts:128-132` (`useStartOrder.onSuccess`)
- Modify: `frontend/lib/purchase-orders.ts:145-149` (`useReceivePurchaseOrder.onSuccess`)

**Why:** Após qualquer mutation que mexe estoque, a query do sino deve refazer fetch para refletir alertas novos/resolvidos sem esperar o tick de 60s.

- [ ] **Step 1: Modificar `lib/stock-movements.ts` `useCreateAdjustment` linha 92-95**

Substituir:

```ts
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["stock-movements"] })
            qc.invalidateQueries({ queryKey: ["stock"] })
        },
```

por:

```ts
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["stock-movements"] })
            qc.invalidateQueries({ queryKey: ["stock"] })
            qc.invalidateQueries({ queryKey: ["notifications"] })
        },
```

- [ ] **Step 2: Modificar `lib/orders.ts` `useStartOrder` linha 128-132**

Substituir:

```ts
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["orders"] })
            qc.invalidateQueries({ queryKey: ["stock"] })
            qc.invalidateQueries({ queryKey: ["stock-movements"] })
        },
```

por:

```ts
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["orders"] })
            qc.invalidateQueries({ queryKey: ["stock"] })
            qc.invalidateQueries({ queryKey: ["stock-movements"] })
            qc.invalidateQueries({ queryKey: ["notifications"] })
        },
```

- [ ] **Step 3: Modificar `lib/purchase-orders.ts` `useReceivePurchaseOrder` linha 145-149**

Substituir:

```ts
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["purchase-orders"] })
            qc.invalidateQueries({ queryKey: ["stock"] })
            qc.invalidateQueries({ queryKey: ["stock-movements"] })
        },
```

por:

```ts
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["purchase-orders"] })
            qc.invalidateQueries({ queryKey: ["stock"] })
            qc.invalidateQueries({ queryKey: ["stock-movements"] })
            qc.invalidateQueries({ queryKey: ["notifications"] })
        },
```

- [ ] **Step 4: Rodar a suite inteira (sanity)**

```bash
cd frontend && npm run test
```

Expected: todos os testes passando — não há teste explícito da invalidação cruzada (não merece arquivos novos), mas se algum hook test do SP2 rodava com mock checando exatamente quais queries são invalidadas, ainda passa porque adicionamos uma chamada extra em vez de remover.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/stock-movements.ts frontend/lib/orders.ts frontend/lib/purchase-orders.ts
git commit -m "$(cat <<'EOF'
feat(frontend): invalidate ['notifications'] after stock-affecting mutations

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Sidebar URLs + topbar bell wiring

**Files:**
- Modify: `frontend/app/(protected)/layout.tsx` (linhas 73-78 e 204-211)

**Why:** Sidebar tem hrefs `/relatorios` e `/auditoria` que precisam alinhar com o backend (`/reports`, `/audit-logs`); Auditoria precisa ganhar `requireRole: "OWNER"`. Botão de sino decorativo no header é substituído pelo `<NotificationsBell />`.

- [ ] **Step 1: Modificar `app/(protected)/layout.tsx` na seção "Análise" (linhas 73-78)**

Substituir:

```tsx
    {
        title: "Análise",
        items: [
            { label: "Relatórios", href: "/relatorios", icon: BarChart3 },
            { label: "Auditoria", href: "/auditoria", icon: FileText },
        ],
    },
```

por:

```tsx
    {
        title: "Análise",
        items: [
            { label: "Relatórios", href: "/reports", icon: BarChart3 },
            { label: "Auditoria", href: "/audit-logs", icon: FileText, requireRole: "OWNER" },
        ],
    },
```

- [ ] **Step 2: Modificar `app/(protected)/layout.tsx` substituindo o botão de sino (linhas 204-211)**

Substituir:

```tsx
                        <button
                            type="button"
                            className="relative flex h-9 w-9 items-center justify-center rounded-md text-text-primary/70 transition hover:bg-text-primary/5 hover:text-text-primary"
                            aria-label="Notificações"
                        >
                            <Bell className="h-5 w-5" />
                        </button>
```

por:

```tsx
                        <NotificationsBell />
```

E remover o import de `Bell` da lista de lucide-react (linha 8) — ele não é mais usado no layout — **a menos que** outro lugar do mesmo arquivo o use; verificar com `grep` antes de remover.

- [ ] **Step 3: Adicionar import do `<NotificationsBell />` no topo de `layout.tsx`**

Próximo aos outros imports:

```tsx
import { NotificationsBell } from "@/components/notifications/notifications-bell"
```

- [ ] **Step 4: Rodar typecheck e build (sanity)**

```bash
cd frontend && npx tsc --noEmit && npm run build
```

Expected: 0 errors, build verde.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/\(protected\)/layout.tsx
git commit -m "$(cat <<'EOF'
chore(frontend): align sidebar hrefs with SP4 paths and wire bell

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Sanity final

**Files:** none.

**Why:** Garantir que toda a suite passa e o app builda antes de PR.

- [ ] **Step 1: Rodar suite completa**

```bash
cd frontend && npm run test
```

Expected: todos verdes (testes de SP1/SP2/SP3 + 11 novos arquivos do SP4).

- [ ] **Step 2: Build**

```bash
cd frontend && npm run build
```

Expected: build verde, sem warnings novos.

- [ ] **Step 3: Validação manual mínima (smoke)**

Rodar o backend (em outro terminal: `cd backend && ./mvnw spring-boot:run`) e o front (`cd frontend && npm run dev`). Logar como OWNER e verificar:

- Sidebar mostra "Alertas", "Relatórios", "Auditoria" levando para `/notifications`, `/reports`, `/audit-logs` sem 404.
- Sino no header abre popover (mesmo vazio).
- `/reports/consumption` aceita filtros e mostra "Selecione um período…" antes de aplicar.
- `/audit-logs` lista (mesmo vazio se backend acabou de subir).

Logar como EMPLOYEE e verificar:

- "Auditoria" não aparece na sidebar.
- `/audit-logs` direto na URL renderiza "Sem permissão".

- [ ] **Step 4: Push e PR**

```bash
git push -u origin feat/sp4-frontend-alerts-reports-audit
gh pr create --title "feat(frontend): SP4 — alerts + reports + audit" --body "$(cat <<'EOF'
## Summary
- Sino de notificações no header com polling 60s + página /notifications (lista + detalhe + resolver manual)
- Hub /reports + 4 sub-rotas (consumption, sales, waste, stock-status) com KPIs, tabela e export CSV (UTF-8 BOM, separador `;`, números pt-BR)
- /audit-logs OWNER-only com filtros e diff before/after no detalhe
- Cross-module invalidation: mutations de estoque agora invalidam ['notifications']

## Test plan
- [ ] Suite `npm run test` verde (11 novos arquivos)
- [ ] `npm run build` sem warnings
- [ ] OWNER: navegar pelas 7 rotas novas (incluindo audit-logs)
- [ ] EMPLOYEE: bloqueado em /audit-logs e sem botão "Resolver" em /notifications/[id]
- [ ] CSV abrir limpo no Excel pt-BR (acentos, separador, números)
- [ ] Sino reage após mutation de estoque (invalidação imediata)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Done.

---

## Self-review checklist (run after writing the plan)

1. **Spec coverage:**
   - [x] Notifications listing + detalhe + resolve → Tasks 3, 5, 6
   - [x] Sino + polling 60s → Task 4 + cross-module invalidation Task 13
   - [x] Reports hub + 4 sub-rotas + KPIs + CSV → Tasks 7, 8, 9
   - [x] Audit-logs listagem + detalhe + diff → Tasks 10, 11, 12
   - [x] Sidebar align + bell wiring → Task 14
   - [x] `useAllUsers` helper → Task 2
   - [x] Tests cobrindo tudo → spalhados nas tasks

2. **Placeholder scan:** Plano todo foi escrito com código completo; nenhum "TODO/TBD" e nenhum "similar to Task N". Cada Step tem o código necessário inline.

3. **Type consistency:**
   - `useActiveNotificationsBell` retorna `{ total, items, isLoading, isError, refetch }` em Task 3 e é consumido com mesma shape em Task 4.
   - `summarizeAuditDetails(action, details)` em Task 10 e usado em Task 11 com mesma assinatura.
   - `actionBadgeVariant` em Task 10 e usado em Tasks 11/12 com mesmo retorno (`"success" | "neutral" | "warning" | "danger"`).
   - `formatAuditAction(action)` em Task 10 e usado em Tasks 11/12.
   - `ReportsRangeFiltersInput` exportado em Task 7 e consumido em Task 9.

4. **Scope:** plano focado em 1 SP, 15 tasks, ~10 commits. Compatível com 1 PR.

---

## Pontos de validação durante a execução (do design spec)

Validar **enquanto implementa**, não apenas ao final:

1. **`NotificationResponse.resolvedBy`** — ao chegar no Task 5/6, verificar shape real de `GET /notifications/{id}`. Se vier string ou só ID, ajustar o tipo `Notification` em `lib/notifications.ts` e o render do detalhe.
2. **`unitOfMeasure` na message** — testar que o regex `extractUom` casa com a mensagem real do backend. Se backend mudar formato, ajustar regex.
3. **`AuditLogResponse.actorName`** — confirmar que vem desnormalizado em `GET /audit-logs`. Se não, fazer lookup via `useAllUsers().data`.
4. **Pagination `?size=` vs `?pageSize=`** em `/notifications` e `/audit-logs` — testar empiricamente; ajustar `params.size` → `params.pageSize` se backend rejeitar.
5. **`AUDIT_ENTITY_TYPES` literais** — confirmar capitalização real dos valores que o backend grava em `entity_type`. Se forem `"PRODUCT"` em vez de `"Product"`, ajustar enum + `ENTITY_LINK_BASE`.
6. **Date format dos filtros** — testar enviar `YYYY-MM-DD` em `/notifications`/`/reports`/`/audit-logs`. Se backend exigir `LocalDateTime`, sufixar `T00:00:00` / `T23:59:59` no `setFilter` ou no `buildRangeParams`.
