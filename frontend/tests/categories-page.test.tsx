import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/categories",
}));

import CategoriesPage from "@/app/(protected)/categories/page";
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

describe("CategoriesPage", () => {
  it("EMPLOYEE sees rows but no create button", async () => {
    tokenStorage.setAccess("a1");
    setHandler((cfg) => {
      const url = cfg.url ?? "";
      if (url.endsWith("/users/me")) return meHandler("EMPLOYEE");
      if (url.includes("/categories") && cfg.method === "get") {
        return {
          status: 200,
          data: {
            data: [
              {
                id: "c1",
                name: "Massas",
                description: null,
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
    renderWithProviders(<CategoriesPage />);
    await waitFor(() => expect(screen.getByText("Massas")).toBeInTheDocument());
    expect(
      screen.queryByRole("button", { name: /nova categoria/i }),
    ).not.toBeInTheDocument();
  });

  it("OWNER with empty list sees empty state and create CTA", async () => {
    tokenStorage.setAccess("a1");
    setHandler((cfg) => {
      const url = cfg.url ?? "";
      if (url.endsWith("/users/me")) return meHandler("OWNER");
      if (url.includes("/categories") && cfg.method === "get") {
        return { status: 200, data: { data: [], page: 0, size: 20, total: 0 } };
      }
      return { status: 500 };
    });
    renderWithProviders(<CategoriesPage />);
    await waitFor(() =>
      expect(
        screen.getByText(/nenhuma categoria cadastrada/i),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: /criar primeira categoria/i }),
    ).toBeInTheDocument();
  });

  it("OWNER with rows sees create button", async () => {
    tokenStorage.setAccess("a1");
    setHandler((cfg) => {
      const url = cfg.url ?? "";
      if (url.endsWith("/users/me")) return meHandler("OWNER");
      if (url.includes("/categories") && cfg.method === "get") {
        return {
          status: 200,
          data: {
            data: [
              {
                id: "c1",
                name: "Massas",
                description: "Farinhas",
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
    renderWithProviders(<CategoriesPage />);
    await waitFor(() => expect(screen.getByText("Massas")).toBeInTheDocument());
    expect(
      screen.getByRole("button", { name: /nova categoria/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Farinhas")).toBeInTheDocument();
  });
});
