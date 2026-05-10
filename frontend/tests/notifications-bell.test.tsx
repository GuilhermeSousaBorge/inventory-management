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