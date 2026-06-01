import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/products/nova",
}));

import { ProductForm } from "@/app/(protected)/products/product-form";
import { tokenStorage } from "@/lib/api";
import {
  getCalls,
  renderWithProviders,
  resetMockApi,
  setHandler,
} from "./helpers";

beforeEach(() => {
  resetMockApi();
  replaceMock.mockReset();
});

const ING_1 = "11111111-1111-1111-1111-111111111111";
const ING_2 = "22222222-2222-2222-2222-222222222222";
const CAT_1 = "33333333-3333-3333-3333-333333333333";

function meHandler() {
  return {
    status: 200,
    data: {
      data: {
        id: "u1",
        name: "Ana",
        email: "a@x.com",
        role: "OWNER",
        active: true,
        createdAt: "2026-01-01T00:00:00Z",
      },
    },
  };
}

function selectsHandler(cfg: { url?: string; method?: string }) {
  const url = cfg.url ?? "";
  if (url.endsWith("/users/me")) return meHandler();
  if (url.includes("/ingredients")) {
    return {
      status: 200,
      data: {
        data: [
          {
            id: ING_1,
            name: "Mussarela",
            description: null,
            categoryId: "c1",
            unitOfMeasure: "kg",
            minimumQty: 5,
            averageCost: 30,
            expiryDate: null,
            defaultSupplierId: null,
            active: true,
            createdAt: "2026-01-01T00:00:00Z",
          },
          {
            id: ING_2,
            name: "Manjericão",
            description: null,
            categoryId: "c1",
            unitOfMeasure: "g",
            minimumQty: 1,
            averageCost: 5,
            expiryDate: null,
            defaultSupplierId: null,
            active: true,
            createdAt: "2026-01-01T00:00:00Z",
          },
        ],
        page: 0,
        size: 1000,
        total: 2,
      },
    };
  }
  if (url.includes("/categories")) {
    return {
      status: 200,
      data: {
        data: [
          {
            id: CAT_1,
            name: "Pizzas",
            description: null,
            createdAt: "2026-01-01T00:00:00Z",
          },
        ],
        page: 0,
        size: 1000,
        total: 1,
      },
    };
  }
  return null;
}

async function pickFirstIngredient(row: HTMLElement) {
  const user = userEvent.setup();
  const trigger = within(row).getByRole("combobox", { name: /ingrediente/i });
  await user.click(trigger);
  await waitFor(() => {
    const content = document.body.querySelector('[data-slot="select-content"]');
    expect(content).toBeInTheDocument();
  });
  const items = document.body.querySelectorAll('[data-slot="select-item"]');
  expect(items.length).toBeGreaterThan(0);
  await user.click(items[0]);
}

describe("ProductForm (create)", () => {
  it("renders, fills in fields, submits valid product", async () => {
    tokenStorage.setAccess("a1");
    setHandler((cfg) => {
      const r = selectsHandler(cfg);
      if (r) return r;
      const url = cfg.url ?? "";
      if (url.endsWith("/products") && cfg.method === "post") {
        return { status: 201, data: { data: { id: "p1" } } };
      }
      return { status: 500 };
    });

    renderWithProviders(<ProductForm mode="create" />);

    await waitFor(() =>
      expect(screen.getByText("Mussarela")).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText(/nome/i), {
      target: { value: "Margherita" },
    });
    fireEvent.change(screen.getByLabelText(/preço/i), {
      target: { value: "45.9" },
    });

    const ingredientsBlock = screen.getByTestId("prod-ingredients");
    const firstRow = within(ingredientsBlock).getAllByTestId(
      "prod-ingredient-row",
    )[0];

    await pickFirstIngredient(firstRow);

    await waitFor(() =>
      expect(
        (within(firstRow).getByTestId("prod-unidade-value") as HTMLInputElement)
          .value,
      ).toBe("kg"),
    );

    fireEvent.change(within(firstRow).getByLabelText(/quantidade/i), {
      target: { value: "0.3" },
    });

    fireEvent.click(screen.getByRole("button", { name: /salvar/i }));

    await waitFor(() => {
      const post = getCalls().find(
        (c) => c.method === "post" && c.url?.endsWith("/products"),
      );
      expect(post).toBeTruthy();
    });
  });

  it("rejects duplicated ingredients", async () => {
    tokenStorage.setAccess("a1");
    setHandler((cfg) => {
      const r = selectsHandler(cfg);
      if (r) return r;
      return { status: 500 };
    });

    renderWithProviders(<ProductForm mode="create" />);
    await waitFor(() =>
      expect(screen.getByText("Mussarela")).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText(/nome/i), {
      target: { value: "Margherita" },
    });
    fireEvent.change(screen.getByLabelText(/preço/i), {
      target: { value: "45.9" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: /adicionar ingrediente/i }),
    );

    const ingredientsBlock = screen.getByTestId("prod-ingredients");
    const rows = within(ingredientsBlock).getAllByTestId("prod-ingredient-row");
    expect(rows).toHaveLength(2);

    await pickFirstIngredient(rows[0]);
    fireEvent.change(within(rows[0]).getByLabelText(/quantidade/i), {
      target: { value: "0.3" },
    });
    await pickFirstIngredient(rows[1]);

    fireEvent.click(screen.getByRole("button", { name: /salvar/i }));

    await waitFor(() => {
      expect(screen.getByText(/duplicad/i)).toBeInTheDocument();
    });
    const post = getCalls().find(
      (c) => c.method === "post" && c.url?.endsWith("/products"),
    );
    expect(post).toBeFalsy();
  });

  it("disables remove button when only one row", async () => {
    tokenStorage.setAccess("a1");
    setHandler((cfg) => {
      const r = selectsHandler(cfg);
      if (r) return r;
      return { status: 500 };
    });

    renderWithProviders(<ProductForm mode="create" />);
    await waitFor(() =>
      expect(screen.getByText("Mussarela")).toBeInTheDocument(),
    );

    const ingredientsBlock = screen.getByTestId("prod-ingredients");
    const removeBtn = within(ingredientsBlock).queryByRole("button", {
      name: /remover item da ficha/i,
    });
    expect(removeBtn).toBeDisabled();
  });

  it("redirects to detail page after successful create", async () => {
    tokenStorage.setAccess("a1");
    setHandler((cfg) => {
      const r = selectsHandler(cfg);
      if (r) return r;
      const url = cfg.url ?? "";
      if (url.endsWith("/products") && cfg.method === "post") {
        return { status: 201, data: { data: { id: "p-created-123" } } };
      }
      return { status: 500 };
    });

    renderWithProviders(<ProductForm mode="create" />);
    await waitFor(() =>
      expect(screen.getByText("Mussarela")).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText(/nome/i), {
      target: { value: "Margherita" },
    });
    fireEvent.change(screen.getByLabelText(/preço/i), {
      target: { value: "45.9" },
    });

    const ingredientsBlock = screen.getByTestId("prod-ingredients");
    const firstRow = within(ingredientsBlock).getAllByTestId(
      "prod-ingredient-row",
    )[0];
    await pickFirstIngredient(firstRow);
    fireEvent.change(within(firstRow).getByLabelText(/quantidade/i), {
      target: { value: "0.3" },
    });

    fireEvent.click(screen.getByRole("button", { name: /salvar/i }));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/products/p-created-123");
    });
  });
});

