import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/units",
}));

import UnitsPage from "@/app/(protected)/units/page";
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
        name: role === "OWNER" ? "Ana" : "Bruno",
        email: role === "OWNER" ? "ana@x.com" : "bruno@x.com",
        role,
        active: true,
        createdAt: "2026-01-01T00:00:00Z",
      },
    },
  };
}

const unitsList = {
  data: [
    {
      id: "un1",
      name: "Centro",
      address: "R. das Flores, 123",
      active: true,
      createdAt: "2026-01-01T00:00:00Z",
    },
    {
      id: "un2",
      name: "Tatuapé",
      address: null,
      active: false,
      createdAt: "2026-02-01T00:00:00Z",
    },
  ],
  page: 0,
  size: 20,
  total: 2,
};

describe("UnitsPage", () => {
  it("OWNER sees 'Nova unidade' and Ações column with rows", async () => {
    tokenStorage.setAccess("a1");
    setHandler((cfg) => {
      const url = cfg.url ?? "";
      if (url.endsWith("/users/me")) return meHandler("OWNER");
      if (url.includes("/units") && cfg.method === "get") {
        return { status: 200, data: unitsList };
      }
      return { status: 500 };
    });
    renderWithProviders(<UnitsPage />);
    await waitFor(() => expect(screen.getByText("Centro")).toBeInTheDocument());
    expect(screen.getByText("Tatuapé")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /nova unidade/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /ações/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/editar centro/i)).toBeInTheDocument();
  });

  it("EMPLOYEE sees the table read-only — no 'Nova unidade', no Ações", async () => {
    tokenStorage.setAccess("a1");
    setHandler((cfg) => {
      const url = cfg.url ?? "";
      if (url.endsWith("/users/me")) return meHandler("EMPLOYEE");
      if (url.includes("/units") && cfg.method === "get") {
        return { status: 200, data: unitsList };
      }
      return { status: 500 };
    });
    renderWithProviders(<UnitsPage />);
    await waitFor(() => expect(screen.getByText("Centro")).toBeInTheDocument());
    expect(
      screen.queryByRole("button", { name: /nova unidade/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: /ações/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/editar centro/i)).not.toBeInTheDocument();
  });

  it("renders '—' for null address", async () => {
    tokenStorage.setAccess("a1");
    setHandler((cfg) => {
      const url = cfg.url ?? "";
      if (url.endsWith("/users/me")) return meHandler("OWNER");
      if (url.includes("/units") && cfg.method === "get") {
        return { status: 200, data: unitsList };
      }
      return { status: 500 };
    });
    renderWithProviders(<UnitsPage />);
    await waitFor(() =>
      expect(screen.getByText("Tatuapé")).toBeInTheDocument(),
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
