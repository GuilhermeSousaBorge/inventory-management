import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/suppliers",
}));

import SuppliersPage from "@/app/(protected)/suppliers/page";
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
        createdAt: "2026-01-01T00:00:00Z",
      },
    },
  };
}

describe("SuppliersPage", () => {
  it("EMPLOYEE sees rows but no create button", async () => {
    tokenStorage.setAccess("a1");
    setHandler((cfg) => {
      const url = cfg.url ?? "";
      if (url.endsWith("/users/me")) return meHandler("EMPLOYEE");
      if (url.includes("/suppliers") && cfg.method === "get") {
        return {
          status: 200,
          data: {
            data: [
              {
                id: "s1",
                name: "Distribuidora ABC",
                contactName: "João",
                phone: "(11) 9 9999-9999",
                email: null,
                address: null,
                active: true,
                createdAt: "2026-01-01T00:00:00Z",
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
    renderWithProviders(<SuppliersPage />);
    await waitFor(() =>
      expect(screen.getByText("Distribuidora ABC")).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: /novo fornecedor/i }),
    ).not.toBeInTheDocument();
  });

  it("OWNER with empty list sees empty state and create CTA", async () => {
    tokenStorage.setAccess("a1");
    setHandler((cfg) => {
      const url = cfg.url ?? "";
      if (url.endsWith("/users/me")) return meHandler("OWNER");
      if (url.includes("/suppliers") && cfg.method === "get") {
        return { status: 200, data: { data: [], page: 0, size: 20, total: 0 } };
      }
      return { status: 500 };
    });
    renderWithProviders(<SuppliersPage />);
    await waitFor(() =>
      expect(
        screen.getByText(/nenhum fornecedor cadastrado/i),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: /criar primeiro fornecedor/i }),
    ).toBeInTheDocument();
  });

  it("OWNER with rows sees create button and inactive badge", async () => {
    tokenStorage.setAccess("a1");
    setHandler((cfg) => {
      const url = cfg.url ?? "";
      if (url.endsWith("/users/me")) return meHandler("OWNER");
      if (url.includes("/suppliers") && cfg.method === "get") {
        return {
          status: 200,
          data: {
            data: [
              {
                id: "s1",
                name: "Distribuidora ABC",
                contactName: null,
                phone: null,
                email: null,
                address: null,
                active: true,
                createdAt: "2026-01-01T00:00:00Z",
              },
              {
                id: "s2",
                name: "Velha Distribuidora",
                contactName: null,
                phone: null,
                email: null,
                address: null,
                active: false,
                createdAt: "2026-01-01T00:00:00Z",
              },
            ],
            page: 0,
            size: 20,
            total: 2,
          },
        };
      }
      return { status: 500 };
    });
    renderWithProviders(<SuppliersPage />);
    await waitFor(() =>
      expect(screen.getByText("Distribuidora ABC")).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: /novo fornecedor/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Inativo")).toBeInTheDocument();
  });
});