describe("ProductForm (edit)", () => {
  const initial = {
    id: "p-existing-id",
    name: "Calabresa",
    size: "M" as const,
    categoryId: CAT_1,
    categoryName: "Pizzas",
    price: 39.9,
    description: "com cebola",
    active: true,
    createdAt: "2026-04-01T00:00:00Z",
    ingredients: [
      {
        id: "pi1",
        ingredientId: ING_1,
        ingredientName: "Mussarela",
        quantity: 0.25,
        unitOfMeasure: "kg",
      },
      {
        id: "pi2",
        ingredientId: ING_2,
        ingredientName: "Manjericão",
        quantity: 5,
        unitOfMeasure: "g",
      },
    ],
  };

  it("pre-populates fields from initial", async () => {
    tokenStorage.setAccess("a1");
    setHandler((cfg) => {
      const r = selectsHandler(cfg);
      if (r) return r;
      return { status: 500 };
    });

    renderWithProviders(<ProductForm mode="edit" initial={initial} />);

    await waitFor(() =>
      expect((screen.getByLabelText(/nome/i) as HTMLInputElement).value).toBe(
        "Calabresa",
      ),
    );
    const sizeTrigger = screen.getByRole("combobox", { name: /tamanho/i });
    expect(sizeTrigger).toBeInTheDocument();
    expect((screen.getByLabelText(/preço/i) as HTMLInputElement).value).toBe(
      "39.9",
    );

    const ingredientsBlock = screen.getByTestId("prod-ingredients");
    const rows = within(ingredientsBlock).getAllByTestId("prod-ingredient-row");
    expect(rows).toHaveLength(2);
  });

  it("submits as PUT and redirects to detail on edit", async () => {
    tokenStorage.setAccess("a1");
    setHandler((cfg) => {
      const r = selectsHandler(cfg);
      if (r) return r;
      const url = cfg.url ?? "";
      if (url.endsWith(`/products/${initial.id}`) && cfg.method === "put") {
        return { status: 200, data: { data: { id: initial.id } } };
      }
      return { status: 500 };
    });

    renderWithProviders(<ProductForm mode="edit" initial={initial} />);

    await waitFor(() =>
      expect((screen.getByLabelText(/nome/i) as HTMLInputElement).value).toBe(
        "Calabresa",
      ),
    );

    fireEvent.change(screen.getByLabelText(/nome/i), {
      target: { value: "Calabresa Especial" },
    });

    fireEvent.click(screen.getByRole("button", { name: /salvar/i }));

    await waitFor(() => {
      const put = getCalls().find(
        (c) =>
          (c.method ?? "").toLowerCase() === "put" &&
          (c.url ?? "").endsWith(`/products/${initial.id}`),
      );
      expect(put).toBeTruthy();
      expect(replaceMock).toHaveBeenCalledWith(`/products/${initial.id}`);
    });
  });
});
