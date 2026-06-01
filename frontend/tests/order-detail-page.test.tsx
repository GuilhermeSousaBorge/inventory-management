import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/orders/o1",
  useParams: () => ({ id: "11111111-1111-1111-1111-111111111111" }),
}));

import OrderDetailPage from "@/app/(protected)/orders/[id]/page";
import { tokenStorage } from "@/lib/api";
import {
  getCalls,
  renderWithProviders,
  resetMockApi,
  setHandler,
} from "./helpers";

const ORDER = "11111111-1111-1111-1111-111111111111";

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

function detail(status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELED") {
  return {
    id: ORDER,
    unitId: "u-x",
    unitName: "Centro",
    status,
    totalPrice: 91.8,
    notes: null,
    createdById: "u1",
    startedAt: status === "PENDING" ? null : "2026-05-06T12:30:00Z",
    completedAt: status === "COMPLETED" ? "2026-05-06T13:00:00Z" : null,
    canceledAt: status === "CANCELED" ? "2026-05-06T12:35:00Z" : null,
    createdAt: "2026-05-06T12:00:00Z",
    items: [
      {
        id: "i1",
        productId: "p1",
        productName: "Margherita G",
        quantity: 2,
        unitPrice: 45.9,
        subtotal: 91.8,
      },
    ],
  };
}

function buildHandler(
  role: "OWNER" | "EMPLOYEE",
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELED",
) {
  return (cfg: { url?: string; method?: string }) => {
    const url = cfg.url ?? "";
    const method = (cfg.method ?? "get").toLowerCase();
    if (url.endsWith("/users/me")) return meHandler(role);
    if (url.includes(`/orders/${ORDER}/start`) && method === "post") {
      return { status: 200, data: { data: detail("IN_PROGRESS") } };
    }
    if (url.includes(`/orders/${ORDER}/complete`) && method === "post") {
      return { status: 200, data: { data: detail("COMPLETED") } };
    }
    if (url.includes(`/orders/${ORDER}/cancel`) && method === "post") {
      return { status: 200, data: { data: detail("CANCELED") } };
    }
    if (url.includes(`/orders/${ORDER}`)) {
      return { status: 200, data: { data: detail(status) } };
    }
    return { status: 500 };
  };
}

beforeEach(() => {
  resetMockApi();
});

describe("OrderDetailPage", () => {
  it("PENDING + OWNER shows Editar/Iniciar/Cancelar", async () => {
    tokenStorage.setAccess("a1");
    setHandler(buildHandler("OWNER", "PENDING"));
    renderWithProviders(<OrderDetailPage />);
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /Pedido #11111111/i }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: /^editar$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^iniciar$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^cancelar$/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^concluir$/i }),
    ).not.toBeInTheDocument();
  });

  it("IN_PROGRESS + OWNER shows only Concluir", async () => {
    tokenStorage.setAccess("a1");
    setHandler(buildHandler("OWNER", "IN_PROGRESS"));
    renderWithProviders(<OrderDetailPage />);
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /Pedido #11111111/i }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: /^concluir$/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^iniciar$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^editar$/i }),
    ).not.toBeInTheDocument();
  });

  it("COMPLETED shows no actions", async () => {
    tokenStorage.setAccess("a1");
    setHandler(buildHandler("OWNER", "COMPLETED"));
    renderWithProviders(<OrderDetailPage />);
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /Pedido #11111111/i }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: /^iniciar$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^concluir$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^cancelar$/i }),
    ).not.toBeInTheDocument();
  });

  it("EMPLOYEE never sees mutating actions", async () => {
    tokenStorage.setAccess("a1");
    setHandler(buildHandler("EMPLOYEE", "PENDING"));
    renderWithProviders(<OrderDetailPage />);
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /Pedido #11111111/i }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: /^iniciar$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^concluir$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^cancelar$/i }),
    ).not.toBeInTheDocument();
  });

  it("clicking Iniciar opens dialog and triggers POST /start on confirm", async () => {
    tokenStorage.setAccess("a1");
    setHandler(buildHandler("OWNER", "PENDING"));
    renderWithProviders(<OrderDetailPage />);
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /Pedido #11111111/i }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /^iniciar$/i }));
    await waitFor(() =>
      expect(
        screen.getByText(/serão descontados do estoque/i),
      ).toBeInTheDocument(),
    );

    // The dialog has its own Iniciar button — click the last "Iniciar" button (in the dialog)
    const iniciarButtons = screen.getAllByRole("button", {
      name: /^iniciar$/i,
    });
    fireEvent.click(iniciarButtons[iniciarButtons.length - 1]);

    await waitFor(() => {
      const post = getCalls().find(
        (c) =>
          (c.method ?? "").toLowerCase() === "post" &&
          (c.url ?? "").includes(`/orders/${ORDER}/start`),
      );
      expect(post).toBeTruthy();
    });
  });
});
