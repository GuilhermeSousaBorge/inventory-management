import { screen, waitFor } from "@testing-library/react"
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

function detailHandler(active: boolean) {
    return {
        status: 200,
        data: {
            data: {
                id: PROD,
                name: "Margherita",
                size: "G",
                categoryId: null,
                categoryName: null,
                price: 45.9,
                description: "Molho de tomate",
                active,
                createdAt: "2026-05-06T12:00:00Z",
                ingredients: [
                    {
                        id: "i1",
                        ingredientId: "ing1",
                        ingredientName: "Mussarela",
                        quantity: 0.3,
                        unitOfMeasure: "kg",
                    },
                ],
            },
        },
    }
}

beforeEach(() => {
    resetMockApi()
})

describe("ProductDetailPage", () => {
    it("OWNER on active product sees Edit and Desativar actions", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("OWNER")
            if (url.includes(`/products/${PROD}`)) return detailHandler(true)
            return { status: 500 }
        })
        renderWithProviders(<ProductDetailPage />)
        await waitFor(() =>
            expect(screen.getByRole("heading", { name: /Margherita G/i })).toBeInTheDocument()
        )
        expect(screen.getByText("Mussarela")).toBeInTheDocument()
        expect(screen.getByRole("link", { name: /^editar$/i })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /^desativar$/i })).toBeInTheDocument()
    })

    it("EMPLOYEE sees no actions", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("EMPLOYEE")
            if (url.includes(`/products/${PROD}`)) return detailHandler(true)
            return { status: 500 }
        })
        renderWithProviders(<ProductDetailPage />)
        await waitFor(() =>
            expect(screen.getByRole("heading", { name: /Margherita G/i })).toBeInTheDocument()
        )
        expect(screen.queryByRole("link", { name: /^editar$/i })).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /^desativar$/i })).not.toBeInTheDocument()
    })

    it("OWNER on inactive product hides actions", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("OWNER")
            if (url.includes(`/products/${PROD}`)) return detailHandler(false)
            return { status: 500 }
        })
        renderWithProviders(<ProductDetailPage />)
        await waitFor(() =>
            expect(screen.getByRole("heading", { name: /Margherita G/i })).toBeInTheDocument()
        )
        expect(screen.getByText(/Inativo/i)).toBeInTheDocument()
        expect(screen.queryByRole("link", { name: /^editar$/i })).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /^desativar$/i })).not.toBeInTheDocument()
    })
})
