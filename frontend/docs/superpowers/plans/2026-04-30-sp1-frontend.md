# SP1 Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the SP1 frontend — Auth, Users (OWNER-only) and Units (read for all, write for OWNER) — including HTTP client with JWT refresh, route guards, and CRUD screens.

**Architecture:** Next.js App Router + axios + TanStack Query for server state. JWT tokens persisted in `localStorage`; refresh-on-401 single-flight via axios interceptors. Frontend talks to `/api/*` which Next rewrites to `http://localhost:8080/*` (no CORS). Components co-located with the page that uses them; promoted to `components/<categoria>/` only when shared.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind v4, axios, @tanstack/react-query, react-hook-form, zod, sonner, lucide-react.

**Spec:** [`backend/docs/superpowers/specs/2026-04-30-sp1-frontend-design.md`](../specs/2026-04-30-sp1-frontend-design.md)

**Testing note:** This plan focuses on implementation + manual verification. No test infrastructure exists in the frontend yet — adding it is out of scope. Each task ends with a short manual check (run dev server, click around).

**Deviation from spec:** The spec places `tokenStorage` in `lib/auth.tsx`. This plan places it in `lib/api.ts` instead, to avoid a circular import (`auth.tsx → api.ts → auth.tsx`). `lib/auth.tsx` imports `tokenStorage` from `api.ts`. Pages and hooks that need it either import from `api.ts` directly or use higher-level helpers from `auth.tsx`.

---

## File Map

```
frontend/
  next.config.ts                                 (modify: add rewrites)
  package.json                                   (modify: add deps)
  app/
    layout.tsx                                   (modify: wrap children with <Providers/>)
    page.tsx                                     (modify: redirect by auth status)
    providers.tsx                                (create)
    (public)/auth/page.tsx                       (modify: wire login mutation, error, loading, redirects)
    (protected)/
      layout.tsx                                 (modify: auth guard, real user, hide Usuarios for EMPLOYEE, avatar dropdown w/ logout)
      home/page.tsx                              (create)
      me/page.tsx                                (create)
      usuarios/
        page.tsx                                 (create)
        user-dialog.tsx                          (create)
      unidades/
        page.tsx                                 (create)
        unit-dialog.tsx                          (create)
  lib/
    api.ts                                       (create — axios instance + interceptors)
    auth.tsx                                     (create — tokenStorage + AuthProvider + useAuth)
    users.ts                                     (create — types + zod + TanStack hooks)
    units.ts                                     (create — types + zod + TanStack hooks)
  components/
    ui/
      button.tsx                                 (create)
      input.tsx                                  (create)
      field.tsx                                  (create)
      select.tsx                                 (create)
      badge.tsx                                  (create)
      table.tsx                                  (create)
    overlays/
      modal.tsx                                  (create)
      confirm-dialog.tsx                         (create)
```

---

## Task 1: Install dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install runtime deps**

Run from `frontend/`:

```bash
npm install axios @tanstack/react-query @tanstack/react-query-devtools react-hook-form zod @hookform/resolvers sonner
```

- [ ] **Step 2: Verify dev server still runs**

Run from `frontend/`:

```bash
npm run dev
```

