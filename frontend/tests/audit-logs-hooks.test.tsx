import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  formatAuditAction,
  summarizeAuditDetails,
  useAuditLog,
  useAuditLogs,
} from "@/lib/audit-logs";

import { createWrapper, getCalls, resetMockApi, setHandler } from "./helpers";

let wrapper: ReturnType<typeof createWrapper>;

beforeEach(() => {
  resetMockApi();
  wrapper = createWrapper();
});
afterEach(() => resetMockApi());

describe("useAuditLogs", () => {
  it("sends all filter params when present", async () => {
    setHandler(() => ({
      status: 200,
      data: { data: [], page: 0, size: 20, total: 0 },
    }));
    renderHook(
      () =>
        useAuditLogs({
          entityType: "Product",
          entityId: "p-1",
          actorId: "u-1",
          action: "PRODUCT_PRICE_CHANGED",
          from: "2026-05-01",
          to: "2026-05-07",
        }),
      { wrapper },
    );
    await waitFor(() => expect(getCalls().length).toBeGreaterThan(0));
    const params = getCalls()[0]?.params as Record<string, unknown>;
    expect(params.entityType).toBe("Product");
    expect(params.action).toBe("PRODUCT_PRICE_CHANGED");
  });
});

describe("useAuditLog", () => {
  it("fetches single by id", async () => {
    setHandler(() => ({ status: 200, data: { data: { id: "a-1" } } }));
    const { result } = renderHook(() => useAuditLog("a-1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect((result.current.data as { id: string }).id).toBe("a-1");
  });
});

describe("formatAuditAction", () => {
  it("returns pt-BR labels", () => {
    expect(formatAuditAction("PRODUCT_PRICE_CHANGED")).toBe(
      "Produto: preço alterado",
    );
    expect(formatAuditAction("STOCK_ENTRY")).toBe("Estoque: entrada");
  });
});

describe("summarizeAuditDetails", () => {
  it("renders X → Y for PRODUCT_PRICE_CHANGED", () => {
    const out = summarizeAuditDetails("PRODUCT_PRICE_CHANGED", {
      before: { price: 45.9 },
      after: { price: 49.9 },
    });
    expect(out).toBe("45,9 → 49,9");
  });

  it("renders OWNER → EMPLOYEE for USER_ROLE_CHANGED", () => {
    const out = summarizeAuditDetails("USER_ROLE_CHANGED", {
      before: { role: "OWNER" },
      after: { role: "EMPLOYEE" },
    });
    expect(out).toBe("OWNER → EMPLOYEE");
  });

  it("returns — for null details", () => {
    expect(summarizeAuditDetails("PRODUCT_UPDATED", null)).toBe("—");
  });

  it("falls back to keys when no curated case matches", () => {
    const out = summarizeAuditDetails("PRODUCT_UPDATED", {
      name: "x",
      desc: "y",
    });
    expect(out).toContain("name");
  });
});
