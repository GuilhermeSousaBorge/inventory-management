import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/purchase-orders",
}));

import PurchaseOrdersPage from "@/app/(protected)/purchase-orders/page";
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
        email: "a@x.com",
        role,
        active: true,
        createdAt: "2026-01-01T00:00:00Z",
      },
    },
  };
}

function listHandler(status: "PENDING" | "RECEIVED") {
  return {
    status: 200,
    data: {
      data: [
        {
          id: "po1abcdef0000000000000000000000",
          supplierId: "s1",
          supplierName: "Distribuidora ABC",
          unitId: "un1",
          unitName: "Centro",
          status,
          totalCost: 100,
          notes: null,
          expectedAt: "2026-12-31",
          receivedAt: null,
          canceledAt: null,
          createdById: "u1",
          createdByName: "Ana",
          createdAt: "2026-01-01T00:00:00Z",
          items: [],
        },
      ],
      page: 0,
      size: 20,
      total: 1,
    },
  };
}

describe("PurchaseOrdersPage", () => {
  it("OWNER on PENDING sees Edit action", async () => {
    tokenStorage.setAccess("a1");
    setHandler((cfg) => {
      const url = cfg.url ?? "";
      if (url.endsWith("/users/me")) return meHandler("OWNER");
      if (url.includes("/suppliers"))
        return {
          status: 200,
          data: { data: [], page: 0, size: 1000, total: 0 },
        };
      if (url.includes("/units"))
        return {
          status: 200,
          data: { data: [], page: 0, size: 1000, total: 0 },
        };
      if (url.includes("/purchase-orders") && cfg.method === "get")
        return listHandler("PENDING");
      return { status: 500 };
    });
    renderWithProviders(<PurchaseOrdersPage />);
    await waitFor(() =>
      expect(screen.getByText("Distribuidora ABC")).toBeInTheDocument(),
    );
    expect(screen.getByLabelText(/editar/i)).toBeInTheDocument();
  });

  it("EMPLOYEE on RECEIVED sees no actions", async () => {
    tokenStorage.setAccess("a1");
    setHandler((cfg) => {
      const url = cfg.url ?? "";
      if (url.endsWith("/users/me")) return meHandler("EMPLOYEE");
      if (url.includes("/suppliers"))
        return {
          status: 200,
          data: { data: [], page: 0, size: 1000, total: 0 },
        };
      if (url.includes("/units"))
        return {
          status: 200,
          data: { data: [], page: 0, size: 1000, total: 0 },
        };
      if (url.includes("/purchase-orders") && cfg.method === "get")
        return listHandler("RECEIVED");
      return { status: 500 };
    });
    renderWithProviders(<PurchaseOrdersPage />);
    await waitFor(() =>
      expect(screen.getByText("Distribuidora ABC")).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: /nova compra/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/editar/i)).not.toBeInTheDocument();
  });
});
