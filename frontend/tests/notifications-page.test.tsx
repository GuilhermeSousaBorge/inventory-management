import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import NotificationsPage from "@/app/(protected)/notifications/page";

import { renderWithProviders, resetMockApi, setHandler } from "./helpers";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/notifications",
  useParams: () => ({}),
}));

beforeEach(() => resetMockApi());
afterEach(() => resetMockApi());

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
};

describe("/notifications", () => {
  it("renders rows with extracted unit of measure", async () => {
    setHandler((cfg) => {
      if (cfg.url === "/notifications") {
        return {
          status: 200,
          data: { data: [sample], page: 0, size: 20, total: 1 },
        };
      }
      return { status: 200, data: { data: [], page: 0, size: 1000, total: 0 } };
    });
    renderWithProviders(<NotificationsPage />);
    await waitFor(() =>
      expect(screen.getByText("Mozzarella")).toBeInTheDocument(),
    );
    expect(screen.getByText("0.5 / 1 kg")).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "Ativo" })).toBeInTheDocument();
  });

  it("shows empty state when no rows", async () => {
    setHandler(() => ({
      status: 200,
      data: { data: [], page: 0, size: 20, total: 0 },
    }));
    renderWithProviders(<NotificationsPage />);
    await waitFor(() =>
      expect(screen.getByText("Nenhum alerta no período.")).toBeInTheDocument(),
    );
  });

  it("requests with status=ACTIVE by default", async () => {
    const calls: { params?: Record<string, unknown> }[] = [];
    setHandler((cfg) => {
      calls.push({ params: cfg.params as Record<string, unknown> });
      return {
        status: 200,
        data: { data: [], page: 0, size: 20, total: 0 },
      };
    });
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    const notifCall = calls.find((c) => c.params && "status" in c.params);
    expect(notifCall?.params?.status).toBe("ACTIVE");
  });
});
