import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AuditLogsPage from "@/app/(protected)/audit-logs/page";
import { tokenStorage } from "@/lib/api";

import { renderWithProviders, resetMockApi, setHandler } from "./helpers";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/audit-logs",
  useParams: () => ({}),
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

describe("/audit-logs", () => {
  it("EMPLOYEE sees NoAccess", async () => {
    tokenStorage.setAccess("a1");
    setHandler((cfg) => {
      const url = cfg.url ?? "";
      if (url.endsWith("/users/me")) return meHandler("EMPLOYEE");
      return { status: 200, data: { data: [], page: 0, size: 1000, total: 0 } };
    });
    renderWithProviders(<AuditLogsPage />);
    await waitFor(() =>
      expect(screen.getByText("Sem permissão")).toBeInTheDocument(),
    );
  });

  it("OWNER sees rows with formatted action labels", async () => {
    tokenStorage.setAccess("a1");
    setHandler((cfg) => {
      const url = cfg.url ?? "";
      if (url.endsWith("/users/me")) return meHandler("OWNER");
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
        };
      }
      return { status: 200, data: { data: [], page: 0, size: 1000, total: 0 } };
    });
    renderWithProviders(<AuditLogsPage />);
    await waitFor(() =>
      expect(screen.getByText("guilherme")).toBeInTheDocument(),
    );
    const table = screen.getByRole("table");
    expect(
      within(table).getByText("Produto: preço alterado"),
    ).toBeInTheDocument();
    expect(screen.getByText("45,9 → 49,9")).toBeInTheDocument();
  });
});