Expected: server starts at `http://localhost:3000`, no errors. Stop it with `Ctrl+C`.

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore(frontend): add axios, tanstack-query, rhf, zod, sonner"
```

---

## Task 2: Add Next rewrite proxy `/api/* → :8080`

**Files:**
- Modify: `frontend/next.config.ts`

- [ ] **Step 1: Read current `next.config.ts`**

Read `frontend/next.config.ts` to know the baseline. It is likely a near-empty default.

- [ ] **Step 2: Replace it with this content**

```ts
import type { NextConfig } from "next"

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8080"

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backendUrl}/:path*` },
    ]
  },
}

export default nextConfig
```

- [ ] **Step 3: Smoke test**

With the backend running (`./mvnw spring-boot:run` in `backend/`) and the frontend running (`npm run dev`), open another terminal and run:

```bash
curl -i http://localhost:3000/api/units
```

Expected: `HTTP/1.1 200 OK` with a JSON envelope `{"data":[...],"page":0,"size":20,"total":...}`. Confirms the rewrite hits Spring on `:8080`.

- [ ] **Step 4: Commit**

```bash
git add frontend/next.config.ts
git commit -m "feat(frontend): proxy /api/* to backend via next rewrites"
```

---

## Task 3: UI primitive — `Button`

**Files:**
- Create: `frontend/components/ui/button.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { type ButtonHTMLAttributes, forwardRef } from "react"

type Variant = "primary" | "secondary" | "danger" | "ghost"
type Size = "sm" | "md"

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant
    size?: Size
}

const VARIANT: Record<Variant, string> = {
    primary: "bg-primary text-white hover:brightness-95 focus:ring-primary/40",
    secondary: "bg-secondary text-text-primary hover:brightness-95 focus:ring-secondary/40",
    danger: "bg-danger text-white hover:brightness-95 focus:ring-danger/40",
    ghost: "bg-transparent text-text-primary hover:bg-text-primary/5 focus:ring-text-primary/20",
}

const SIZE: Record<Size, string> = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 text-sm",
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
    { className = "", variant = "primary", size = "md", ...rest },
    ref,
) {
    return (
        <button
            ref={ref}
            className={`inline-flex items-center justify-center rounded-lg font-semibold transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT[variant]} ${SIZE[size]} ${className}`}
            {...rest}
        />
    )
})
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/ui/button.tsx
git commit -m "feat(frontend): add Button primitive"
```

---

## Task 4: UI primitive — `Input`

**Files:**
- Create: `frontend/components/ui/input.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { type InputHTMLAttributes, forwardRef } from "react"

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
    function Input({ className = "", ...rest }, ref) {
        return (
            <input
                ref={ref}
                className={`w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:bg-text-primary/5 disabled:cursor-not-allowed ${className}`}
                {...rest}
            />
        )
    },
)
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/ui/input.tsx
git commit -m "feat(frontend): add Input primitive"
```

---

## Task 5: UI primitive — `Field` (label + error wrapper)

**Files:**
- Create: `frontend/components/ui/field.tsx`

- [ ] **Step 1: Write the component**

```tsx
import type { ReactNode } from "react"

type Props = {
    label: string
    htmlFor?: string
    error?: string
    hint?: string
    children: ReactNode
    className?: string
}

export function Field({ label, htmlFor, error, hint, children, className = "" }: Props) {
    return (
        <div className={`space-y-1.5 ${className}`}>
            <label htmlFor={htmlFor} className="block text-sm font-medium text-text-primary">
                {label}
            </label>
            {children}
            {error ? (
                <p className="text-xs text-danger">{error}</p>
            ) : hint ? (
                <p className="text-xs text-text-secondary">{hint}</p>
            ) : null}
        </div>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/ui/field.tsx
git commit -m "feat(frontend): add Field wrapper (label + error)"
```

---

## Task 6: UI primitive — `Select`

**Files:**
- Create: `frontend/components/ui/select.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { type SelectHTMLAttributes, forwardRef } from "react"

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
    function Select({ className = "", children, ...rest }, ref) {
        return (
            <select
                ref={ref}
                className={`w-full appearance-none rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:bg-text-primary/5 disabled:cursor-not-allowed ${className}`}
                {...rest}
            >
                {children}
            </select>
        )
    },
)
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/ui/select.tsx
git commit -m "feat(frontend): add Select primitive"
```

---

## Task 7: UI primitive — `Badge`

**Files:**
- Create: `frontend/components/ui/badge.tsx`

- [ ] **Step 1: Write the component**

```tsx
import type { ReactNode } from "react"

type Variant = "neutral" | "success" | "danger" | "warning"

const VARIANT: Record<Variant, string> = {
    neutral: "bg-text-primary/10 text-text-primary",
    success: "bg-primary/15 text-primary",
    danger: "bg-danger/15 text-danger",
    warning: "bg-secondary/40 text-text-primary",
}

export function Badge({ variant = "neutral", children }: { variant?: Variant; children: ReactNode }) {
    return (
        <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${VARIANT[variant]}`}
        >
            {children}
        </span>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/ui/badge.tsx
git commit -m "feat(frontend): add Badge primitive"
```

---

## Task 8: UI primitive — `Table`

**Files:**
- Create: `frontend/components/ui/table.tsx`

- [ ] **Step 1: Write the wrappers**

```tsx
import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react"

export function Table({ children }: { children: ReactNode }) {
    return (
        <div className="overflow-hidden rounded-xl border border-border/40 bg-white">
            <table className="w-full text-sm">{children}</table>
        </div>
    )
}

export function THead({ children }: { children: ReactNode }) {
    return (
        <thead className="bg-text-primary/[0.04] text-xs uppercase tracking-wide text-text-secondary">
            {children}
        </thead>
    )
}

export function TBody({ children }: { children: ReactNode }) {
    return <tbody className="divide-y divide-border/40">{children}</tbody>
}

export function TR({ children, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
    return (
        <tr className="transition hover:bg-text-primary/[0.03]" {...rest}>
            {children}
        </tr>
    )
}

export function TH({ children, className = "", ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
    return (
        <th className={`px-4 py-3 text-left font-medium ${className}`} {...rest}>
            {children}
        </th>
    )
}

export function TD({ children, className = "", ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
    return (
        <td className={`px-4 py-3 text-text-primary ${className}`} {...rest}>
            {children}
        </td>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/ui/table.tsx
git commit -m "feat(frontend): add Table primitives"
```

---

## Task 9: Overlay primitive — `Modal`

**Files:**
- Create: `frontend/components/overlays/modal.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client"

import { X } from "lucide-react"
import { type ReactNode, useEffect } from "react"

type Props = {
    open: boolean
    onClose: () => void
    title: string
    children: ReactNode
    footer?: ReactNode
}

export function Modal({ open, onClose, title, children, footer }: Props) {
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose()
        }
        document.body.style.overflow = "hidden"
        window.addEventListener("keydown", onKey)
        return () => {
            document.body.style.overflow = ""
            window.removeEventListener("keydown", onKey)
        }
    }, [open, onClose])

    if (!open) return null

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={onClose}
            role="presentation"
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="w-full max-w-md rounded-2xl border border-border/40 bg-white shadow-lg"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
                    <h2 className="text-base font-semibold text-text-primary">{title}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-text-primary/60 hover:text-text-primary"
                        aria-label="Fechar"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="px-5 py-4">{children}</div>
                {footer ? (
                    <div className="flex justify-end gap-2 border-t border-border/40 px-5 py-3">{footer}</div>
                ) : null}
            </div>
        </div>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/overlays/modal.tsx
git commit -m "feat(frontend): add Modal overlay primitive"
```

---

## Task 10: Overlay primitive — `ConfirmDialog`

**Files:**
- Create: `frontend/components/overlays/confirm-dialog.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client"

import { Button } from "@/components/ui/button"
import { Modal } from "@/components/overlays/modal"

type Props = {
    open: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    message: string
    confirmLabel?: string
    confirmVariant?: "primary" | "danger"
    loading?: boolean
}

export function ConfirmDialog({
    open,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = "Confirmar",
    confirmVariant = "danger",
    loading,
}: Props) {
    return (
        <Modal
            open={open}
            onClose={onClose}
            title={title}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button variant={confirmVariant} onClick={onConfirm} disabled={loading}>
                        {loading ? "Processando..." : confirmLabel}
                    </Button>
                </>
            }
        >
            <p className="text-sm text-text-primary">{message}</p>
        </Modal>
    )
}
```

> The import `@/components/...` requires `tsconfig.json` to have `"paths": {"@/*": ["./*"]}`. If it doesn't, add it now.

- [ ] **Step 2: Verify path alias works**

Read `frontend/tsconfig.json`. If `compilerOptions.paths` doesn't have `"@/*": ["./*"]`, add it inside `compilerOptions`:

```json
"baseUrl": ".",
"paths": { "@/*": ["./*"] }
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/overlays/confirm-dialog.tsx frontend/tsconfig.json
git commit -m "feat(frontend): add ConfirmDialog + ensure @/* path alias"
```

---

## Task 11: HTTP client — `lib/api.ts`

**Files:**
- Create: `frontend/lib/api.ts`

- [ ] **Step 1: Write the axios instance + interceptors**

```ts
import axios, { type AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios"

export class ApiError extends Error {
    status: number
    fieldErrors?: string[]
    constructor(status: number, message: string, fieldErrors?: string[]) {
        super(message)
        this.status = status
        this.fieldErrors = fieldErrors
    }
}

const TOKEN_KEY = "fv.access"
const REFRESH_KEY = "fv.refresh"

export const tokenStorage = {
    getAccess: () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)),
    setAccess: (t: string) => localStorage.setItem(TOKEN_KEY, t),
    getRefresh: () => (typeof window === "undefined" ? null : localStorage.getItem(REFRESH_KEY)),
    setRefresh: (t: string) => localStorage.setItem(REFRESH_KEY, t),
    clear: () => {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(REFRESH_KEY)
    },
}

export const api = axios.create({
    baseURL: "/api",
    headers: { "Content-Type": "application/json" },
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = tokenStorage.getAccess()
    if (token) config.headers.set("Authorization", `Bearer ${token}`)
    return config
})

// Unwrap envelope: single -> data; paginated -> { data, page, size, total }
api.interceptors.response.use((response) => {
    const body = response.data
    if (
        body &&
        typeof body === "object" &&
        "data" in body &&
        Object.keys(body).length === 1
    ) {
        response.data = (body as { data: unknown }).data
    }
    return response
})

let refreshInFlight: Promise<string> | null = null

async function performRefresh(): Promise<string> {
    const refreshToken = tokenStorage.getRefresh()
    if (!refreshToken) throw new Error("No refresh token")
    const res = await axios.post<{ accessToken: string; refreshToken: string } | { data: { accessToken: string; refreshToken: string } }>(
        "/api/auth/refresh",
        { refreshToken },
        { headers: { "Content-Type": "application/json" } },
    )
    const payload = "data" in (res.data as object) ? (res.data as { data: { accessToken: string; refreshToken: string } }).data : (res.data as { accessToken: string; refreshToken: string })
    tokenStorage.setAccess(payload.accessToken)
    tokenStorage.setRefresh(payload.refreshToken)
    return payload.accessToken
}

api.interceptors.response.use(
    (r) => r,
    async (error: AxiosError) => {
        const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined
        const status = error.response?.status
        const url = original?.url ?? ""

        const isAuthEndpoint = url.startsWith("/auth/login") || url.startsWith("/auth/refresh")

        if (status === 401 && original && !original._retry && !isAuthEndpoint && tokenStorage.getRefresh()) {
            try {
                if (!refreshInFlight) refreshInFlight = performRefresh().finally(() => {
                    refreshInFlight = null
                })
                const newToken = await refreshInFlight
                original._retry = true
                original.headers = { ...(original.headers ?? {}), Authorization: `Bearer ${newToken}` }
                return api(original)
            } catch {
                tokenStorage.clear()
                if (typeof window !== "undefined") {
                    window.dispatchEvent(new Event("auth:expired"))
                }
                return Promise.reject(toApiError(error))
            }
        }

        return Promise.reject(toApiError(error))
    },
)

function toApiError(error: AxiosError): ApiError {
    const status = error.response?.status ?? 0
    const body = error.response?.data as
        | { error?: string; errors?: string[] }
        | undefined

    if (body?.errors && Array.isArray(body.errors)) {
        return new ApiError(status, body.errors[0] ?? "Erro de validação", body.errors)
    }
    if (body?.error) return new ApiError(status, body.error)
    if (status === 401) return new ApiError(status, "Sessão expirada")
    if (status === 0) return new ApiError(0, "Falha ao se conectar com o servidor")
    return new ApiError(status, error.message ?? "Erro desconhecido")
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "feat(frontend): axios instance with auth + refresh single-flight"
```

---

## Task 12: Auth context — `lib/auth.tsx`

**Files:**
- Create: `frontend/lib/auth.tsx`

- [ ] **Step 1: Write the AuthProvider + useAuth**

```tsx
"use client"

import { ApiError, api, tokenStorage } from "@/lib/api"
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"

export type Role = "OWNER" | "EMPLOYEE"

export type User = {
    id: string
    name: string
    email: string
    role: Role
    active: boolean
    createdAt: string
}

type AuthState = {
    user: User | null
    status: "loading" | "authenticated" | "unauthenticated"
}

type AuthContextValue = AuthState & {
    login: (email: string, password: string) => Promise<void>
    logout: () => Promise<void>
    refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AuthState>({
        user: null,
        status: tokenStorage.getAccess() ? "loading" : "unauthenticated",
    })

    const refreshUser = useCallback(async () => {
        try {
            const user = await api.get<User>("/users/me").then((r) => r.data)
            setState({ user, status: "authenticated" })
        } catch {
            tokenStorage.clear()
            setState({ user: null, status: "unauthenticated" })
        }
    }, [])

    useEffect(() => {
        if (state.status === "loading") void refreshUser()
    }, [state.status, refreshUser])

    useEffect(() => {
        const onExpired = () => setState({ user: null, status: "unauthenticated" })
        window.addEventListener("auth:expired", onExpired)
        return () => window.removeEventListener("auth:expired", onExpired)
    }, [])

    const login = useCallback(async (email: string, password: string) => {
        const tokens = await api
            .post<{ accessToken: string; refreshToken: string }>("/auth/login", { email, password })
            .then((r) => r.data)
        tokenStorage.setAccess(tokens.accessToken)
        tokenStorage.setRefresh(tokens.refreshToken)
        await refreshUser()
    }, [refreshUser])

    const logout = useCallback(async () => {
        const refreshToken = tokenStorage.getRefresh()
        if (refreshToken) {
            try {
                await api.post("/auth/logout", { refreshToken })
            } catch {
                // ignore — clear local anyway
            }
        }
        tokenStorage.clear()
        setState({ user: null, status: "unauthenticated" })
    }, [])

    return (
        <AuthContext.Provider value={{ ...state, login, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error("useAuth must be used within AuthProvider")
    return ctx
}

export function isApiError(e: unknown): e is ApiError {
    return e instanceof ApiError
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/auth.tsx
git commit -m "feat(frontend): auth context with login, logout, refreshUser"
```

---

## Task 13: Providers wrapper

**Files:**
- Create: `frontend/app/providers.tsx`

- [ ] **Step 1: Write the providers**

```tsx
"use client"

import { AuthProvider } from "@/lib/auth"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { useState, type ReactNode } from "react"
import { Toaster } from "sonner"

export function Providers({ children }: { children: ReactNode }) {
    const [client] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 30_000,
                        retry: 1,
                        refetchOnWindowFocus: false,
                    },
                },
            }),
    )

    return (
        <QueryClientProvider client={client}>
            <AuthProvider>
                {children}
                <Toaster richColors position="top-right" />
            </AuthProvider>
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/providers.tsx
git commit -m "feat(frontend): Providers (QueryClient + AuthProvider + Toaster)"
```

---

## Task 14: Wire `<Providers/>` into the root layout

**Files:**
- Modify: `frontend/app/layout.tsx`

- [ ] **Step 1: Read current `app/layout.tsx`**

Read it first to know the exact JSX you'll modify.

- [ ] **Step 2: Wrap `{children}` with `<Providers>`**

Apply this exact change inside the `<body>`:

```tsx
import { Providers } from "./providers"
// ... keep existing imports

// inside <body>:
<Providers>{children}</Providers>
```

The full file should look like:

```tsx
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
    title: "Forno Vivo",
    description: "Gestão de pizzaria",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
            <body className="min-h-full flex flex-col">
                <Providers>{children}</Providers>
            </body>
        </html>
    )
}
```

- [ ] **Step 3: Verify dev server still compiles**

Run `npm run dev`, open `http://localhost:3000` — should render the existing default page without errors. Stop dev.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/layout.tsx
git commit -m "feat(frontend): wrap app in <Providers/>"
```

---

## Task 15: Root `/` redirects by auth status

**Files:**
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Replace the file content**

```tsx
"use client"

import { useAuth } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function RootPage() {
    const router = useRouter()
    const { status } = useAuth()

    useEffect(() => {
        if (status === "authenticated") router.replace("/home")
        else if (status === "unauthenticated") router.replace("/auth")
    }, [status, router])

    return (
        <div className="flex min-h-screen items-center justify-center text-sm text-text-secondary">
            Carregando...
        </div>
    )
}
```

- [ ] **Step 2: Verify**

Run `npm run dev`. Visit `http://localhost:3000/` — should briefly show "Carregando..." then redirect to `/auth` (no token in localStorage). Stop dev.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/page.tsx
git commit -m "feat(frontend): root page redirects by auth status"
```

---

## Task 16: Wire login form

**Files:**
- Modify: `frontend/app/(public)/auth/page.tsx`

- [ ] **Step 1: Replace the file with the wired version**

```tsx
"use client"

import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { isApiError, useAuth } from "@/lib/auth"
import { Flame } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, type FormEvent } from "react"

export default function AuthPage() {
    const router = useRouter()
    const params = useSearchParams()
    const { login, status } = useAuth()
    const expired = params.get("expired") === "1"

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)

    useEffect(() => {
        if (status === "authenticated") router.replace("/home")
    }, [status, router])

    async function onSubmit(e: FormEvent) {
        e.preventDefault()
        setSubmitting(true)
        setFormError(null)
        try {
            await login(email, password)
            router.replace("/home")
        } catch (err) {
            if (isApiError(err) && err.status === 401) {
                setFormError("E-mail ou senha inválidos.")
            } else if (isApiError(err) && err.status === 0) {
                setFormError("Falha ao se conectar com o servidor.")
            } else {
                setFormError("Não foi possível entrar. Tente novamente.")
            }
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <main className="flex flex-1 items-center justify-center px-4">
            <div className="w-full max-w-md rounded-2xl border border-border/40 bg-white p-8 shadow-sm">
                <div className="flex flex-col items-center text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-danger text-white">
                        <Flame className="h-6 w-6" />
                    </div>
                    <h1 className="mt-4 text-2xl font-semibold text-text-primary">Forno Vivo</h1>
                    <p className="mt-1 text-sm text-text-secondary">Entre para gerenciar sua pizzaria</p>
                </div>

                {expired ? (
                    <div className="mt-6 rounded-lg border border-border/40 bg-secondary/20 px-3 py-2 text-xs text-text-primary">
                        Sua sessão expirou. Faça login novamente.
                    </div>
                ) : null}

                <form className="mt-8 space-y-5" onSubmit={onSubmit}>
                    <Field label="E-mail" htmlFor="email">
                        <Input
                            id="email"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={submitting}
                        />
                    </Field>

                    <Field label="Senha" htmlFor="password">
                        <Input
                            id="password"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={submitting}
                        />
                    </Field>

                    {formError ? (
                        <p className="text-center text-sm text-danger">{formError}</p>
                    ) : null}

                    <Button type="submit" className="w-full" disabled={submitting}>
                        {submitting ? "Entrando..." : "Entrar"}
                    </Button>
                </form>
            </div>
        </main>
    )
}
```

- [ ] **Step 2: Manual verification**

1. Make sure backend is running on `:8080`.
2. Run `npm run dev` in frontend.
3. Open `http://localhost:3000/auth`.
4. Submit empty form → browser native validation kicks in.
5. Submit with bad credentials (`x@x.com` / `wrong`) → "E-mail ou senha inválidos." appears.
6. Submit with `admin@pizzaria.com` / `admin123` → redirected to `/home` (which doesn't exist yet, will 404 — expected). Open DevTools → Application → Local Storage → confirm `fv.access` and `fv.refresh` are set.
7. Visit `/auth?expired=1` → expired banner appears.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/\(public\)/auth/page.tsx
git commit -m "feat(frontend): wire login form to auth.login mutation"
```

---

## Task 17: Update `(protected)/layout.tsx` with guard, real user, hidden Usuarios for EMPLOYEE, avatar dropdown w/ logout

**Files:**
- Modify: `frontend/app/(protected)/layout.tsx`

- [ ] **Step 1: Read the current file**

You already have a working sidebar+header. Keep its structure; layer on the auth/guard logic.

- [ ] **Step 2: Replace the file with the updated version**

```tsx
"use client"

import {
    ArrowLeftRight,
    BarChart3,
    Bell,
    Boxes,
    FileText,
    Flame,
    LayoutGrid,
    Leaf,
    LogOut,
    type LucideIcon,
    Package,
    PanelLeft,
    Ruler,
    Search,
    ShoppingBag,
    ShoppingCart,
    Tag,
    Truck,
    User as UserIcon,
    Users,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { useAuth, type Role } from "@/lib/auth"

type NavItem = {
    label: string
    href: string
    icon: LucideIcon
    requireRole?: Role
}

type NavSection = {
    title: string
    items: NavItem[]
}

const SECTIONS: NavSection[] = [
    {
        title: "Visão geral",
        items: [{ label: "Dashboard", href: "/home", icon: LayoutGrid }],
    },
    {
        title: "Vendas",
        items: [
            { label: "Pedidos", href: "/pedidos", icon: ShoppingBag },
            { label: "Notificações", href: "/notificacoes", icon: Bell },
        ],
    },
    {
        title: "Catálogo",
        items: [
            { label: "Produtos", href: "/produtos", icon: Package },
            { label: "Categorias", href: "/categorias", icon: Tag },
            { label: "Ingredientes", href: "/ingredientes", icon: Leaf },
            { label: "Unidades", href: "/unidades", icon: Ruler },
        ],
    },
    {
        title: "Suprimentos",
        items: [
            { label: "Compras", href: "/compras", icon: ShoppingCart },
            { label: "Fornecedores", href: "/fornecedores", icon: Truck },
            { label: "Estoque", href: "/estoque", icon: Boxes },
            { label: "Movimentações", href: "/movimentacoes", icon: ArrowLeftRight },
        ],
    },
    {
        title: "Análise",
        items: [
            { label: "Relatórios", href: "/relatorios", icon: BarChart3 },
            { label: "Auditoria", href: "/auditoria", icon: FileText },
        ],
    },
    {
        title: "Administração",
        items: [{ label: "Usuários", href: "/usuarios", icon: Users, requireRole: "OWNER" }],
    },
]

function initials(name: string): string {
    return name
        .split(" ")
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const { user, status, logout } = useAuth()
    const [collapsed, setCollapsed] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (status === "unauthenticated") router.replace("/auth")
    }, [status, router])

    useEffect(() => {
        function onClickOutside(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false)
            }
        }
        if (menuOpen) document.addEventListener("mousedown", onClickOutside)
        return () => document.removeEventListener("mousedown", onClickOutside)
    }, [menuOpen])

    if (status !== "authenticated" || !user) {
        return (
            <div className="flex flex-1 items-center justify-center text-sm text-text-secondary">
                Carregando...
            </div>
        )
    }

    async function onLogout() {
        await logout()
        router.replace("/auth")
    }

    const visibleSections = SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter((item) => !item.requireRole || item.requireRole === user.role),
    })).filter((s) => s.items.length > 0)

    return (
        <div className="flex flex-1 min-h-0">
            {!collapsed && (
                <aside className="flex w-64 shrink-0 flex-col border-r border-border/40 bg-bg">
                    <div className="flex items-center gap-3 px-5 py-4">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-danger text-white">
                            <Flame className="h-5 w-5" />
                        </div>
                        <div className="leading-tight">
                            <p className="text-sm font-semibold text-text-primary">Forno Vivo</p>
                            <p className="text-xs text-text-secondary">Gestão de pizzaria</p>
                        </div>
                    </div>

                    <nav className="flex-1 overflow-y-auto px-3 pb-6">
                        {visibleSections.map((section) => (
                            <div key={section.title} className="mt-4">
                                <p className="px-3 pb-1 text-xs font-medium text-text-secondary">
                                    {section.title}
                                </p>
                                <ul className="space-y-0.5">
                                    {section.items.map((item) => {
                                        const Icon = item.icon
                                        const active = pathname === item.href
                                        return (
                                            <li key={item.href}>
                                                <Link
                                                    href={item.href}
                                                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                                                        active
                                                            ? "bg-text-primary font-medium text-bg"
                                                            : "text-text-primary/70 hover:bg-text-primary/5 hover:text-text-primary"
                                                    }`}
                                                >
                                                    <Icon
                                                        className={`h-4 w-4 shrink-0 ${active ? "text-primary" : ""}`}
                                                    />
                                                    <span>{item.label}</span>
                                                </Link>
                                            </li>
                                        )
                                    })}
                                </ul>
                            </div>
                        ))}
                    </nav>
                </aside>
            )}

            <div className="flex min-w-0 flex-1 flex-col">
                <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border/40 bg-bg px-4">
                    <button
                        type="button"
                        onClick={() => setCollapsed((c) => !c)}
                        className="flex h-9 w-9 items-center justify-center rounded-md text-text-primary/70 transition hover:bg-text-primary/5 hover:text-text-primary"
                        aria-label="Alternar menu lateral"
                    >
                        <PanelLeft className="h-5 w-5" />
                    </button>

                    <div className="relative flex-1 max-w-2xl">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-primary/50" />
                        <input
                            type="search"
                            placeholder="Buscar pedidos, produtos, ingredientes..."
                            className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm text-text-primary outline-none transition placeholder:text-text-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/30"
                        />
                    </div>

                    <div className="ml-auto flex items-center gap-3">
                        <button
                            type="button"
                            className="relative flex h-9 w-9 items-center justify-center rounded-md text-text-primary/70 transition hover:bg-text-primary/5 hover:text-text-primary"
                            aria-label="Notificações"
                        >
                            <Bell className="h-5 w-5" />
                        </button>

                        <div ref={menuRef} className="relative">
                            <button
                                type="button"
                                onClick={() => setMenuOpen((o) => !o)}
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white"
                                aria-label={user.name}
                            >
                                {initials(user.name)}
                            </button>
                            {menuOpen ? (
                                <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-lg border border-border/40 bg-white shadow-lg">
                                    <div className="border-b border-border/40 px-3 py-2">
                                        <p className="truncate text-sm font-medium text-text-primary">{user.name}</p>
                                        <p className="truncate text-xs text-text-secondary">{user.email}</p>
                                    </div>
                                    <Link
                                        href="/me"
                                        onClick={() => setMenuOpen(false)}
                                        className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-text-primary/5"
                                    >
                                        <UserIcon className="h-4 w-4" /> Meu perfil
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={onLogout}
                                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger hover:bg-danger/5"
                                    >
                                        <LogOut className="h-4 w-4" /> Sair
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-6">{children}</main>
            </div>
        </div>
    )
}
```

- [ ] **Step 3: Manual verification**

1. With dev server running, visit `/usuarios` while logged out → redirected to `/auth`.
2. Log in as `admin@pizzaria.com` / `admin123` → redirected to `/home` (still 404, next task fixes).
3. Open the avatar menu → see name + email + "Meu perfil" + "Sair".
4. Click "Sair" → redirected to `/auth`. Local storage cleared.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/\(protected\)/layout.tsx
git commit -m "feat(frontend): protected layout guard + avatar menu + role-aware sidebar"
```

---

## Task 18: `/home` placeholder

**Files:**
- Create: `frontend/app/(protected)/home/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
"use client"

import { useAuth } from "@/lib/auth"
import Link from "next/link"

export default function HomePage() {
    const { user } = useAuth()
    if (!user) return null

    const firstName = user.name.split(" ")[0]

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-text-primary">
                    Bem-vinda, {firstName} 👋
                </h1>
                <p className="mt-1 text-sm text-text-secondary">
                    Aqui está o resumo da operação. Em breve: dashboard completo (vendas, estoque, alertas).
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <Link
                    href="/unidades"
                    className="rounded-xl border border-border/40 bg-white p-5 transition hover:border-primary"
                >
                    <p className="text-xs uppercase tracking-wide text-text-secondary">Unidades</p>
                    <p className="mt-1 text-base font-semibold text-text-primary">Ver unidades</p>
                </Link>
                <Link
                    href="/me"
                    className="rounded-xl border border-border/40 bg-white p-5 transition hover:border-primary"
                >
                    <p className="text-xs uppercase tracking-wide text-text-secondary">Seu perfil</p>
                    <p className="mt-1 text-base font-semibold text-text-primary">
                        {user.role} · {user.name}
                    </p>
                </Link>
            </div>
        </div>
    )
}
```

- [ ] **Step 2: Manual verification**

Log in → land on `/home` → see "Bem-vinda, Administrador 👋" + 2 cards. Sidebar marks Dashboard as active.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/\(protected\)/home/page.tsx
git commit -m "feat(frontend): home placeholder page"
```

---

## Task 19: `lib/users.ts` — types, schemas, hooks

**Files:**
- Create: `frontend/lib/users.ts`

- [ ] **Step 1: Write the module**

```ts
import { api } from "@/lib/api"
import type { Role, User } from "@/lib/auth"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

export type { User, Role }

export type Page<T> = { data: T[]; page: number; size: number; total: number }

export const createUserSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(100),
    email: z.string().email("E-mail inválido").max(150),
    password: z.string().min(6, "Mínimo 6 caracteres").max(100),
    role: z.enum(["OWNER", "EMPLOYEE"]),
})
export type CreateUserInput = z.infer<typeof createUserSchema>

export const updateUserSchema = z.object({
    name: z.string().min(1).max(100),
    email: z.string().email().max(150),
    role: z.enum(["OWNER", "EMPLOYEE"]),
    active: z.boolean(),
})
export type UpdateUserInput = z.infer<typeof updateUserSchema>

export const changePasswordSchema = z
    .object({
        currentPassword: z.string().min(1, "Informe a senha atual"),
        newPassword: z.string().min(6, "Mínimo 6 caracteres").max(100),
        confirmPassword: z.string(),
    })
    .refine((d) => d.newPassword === d.confirmPassword, {
        path: ["confirmPassword"],
        message: "As senhas não coincidem",
    })
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

export function useUsers(page = 0, size = 20) {
    return useQuery({
        queryKey: ["users", page, size],
        queryFn: () =>
            api.get<Page<User>>("/users", { params: { page, size } }).then((r) => r.data),
    })
}

export function useCreateUser() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (input: CreateUserInput) =>
            api.post<User>("/users", input).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    })
}

export function useUpdateUser() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
            api.put<User>(`/users/${id}`, input).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    })
}

export function useDeactivateUser() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => api.delete(`/users/${id}`).then(() => undefined),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    })
}

export function useReactivateUser() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
            api.put<User>(`/users/${id}`, { ...input, active: true }).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    })
}

export function useChangeMyPassword() {
    return useMutation({
        mutationFn: (input: { currentPassword: string; newPassword: string }) =>
            api.put("/users/me/password", input).then(() => undefined),
    })
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/users.ts
git commit -m "feat(frontend): users types, schemas and TanStack hooks"
```

---

## Task 20: `lib/units.ts` — types, schemas, hooks

**Files:**
- Create: `frontend/lib/units.ts`

- [ ] **Step 1: Write the module**

```ts
import { api } from "@/lib/api"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import type { Page } from "@/lib/users"

export type Unit = {
    id: string
    name: string
    address: string | null
    active: boolean
    createdAt: string
}

export const createUnitSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(100),
    address: z.string().max(255).optional().or(z.literal("")),
})
export type CreateUnitInput = z.infer<typeof createUnitSchema>

export const updateUnitSchema = z.object({
    name: z.string().min(1).max(100),
    address: z.string().max(255).optional().or(z.literal("")),
    active: z.boolean(),
})
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>

export function useUnits(page = 0, size = 20) {
    return useQuery({
        queryKey: ["units", page, size],
        queryFn: () =>
            api.get<Page<Unit>>("/units", { params: { page, size } }).then((r) => r.data),
    })
}

export function useCreateUnit() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (input: CreateUnitInput) =>
            api.post<Unit>("/units", input).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["units"] }),
    })
}

export function useUpdateUnit() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: UpdateUnitInput }) =>
            api.put<Unit>(`/units/${id}`, input).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["units"] }),
    })
}

export function useDeactivateUnit() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => api.delete(`/units/${id}`).then(() => undefined),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["units"] }),
    })
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/units.ts
git commit -m "feat(frontend): units types, schemas and TanStack hooks"
```

---

## Task 21: `/me` — profile + change password

**Files:**
- Create: `frontend/app/(protected)/me/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
"use client"

import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { isApiError, useAuth } from "@/lib/auth"
import { changePasswordSchema, useChangeMyPassword, type ChangePasswordInput } from "@/lib/users"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

export default function MePage() {
    const { user } = useAuth()
    const changePassword = useChangeMyPassword()

    const form = useForm<ChangePasswordInput>({
        resolver: zodResolver(changePasswordSchema),
        defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    })

    if (!user) return null

    async function onSubmit(values: ChangePasswordInput) {
        try {
            await changePassword.mutateAsync({
                currentPassword: values.currentPassword,
                newPassword: values.newPassword,
            })
            form.reset()
            toast.success("Senha alterada com sucesso")
        } catch (err) {
            if (isApiError(err) && err.status === 400) {
                form.setError("currentPassword", { message: err.message })
            } else {
                toast.error("Não foi possível alterar a senha")
            }
        }
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <h1 className="text-2xl font-semibold text-text-primary">Meu perfil</h1>

            <section className="rounded-xl border border-border/40 bg-white p-5">
                <h2 className="text-base font-semibold text-text-primary">Dados</h2>
                <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                    <div>
                        <dt className="text-text-secondary">Nome</dt>
                        <dd className="text-text-primary">{user.name}</dd>
                    </div>
                    <div>
                        <dt className="text-text-secondary">E-mail</dt>
                        <dd className="text-text-primary">{user.email}</dd>
                    </div>
                    <div>
                        <dt className="text-text-secondary">Perfil</dt>
                        <dd className="text-text-primary">{user.role}</dd>
                    </div>
                    <div>
                        <dt className="text-text-secondary">Ativo desde</dt>
                        <dd className="text-text-primary">
                            {new Date(user.createdAt).toLocaleDateString("pt-BR")}
                        </dd>
                    </div>
                </dl>
            </section>

            <section className="rounded-xl border border-border/40 bg-white p-5">
                <h2 className="text-base font-semibold text-text-primary">Alterar senha</h2>
                <form className="mt-4 space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                    <Field
                        label="Senha atual"
                        htmlFor="currentPassword"
                        error={form.formState.errors.currentPassword?.message}
                    >
                        <Input id="currentPassword" type="password" {...form.register("currentPassword")} />
                    </Field>
                    <Field
                        label="Nova senha"
                        htmlFor="newPassword"
                        error={form.formState.errors.newPassword?.message}
                    >
                        <Input id="newPassword" type="password" {...form.register("newPassword")} />
                    </Field>
                    <Field
                        label="Confirmar nova senha"
                        htmlFor="confirmPassword"
                        error={form.formState.errors.confirmPassword?.message}
                    >
                        <Input id="confirmPassword" type="password" {...form.register("confirmPassword")} />
                    </Field>
                    <div className="flex justify-end">
                        <Button type="submit" disabled={changePassword.isPending}>
                            {changePassword.isPending ? "Salvando..." : "Salvar senha"}
                        </Button>
                    </div>
                </form>
            </section>
        </div>
    )
}
```

- [ ] **Step 2: Manual verification**

1. Log in, click avatar → "Meu perfil" → goes to `/me`. Card with dados shows real user.
2. Try changing the password with wrong current password → error inline on `currentPassword`.
3. Enter mismatching new + confirm → zod error on `confirmPassword`.
4. Successful change → toast "Senha alterada com sucesso", form resets. Logout + log in with the new password to confirm. Then change it back.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/\(protected\)/me/page.tsx
git commit -m "feat(frontend): /me profile + change password"
```

---

## Task 22: `/usuarios` — list + dialog

**Files:**
- Create: `frontend/app/(protected)/usuarios/user-dialog.tsx`
- Create: `frontend/app/(protected)/usuarios/page.tsx`

- [ ] **Step 1: Write `user-dialog.tsx`**

```tsx
"use client"

import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/overlays/modal"
import { isApiError } from "@/lib/auth"
import {
    createUserSchema,
    updateUserSchema,
    useCreateUser,
    useUpdateUser,
    type CreateUserInput,
    type UpdateUserInput,
    type User,
} from "@/lib/users"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

type Props = {
    open: boolean
    onClose: () => void
    user: User | null
}

export function UserDialog({ open, onClose, user }: Props) {
    const editing = !!user
    const createUser = useCreateUser()
    const updateUser = useUpdateUser()

    const form = useForm<CreateUserInput | UpdateUserInput>({
        resolver: zodResolver(editing ? updateUserSchema : createUserSchema),
        defaultValues: editing
            ? { name: user.name, email: user.email, role: user.role, active: user.active }
            : { name: "", email: "", password: "", role: "EMPLOYEE" },
    })

    useEffect(() => {
        if (open) {
            form.reset(
                editing
                    ? { name: user.name, email: user.email, role: user.role, active: user.active }
                    : { name: "", email: "", password: "", role: "EMPLOYEE" },
            )
        }
    }, [open, editing, user, form])

    async function onSubmit(values: CreateUserInput | UpdateUserInput) {
        try {
            if (editing) {
                await updateUser.mutateAsync({ id: user.id, input: values as UpdateUserInput })
                toast.success("Usuário atualizado")
            } else {
                await createUser.mutateAsync(values as CreateUserInput)
                toast.success("Usuário criado")
            }
            onClose()
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao salvar usuário")
        }
    }

    const submitting = createUser.isPending || updateUser.isPending

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={editing ? "Editar usuário" : "Novo usuário"}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" form="user-form" disabled={submitting}>
                        {submitting ? "Salvando..." : "Salvar"}
                    </Button>
                </>
            }
        >
            <form id="user-form" className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                <Field label="Nome" htmlFor="name" error={form.formState.errors.name?.message}>
                    <Input id="name" {...form.register("name")} />
                </Field>
                <Field label="E-mail" htmlFor="email" error={form.formState.errors.email?.message}>
                    <Input id="email" type="email" {...form.register("email")} />
                </Field>
                {!editing ? (
                    <Field
                        label="Senha"
                        htmlFor="password"
                        error={(form.formState.errors as Record<string, { message?: string }>).password?.message}
                    >
                        <Input id="password" type="password" {...form.register("password" as never)} />
                    </Field>
                ) : null}
                <Field label="Perfil" htmlFor="role" error={form.formState.errors.role?.message}>
                    <Select id="role" {...form.register("role")}>
                        <option value="EMPLOYEE">EMPLOYEE</option>
                        <option value="OWNER">OWNER</option>
                    </Select>
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

- [ ] **Step 2: Write `page.tsx`**

```tsx
"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { ConfirmDialog } from "@/components/overlays/confirm-dialog"
import { isApiError, useAuth } from "@/lib/auth"
import {
    useDeactivateUser,
    useReactivateUser,
    useUsers,
    type User,
} from "@/lib/users"
import { Pencil, Plus, Power, RotateCcw } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { UserDialog } from "./user-dialog"

export default function UsuariosPage() {
    const { user: me } = useAuth()
    const [page, setPage] = useState(0)
    const size = 20
    const usersQuery = useUsers(page, size)

    const [dialogOpen, setDialogOpen] = useState(false)
    const [editing, setEditing] = useState<User | null>(null)

    const [confirm, setConfirm] = useState<{ user: User; action: "deactivate" | "reactivate" } | null>(null)
    const deactivate = useDeactivateUser()
    const reactivate = useReactivateUser()

    if (me?.role !== "OWNER") {
        return <NoAccess />
    }

    const data = usersQuery.data
    const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1

    async function onConfirm() {
        if (!confirm) return
        try {
            if (confirm.action === "deactivate") {
                await deactivate.mutateAsync(confirm.user.id)
                toast.success("Usuário desativado")
            } else {
                await reactivate.mutateAsync({
                    id: confirm.user.id,
                    input: {
                        name: confirm.user.name,
                        email: confirm.user.email,
                        role: confirm.user.role,
                        active: true,
                    },
                })
                toast.success("Usuário reativado")
            }
            setConfirm(null)
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao alterar status")
        }
    }

    return (
        <div className="space-y-6">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-text-primary">Usuários</h1>
                    <p className="mt-1 text-sm text-text-secondary">
                        Gerencie quem tem acesso ao sistema.
                    </p>
                </div>
                <Button
                    onClick={() => {
                        setEditing(null)
                        setDialogOpen(true)
                    }}
                >
                    <Plus className="mr-2 h-4 w-4" /> Novo usuário
                </Button>
            </header>

            {usersQuery.isLoading ? (
                <SkeletonRows />
            ) : usersQuery.isError ? (
                <ErrorBanner onRetry={() => usersQuery.refetch()} />
            ) : data && data.data.length === 0 ? (
                <EmptyState
                    onCreate={() => {
                        setEditing(null)
                        setDialogOpen(true)
                    }}
                />
            ) : (
                <Table>
                    <THead>
                        <TR>
                            <TH>Nome</TH>
                            <TH>E-mail</TH>
                            <TH>Perfil</TH>
                            <TH>Status</TH>
                            <TH className="w-px text-right">Ações</TH>
                        </TR>
                    </THead>
                    <TBody>
                        {data!.data.map((u) => (
                            <TR key={u.id}>
                                <TD>{u.name}</TD>
                                <TD className="max-w-[260px] truncate">{u.email}</TD>
                                <TD>
                                    <Badge variant={u.role === "OWNER" ? "success" : "neutral"}>
                                        {u.role}
                                    </Badge>
                                </TD>
                                <TD>
                                    <Badge variant={u.active ? "success" : "neutral"}>
                                        {u.active ? "Ativo" : "Inativo"}
                                    </Badge>
                                </TD>
                                <TD className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditing(u)
                                                setDialogOpen(true)
                                            }}
                                            className="rounded p-1.5 text-text-primary/70 hover:bg-text-primary/5 hover:text-text-primary"
                                            aria-label={`Editar ${u.name}`}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </button>
                                        {u.id === me.id ? null : u.active ? (
                                            <button
                                                type="button"
                                                onClick={() => setConfirm({ user: u, action: "deactivate" })}
                                                className="rounded p-1.5 text-danger/80 hover:bg-danger/10"
                                                aria-label={`Desativar ${u.name}`}
                                            >
                                                <Power className="h-4 w-4" />
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setConfirm({ user: u, action: "reactivate" })}
                                                className="rounded p-1.5 text-text-primary/70 hover:bg-text-primary/5"
                                                aria-label={`Reativar ${u.name}`}
                                            >
                                                <RotateCcw className="h-4 w-4" />
                                            </button>
                                        )}
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

            <UserDialog open={dialogOpen} onClose={() => setDialogOpen(false)} user={editing} />

            <ConfirmDialog
                open={!!confirm}
                onClose={() => setConfirm(null)}
                onConfirm={onConfirm}
                title={confirm?.action === "deactivate" ? "Desativar usuário" : "Reativar usuário"}
                message={
                    confirm?.action === "deactivate"
                        ? `Confirma desativar ${confirm.user.name}? Ele perderá acesso ao sistema.`
                        : `Confirma reativar ${confirm?.user.name}?`
                }
                confirmLabel={confirm?.action === "deactivate" ? "Desativar" : "Reativar"}
                confirmVariant={confirm?.action === "deactivate" ? "danger" : "primary"}
                loading={deactivate.isPending || reactivate.isPending}
            />
        </div>
    )
}

function SkeletonRows() {
    return (
        <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-text-primary/5" />
            ))}
        </div>
    )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
    return (
        <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
            <p className="text-sm text-text-secondary">Nenhum usuário cadastrado.</p>
            <Button className="mt-4" onClick={onCreate}>
                Criar primeiro usuário
            </Button>
        </div>
    )
}

function ErrorBanner({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
            <p className="text-sm text-danger">Falha ao carregar usuários.</p>
            <Button variant="ghost" size="sm" onClick={onRetry}>
                Tentar novamente
            </Button>
        </div>
    )
}

function NoAccess() {
    return (
        <div className="mx-auto max-w-md rounded-xl border border-border/40 bg-white p-8 text-center">
            <h2 className="text-base font-semibold text-text-primary">Sem permissão</h2>
            <p className="mt-2 text-sm text-text-secondary">
                Apenas o proprietário pode gerenciar usuários.
            </p>
        </div>
    )
}
```

- [ ] **Step 3: Manual verification**

1. Log in as OWNER. Visit `/usuarios` → tabela com o admin seedado.
2. Click "Novo usuário" → preenche `Bruno / bruno@pizzaria.com / 123456 / EMPLOYEE` → "Salvar". Toast de sucesso, lista atualiza.
3. Click no lápis em Bruno → muda nome → salva. Atualiza.
4. Click no power icon em Bruno → confirm → desativa. Status vira "Inativo".
5. Click no rotate icon → reativa. Status volta a "Ativo".
6. Não há botão de desativar na sua própria linha (admin).
7. Logout. Login como Bruno (EMPLOYEE). Visite `/usuarios` manualmente → tela "Sem permissão". Item "Usuários" não aparece no menu.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/\(protected\)/usuarios/
git commit -m "feat(frontend): /usuarios CRUD with create/edit/deactivate"
```

---

## Task 23: `/unidades` — list + dialog

**Files:**
- Create: `frontend/app/(protected)/unidades/unit-dialog.tsx`
- Create: `frontend/app/(protected)/unidades/page.tsx`

- [ ] **Step 1: Write `unit-dialog.tsx`**

```tsx
"use client"

import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/overlays/modal"
import { isApiError } from "@/lib/auth"
import {
    createUnitSchema,
    updateUnitSchema,
    useCreateUnit,
    useUpdateUnit,
    type CreateUnitInput,
    type Unit,
    type UpdateUnitInput,
} from "@/lib/units"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

type Props = {
    open: boolean
    onClose: () => void
    unit: Unit | null
}

export function UnitDialog({ open, onClose, unit }: Props) {
    const editing = !!unit
    const create = useCreateUnit()
    const update = useUpdateUnit()

    const form = useForm<CreateUnitInput | UpdateUnitInput>({
        resolver: zodResolver(editing ? updateUnitSchema : createUnitSchema),
        defaultValues: editing
            ? { name: unit.name, address: unit.address ?? "", active: unit.active }
            : { name: "", address: "" },
    })

    useEffect(() => {
        if (open) {
            form.reset(
                editing
                    ? { name: unit.name, address: unit.address ?? "", active: unit.active }
                    : { name: "", address: "" },
            )
        }
    }, [open, editing, unit, form])

    async function onSubmit(values: CreateUnitInput | UpdateUnitInput) {
        try {
            if (editing) {
                await update.mutateAsync({ id: unit.id, input: values as UpdateUnitInput })
                toast.success("Unidade atualizada")
            } else {
                await create.mutateAsync(values as CreateUnitInput)
                toast.success("Unidade criada")
            }
            onClose()
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao salvar unidade")
        }
    }

    const submitting = create.isPending || update.isPending

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={editing ? "Editar unidade" : "Nova unidade"}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" form="unit-form" disabled={submitting}>
                        {submitting ? "Salvando..." : "Salvar"}
                    </Button>
                </>
            }
        >
            <form id="unit-form" className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                <Field label="Nome" htmlFor="unit-name" error={form.formState.errors.name?.message}>
                    <Input id="unit-name" {...form.register("name")} />
                </Field>
                <Field
                    label="Endereço"
                    htmlFor="unit-address"
                    error={form.formState.errors.address?.message}
                >
                    <Input id="unit-address" {...form.register("address")} />
                </Field>
                {editing ? (
                    <label className="flex items-center gap-2 text-sm text-text-primary">
                        <input type="checkbox" {...form.register("active" as never)} />
                        Ativa
                    </label>
                ) : null}
            </form>
        </Modal>
    )
}
```

- [ ] **Step 2: Write `page.tsx`**

```tsx
"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { ConfirmDialog } from "@/components/overlays/confirm-dialog"
import { isApiError, useAuth } from "@/lib/auth"
import { useDeactivateUnit, useUnits, type Unit } from "@/lib/units"
import { Pencil, Plus, Power } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { UnitDialog } from "./unit-dialog"

export default function UnidadesPage() {
    const { user } = useAuth()
    const isOwner = user?.role === "OWNER"
    const [page, setPage] = useState(0)
    const size = 20
    const unitsQuery = useUnits(page, size)

    const [dialogOpen, setDialogOpen] = useState(false)
    const [editing, setEditing] = useState<Unit | null>(null)
    const [confirm, setConfirm] = useState<Unit | null>(null)
    const deactivate = useDeactivateUnit()

    const data = unitsQuery.data
    const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1

    async function onConfirm() {
        if (!confirm) return
        try {
            await deactivate.mutateAsync(confirm.id)
            toast.success("Unidade desativada")
            setConfirm(null)
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao desativar unidade")
        }
    }

    return (
        <div className="space-y-6">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-text-primary">Unidades</h1>
                    <p className="mt-1 text-sm text-text-secondary">As unidades físicas da pizzaria.</p>
                </div>
                {isOwner ? (
                    <Button
                        onClick={() => {
                            setEditing(null)
                            setDialogOpen(true)
                        }}
                    >
                        <Plus className="mr-2 h-4 w-4" /> Nova unidade
                    </Button>
                ) : null}
            </header>

            {unitsQuery.isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-12 animate-pulse rounded-lg bg-text-primary/5" />
                    ))}
                </div>
            ) : unitsQuery.isError ? (
                <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
                    <p className="text-sm text-danger">Falha ao carregar unidades.</p>
                    <Button variant="ghost" size="sm" onClick={() => unitsQuery.refetch()}>
                        Tentar novamente
                    </Button>
                </div>
            ) : data && data.data.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                    <p className="text-sm text-text-secondary">Nenhuma unidade cadastrada.</p>
                    {isOwner ? (
                        <Button
                            className="mt-4"
                            onClick={() => {
                                setEditing(null)
                                setDialogOpen(true)
                            }}
                        >
                            Criar primeira unidade
                        </Button>
                    ) : null}
                </div>
            ) : (
                <Table>
                    <THead>
                        <TR>
                            <TH>Nome</TH>
                            <TH>Endereço</TH>
                            <TH>Status</TH>
                            {isOwner ? <TH className="w-px text-right">Ações</TH> : null}
                        </TR>
                    </THead>
                    <TBody>
                        {data!.data.map((u) => (
                            <TR key={u.id}>
                                <TD>{u.name}</TD>
                                <TD className="max-w-[320px] truncate">{u.address ?? "—"}</TD>
                                <TD>
                                    <Badge variant={u.active ? "success" : "neutral"}>
                                        {u.active ? "Ativa" : "Inativa"}
                                    </Badge>
                                </TD>
                                {isOwner ? (
                                    <TD className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditing(u)
                                                    setDialogOpen(true)
                                                }}
                                                className="rounded p-1.5 text-text-primary/70 hover:bg-text-primary/5 hover:text-text-primary"
                                                aria-label={`Editar ${u.name}`}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            {u.active ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirm(u)}
                                                    className="rounded p-1.5 text-danger/80 hover:bg-danger/10"
                                                    aria-label={`Desativar ${u.name}`}
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
                <UnitDialog open={dialogOpen} onClose={() => setDialogOpen(false)} unit={editing} />
            ) : null}

            <ConfirmDialog
                open={!!confirm}
                onClose={() => setConfirm(null)}
                onConfirm={onConfirm}
                title="Desativar unidade"
                message={confirm ? `Confirma desativar ${confirm.name}?` : ""}
                confirmLabel="Desativar"
                loading={deactivate.isPending}
            />
        </div>
    )
}
```

- [ ] **Step 3: Manual verification**

1. As OWNER, visit `/unidades` → vê unidade seedada (`V4__insert_default_unit.sql` cria a "Centro").
2. Cria nova: `Tatuapé / Av. Brasil, 4500` → toast, aparece na tabela.
3. Edita → muda endereço → salva.
4. Desativa → confirm → vira "Inativa". Botão Power some.
5. Edita unidade inativa → marca "Ativa" → reativa.
6. Login como EMPLOYEE → `/unidades` mostra a tabela mas sem coluna "Ações", sem botão "Nova unidade", sem ações por linha.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/\(protected\)/unidades/
git commit -m "feat(frontend): /unidades CRUD with read-for-all and write-for-owner"
```

---

## Task 24: End-to-end smoke test

**Files:** none

- [ ] **Step 1: Cold start**

1. Stop dev server. Clear browser localStorage for `localhost:3000`.
2. Start backend (`./mvnw spring-boot:run`) and frontend (`npm run dev`).

- [ ] **Step 2: Walk the happy path**

1. Visit `/` → redirect para `/auth`.
2. Login `admin@pizzaria.com / admin123` → `/home`.
3. Sidebar marca Dashboard. Avatar mostra "AD".
4. Clica avatar → "Meu perfil" → `/me` → vê dados.
5. Volta pro `/usuarios` → cria user EMPLOYEE.
6. Logout. Login como EMPLOYEE.
7. Sidebar não mostra "Usuários". Visita `/usuarios` direto → "Sem permissão".
8. Visita `/unidades` → tabela visível, sem botão "Nova" nem ações.
9. Logout. Login OWNER de novo.
10. Recarrega a página em `/usuarios` → continua autenticado (token persistido).

- [ ] **Step 3: Walk the refresh-on-401 path**

1. Logado como OWNER, abra DevTools → Application → Local Storage.
2. Edite `fv.access` colocando algo inválido (`xxx`).
3. Faça uma navegação (ex: `/unidades`).
4. Esperado: a request inicial retorna 401, o interceptor chama `/auth/refresh` com o `fv.refresh` válido, atualiza `fv.access`, retenta a request, sucesso. UI carrega sem prompt de login.
5. Agora apague também `fv.refresh` e force outra navegação que faça GET autenticado.
6. Esperado: redirect para `/auth?expired=1` com banner.

- [ ] **Step 4: Commit (only if any cleanup was needed)**

If everything works without code changes, no commit is needed for this task. If you fixed bugs along the way, commit them with descriptive messages.

---

## Self-review checklist (run before declaring done)

- [ ] All commits compile (`npm run build` succeeds at the tip).
- [ ] No `console.log` left in production code.
- [ ] No commented-out blocks.
- [ ] All `TODO`/`FIXME` are intentional and tracked.
- [ ] Manual verification steps in tasks 16, 17, 18, 21, 22, 23, 24 all pass.
- [ ] After logout, navigating to any `(protected)` route redirects to `/auth`.
- [ ] EMPLOYEE cannot see "Usuários" item in sidebar; visiting `/usuarios` shows NoAccess.
- [ ] EMPLOYEE on `/unidades` sees the table read-only.
- [ ] Toast appears on every successful mutation; toast appears on backend errors.
- [ ] Browser console has no React warnings during the happy path.
