import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/auth",
}));

import AuthPage from "@/app/(public)/auth/page";
import { tokenStorage } from "@/lib/api";
import { renderWithProviders, resetMockApi, setHandler } from "./helpers";

beforeEach(() => {
  resetMockApi();
  mockReplace.mockClear();
});

describe("AuthPage", () => {
  it("renders the login form", async () => {
    renderWithProviders(<AuthPage />);
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /forno vivo/i }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /entrar/i })).toBeInTheDocument();
  });

  it("shows inline error message on 401", async () => {
    setHandler(() => ({ status: 401, data: undefined }));
    const user = userEvent.setup();
    renderWithProviders(<AuthPage />);

    await user.type(await screen.findByLabelText(/e-mail/i), "ana@x.com");
    await user.type(screen.getByLabelText(/senha/i), "wrong");
    await user.click(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/e-mail ou senha inválidos/i),
      ).toBeInTheDocument(),
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("redirects to /home on successful login", async () => {
    setHandler((cfg) => {
      const url = cfg.url ?? "";
      if (url.endsWith("/auth/login")) {
        return {
          status: 200,
          data: { data: { accessToken: "a1", refreshToken: "r1" } },
        };
      }
      if (url.endsWith("/users/me")) {
        return {
          status: 200,
          data: {
            data: {
              id: "u1",
              name: "Ana",
              email: "ana@x.com",
              role: "OWNER",
              active: true,
              createdAt: "2026-01-01T00:00:00Z",
            },
          },
        };
      }
      return { status: 500 };
    });

    const user = userEvent.setup();
    renderWithProviders(<AuthPage />);

    await user.type(await screen.findByLabelText(/e-mail/i), "ana@x.com");
    await user.type(screen.getByLabelText(/senha/i), "secret123");
    await user.click(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/home"));
    expect(tokenStorage.getAccess()).toBe("a1");
    expect(tokenStorage.getRefresh()).toBe("r1");
  });
});
