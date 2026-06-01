import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AuditLogDetailPage from "@/app/(protected)/audit-logs/[id]/page";
import { tokenStorage } from "@/lib/api";

import { renderWithProviders, resetMockApi, setHandler } from "./helpers";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/audit-logs/a-1",
  useParams: () => ({ id: "a-1" }),
}));

function meHandler(role: "OWNER" | "EMPLOYEE") {
  return {
    status: 200,
    data: {
      data: {
        id: "u-1",
        name: "Test",
        email: "t@t.com",
        role,
        active: true,
        createdAt: "2026-01-01T00:00:00Z",
      },
    },
  };
}

beforeEach(() => resetMockApi());
afterEach(() => resetMockApi());

describe("/audit-logs/[id]", () => {
  it("EMPLOYEE sees NoAccess", async () => {
    tokenStorage.setAccess("a1");
    setHandler((cfg) => {
      const url = cfg.url ?? "";
      if (url.endsWith("/users/me")) return meHandler("EMPLOYEE");
      return { status: 200, data: { data: null } };
    });
    renderWithProviders(<AuditLogDetailPage />);
    await waitFor(() =>
      expect(screen.getByText("Sem permissão")).toBeInTheDocument(),
    );
  });

  it("OWNER sees diff for before/after", async () => {
    tokenStorage.setAccess("a1");
    setHandler((cfg) => {
      const url = cfg.url ?? "";
      if (url.endsWith("/users/me")) return meHandler("OWNER");
      return {
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
      };
    });
    renderWithProviders(<AuditLogDetailPage />);
    await waitFor(() => expect(screen.getByText("Antes")).toBeInTheDocument());
    expect(screen.getByText("Depois")).toBeInTheDocument();
    // both sides render price key
    const priceCells = screen.getAllByText("price");
    expect(priceCells.length).toBe(2);
  });

  it("OWNER sees JSON pretty when no before/after", async () => {
    tokenStorage.setAccess("a1");
    setHandler((cfg) => {
      const url = cfg.url ?? "";
      if (url.endsWith("/users/me")) return meHandler("OWNER");
      return {
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
      };
    });
    renderWithProviders(<AuditLogDetailPage />);
    await waitFor(() =>
      expect(screen.getByText(/quantity/)).toBeInTheDocument(),
    );
    expect(screen.queryByText("Antes")).not.toBeInTheDocument();
  });

  it("shows 'Sem detalhes' when details is null", async () => {
    tokenStorage.setAccess("a1");
    setHandler((cfg) => {
      const url = cfg.url ?? "";
      if (url.endsWith("/users/me")) return meHandler("OWNER");
      return {
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
      };
    });
    renderWithProviders(<AuditLogDetailPage />);
    await waitFor(() =>
      expect(screen.getByText("Sem detalhes adicionais.")).toBeInTheDocument(),
    );
  });
});
