import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/users",
}));

import UsersPage from "@/app/(protected)/users/page";
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
        name: role === "OWNER" ? "Ana Owner" : "Bruno Employee",
        email: role === "OWNER" ? "ana@x.com" : "bruno@x.com",
        role,
        active: true,
        createdAt: "2026-01-01T00:00:00Z",
      },
    },
  };
}

describe("UsersPage", () => {
  it("EMPLOYEE sees NoAccess", async () => {
    tokenStorage.setAccess("a1");
    setHandler(() => meHandler("EMPLOYEE"));
    renderWithProviders(<UsersPage />);
    await waitFor(() =>
      expect(screen.getByText(/sem permissão/i)).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: /novo usuário/i }),
    ).not.toBeInTheDocument();
  });

  it("OWNER with empty list sees empty state and create CTA", async () => {
    tokenStorage.setAccess("a1");
    setHandler((cfg) => {
      const url = cfg.url ?? "";
      if (url.endsWith("/users/me")) return meHandler("OWNER");
      if (url.includes("/users") && cfg.method === "get") {
        return { status: 200, data: { data: [], page: 0, size: 20, total: 0 } };
      }
      return { status: 500 };
    });
    renderWithProviders(<UsersPage />);
    await waitFor(() =>
      expect(
        screen.getByText(/nenhum usuário cadastrado/i),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: /criar primeiro usuário/i }),
    ).toBeInTheDocument();
  });

  it("OWNER with populated list sees rows and 'Novo usuário'", async () => {
    tokenStorage.setAccess("a1");
    setHandler((cfg) => {
      const url = cfg.url ?? "";
      if (url.endsWith("/users/me")) return meHandler("OWNER");
      if (url.includes("/users") && cfg.method === "get") {
        return {
          status: 200,
          data: {
            data: [
              {
                id: "u1",
                name: "Ana Owner",
                email: "ana@x.com",
                role: "OWNER",
                active: true,
                createdAt: "2026-01-01T00:00:00Z",
              },
              {
                id: "u2",
                name: "Bruno",
                email: "bruno@x.com",
                role: "EMPLOYEE",
                active: false,
                createdAt: "2026-02-01T00:00:00Z",
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
    renderWithProviders(<UsersPage />);
    await waitFor(() => expect(screen.getByText("Bruno")).toBeInTheDocument());
    expect(screen.getByText("Ana Owner")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /novo usuário/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Inativo")).toBeInTheDocument();
  });
});
