import { screen, waitFor } from "@testing-library/react"
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

    it("shows empty state text in popover content", async () => {
        withItems(0, [])
        renderWithProviders(<NotificationsBell />)
        await waitFor(() =>
            expect(screen.queryByText(/Carregando/)).not.toBeInTheDocument(),
        )
        await waitFor(() => expect(screen.getByLabelText("Notificações")).toBeInTheDocument())
    })

    it("renders 'Ver todos' link pointing to /notifications", async () => {
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
    })
})