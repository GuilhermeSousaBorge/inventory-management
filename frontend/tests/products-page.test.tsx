import { screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/products",
}))

import ProductsPage from "@/app/(protected)/products/page"
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

function listHandler(active: boolean) {
    return {
        status: 200,
        data: {
            data: [
                {
                    id: "p1abcdef0000000000000000000000",
                    name: "Margherita",
                    size: "G",
                    categoryId: null,
                    categoryName: null,
                    price: 45.9,
                    description: null,
                    active,
                    createdAt: "2026-05-06T12:00:00Z",
                    ingredients: [],
                },
            ],
            page: 0,
            size: 20,
            total: 1,
        },
    }
}

describe("ProductsPage", () => {
    it("OWNER on active list sees Edit and Deactivate actions", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("OWNER")
            if (url.includes("/categories"))
                return { status: 200, data: { data: [], page: 0, size: 1000, total: 0 } }
            if (url.includes("/products") && cfg.method === "get") return listHandler(true)
            return { status: 500 }
        })
        renderWithProviders(<ProductsPage />)
        await waitFor(() => expect(screen.getByText("Margherita")).toBeInTheDocument())
        expect(screen.getByLabelText(/^editar margherita g$/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/^desativar margherita g$/i)).toBeInTheDocument()
        expect(screen.getByRole("link", { name: /novo produto/i })).toBeInTheDocument()
    })

    it("EMPLOYEE sees no mutating actions", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("EMPLOYEE")
            if (url.includes("/categories"))
                return { status: 200, data: { data: [], page: 0, size: 1000, total: 0 } }
            if (url.includes("/products") && cfg.method === "get") return listHandler(true)
            return { status: 500 }
        })
        renderWithProviders(<ProductsPage />)
        await waitFor(() => expect(screen.getByText("Margherita")).toBeInTheDocument())
        expect(screen.queryByRole("link", { name: /novo produto/i })).not.toBeInTheDocument()
        expect(screen.queryByLabelText(/^editar margherita g$/i)).not.toBeInTheDocument()
        expect(screen.queryByLabelText(/^desativar margherita g$/i)).not.toBeInTheDocument()
    })

    it("OWNER on inactive product hides Deactivate (already deactivated)", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("OWNER")
            if (url.includes("/categories"))
                return { status: 200, data: { data: [], page: 0, size: 1000, total: 0 } }
            if (url.includes("/products") && cfg.method === "get") return listHandler(false)
            return { status: 500 }
        })
        renderWithProviders(<ProductsPage />)
        await waitFor(() => expect(screen.getByText("Margherita")).toBeInTheDocument())
        expect(screen.getByLabelText(/^editar margherita g$/i)).toBeInTheDocument()
        expect(screen.queryByLabelText(/^desativar margherita g$/i)).not.toBeInTheDocument()
    })
})
