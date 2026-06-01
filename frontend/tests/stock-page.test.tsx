import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/stock",
}));

import StockPage from "@/app/(protected)/stock/page";
import { tokenStorage } from "@/lib/api";
import { renderWithProviders, resetMockApi, setHandler } from "./helpers";

beforeEach(() => {
  resetMockApi();
});

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
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    },
  };
}

describe("StockPage", () => {
  it("renders rows from /stock with belowMinimum badge", async () => {
    tokenStorage.setAccess("a1");
    setHandler((cfg) => {
      const url = cfg.url ?? "";
      if (url.endsWith("/users/me")) return meHandler("OWNER");
      if (url.includes("/units")) {
        return {
          status: 200,
          data: {
            data: [
              {
                id: "un1",
                name: "Centro",
                address: null,
                active: true,
                createdAt: "2026-01-01T00:00:00Z",
              },
            ],
            page: 0,
            size: 1000,
            total: 1,
          },
        };
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
        };
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
        };
      }
      return { status: 500 };
    });
    renderWithProviders(<StockPage />);
    await waitFor(() =>
      expect(
        screen.getByRole("cell", { name: "Mussarela" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole("cell", { name: /Abaixo/i })).toBeInTheDocument();
  });

  it("empty state when no rows", async () => {
    tokenStorage.setAccess("a1");
    setHandler((cfg) => {
      const url = cfg.url ?? "";
      if (url.endsWith("/users/me")) return meHandler("EMPLOYEE");
      if (url.includes("/units"))
        return {
          status: 200,
          data: { data: [], page: 0, size: 1000, total: 0 },
        };
      if (url.includes("/ingredients"))
        return {
          status: 200,
          data: { data: [], page: 0, size: 1000, total: 0 },
        };
      if (url.endsWith("/stock"))
        return { status: 200, data: { data: [], page: 0, size: 20, total: 0 } };
      return { status: 500 };
    });
    renderWithProviders(<StockPage />);
    await waitFor(() =>
      expect(screen.getByText(/nenhum saldo/i)).toBeInTheDocument(),
    );
  });
});
