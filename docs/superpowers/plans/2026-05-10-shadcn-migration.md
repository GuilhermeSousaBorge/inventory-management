# shadcn/ui Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all custom UI primitives in `frontend/components/ui/` and `frontend/components/overlays/` with shadcn/ui equivalents, preserving the current visual identity (cream/navy/green palette).

**Architecture:** Big-bang refactor in a single branch (`refactor/shadcn-migration`), 11 small auto-contained commits. Old design tokens stay as aliases until commit 10 to keep non-migrated pages rendering. Forms adopt the full shadcn `Form` + `FormField` idiom integrated with `react-hook-form`. Dialogs use Radix (`Dialog`, `AlertDialog`); selects use Radix Select.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, TypeScript, react-hook-form, zod, sonner, lucide-react, Radix UI (via shadcn).

**Reference spec:** [docs/superpowers/specs/2026-05-10-shadcn-migration-design.md](../specs/2026-05-10-shadcn-migration-design.md)

---

## File Structure

**Created by `shadcn init` and `shadcn add`:**

- `frontend/components.json` — shadcn config
- `frontend/lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)
- `frontend/components/ui/button.tsx` — overwrites existing
- `frontend/components/ui/input.tsx` — overwrites existing
- `frontend/components/ui/select.tsx` — overwrites existing (Radix)
- `frontend/components/ui/badge.tsx` — overwrites existing
- `frontend/components/ui/table.tsx` — overwrites existing
- `frontend/components/ui/label.tsx` — new
- `frontend/components/ui/form.tsx` — new
- `frontend/components/ui/dialog.tsx` — new
- `frontend/components/ui/alert-dialog.tsx` — new
- `frontend/components/ui/dropdown-menu.tsx` — new
- `frontend/components/ui/card.tsx` — new
- `frontend/components/ui/sonner.tsx` — new (Toaster wrapper)

**Deleted:**

- `frontend/components/ui/field.tsx`
- `frontend/components/overlays/modal.tsx`
- `frontend/components/overlays/confirm-dialog.tsx`
- `frontend/components/overlays/` (directory becomes empty)

**Modified (high-touch):**

- `frontend/app/globals.css` — token mapping
- `frontend/app/layout.tsx` — wire Toaster wrapper
- `frontend/app/providers.tsx` — remove sonner Toaster (moves to wrapper)
- `frontend/app/(protected)/layout.tsx` — header DropdownMenu
- `frontend/components/notifications/notifications-bell.tsx` — DropdownMenu
- `frontend/components/reports/kpi-card.tsx` — uses shadcn Card
- `frontend/components/reports/export-csv-button.tsx` — uses new Button

**Modified (mechanical — pages):** see Task 3, 4, 5, 6 for the full list.

---

## Task 1: Init shadcn + tokens

**Files:**
- Create: `frontend/components.json`, `frontend/lib/utils.ts`
- Modify: `frontend/app/globals.css`, `frontend/package.json`

- [ ] **Step 1: Run `shadcn init`**

```bash
cd frontend
npx shadcn@latest init --yes --base-color neutral --css-variables --force
```

Expected: creates `components.json`, `lib/utils.ts`, installs `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`. May rewrite `globals.css` — we override it in step 3.

- [ ] **Step 2: Verify `components.json`**

Open `frontend/components.json` and confirm:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

If any field differs, edit to match.

- [ ] **Step 3: Replace `frontend/app/globals.css`**

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  /* shadcn tokens (canonical) */
  --background: #f5f5db;
  --foreground: #2b3d50;
  --card: #ffffff;
  --card-foreground: #2b3d50;
  --popover: #ffffff;
  --popover-foreground: #2b3d50;
  --primary: #28af60;
  --primary-foreground: #ffffff;
  --secondary: #c1ff80;
  --secondary-foreground: #2b3d50;
  --muted: rgb(43 61 80 / 0.04);
  --muted-foreground: rgb(43 61 80 / 0.65);
  --accent: rgb(43 61 80 / 0.06);
  --accent-foreground: #2b3d50;
  --destructive: #bf3a2b;
  --destructive-foreground: #ffffff;
  --border: rgb(43 61 80 / 0.3);
  --input: rgb(43 61 80 / 0.3);
  --ring: #28af60;
  --radius: 0.625rem;

  /* legacy aliases — remove in Task 10 once migration is complete */
  --color-bg: var(--background);
  --color-text-primary: var(--foreground);
  --color-text-secondary: rgb(43 61 80 / 0.65);
  --color-primary: var(--primary);
  --color-secondary: var(--secondary);
  --color-danger: var(--destructive);
  --color-border: var(--border);
  --color-icon: rgb(43 61 80 / 0.5);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  /* legacy aliases (kept so old class names still work during migration) */
  --color-bg: var(--background);
  --color-text-primary: var(--foreground);
  --color-text-secondary: rgb(43 61 80 / 0.65);
  --color-danger: var(--destructive);
  --color-icon: rgb(43 61 80 / 0.5);

  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}
```

- [ ] **Step 4: Verify `lib/utils.ts` exists and exports `cn`**

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

If `shadcn init` didn't write it, create it manually.

- [ ] **Step 5: Run build to verify setup**

```bash
cd frontend
npm run build
```

Expected: build succeeds. Warning about unused legacy tokens is fine. If the build fails on Tailwind import errors, check that `@import "tailwindcss"` is first in `globals.css`.

- [ ] **Step 6: Commit**

```bash
git add frontend/components.json frontend/lib/utils.ts frontend/app/globals.css frontend/package.json frontend/package-lock.json
git commit -m "chore(frontend): init shadcn + map palette to shadcn tokens"
```

---

## Task 2: Add shadcn primitives and delete old custom components

**Files:**
- Create (via `shadcn add`): `frontend/components/ui/{button,input,label,select,badge,table,form,dialog,alert-dialog,dropdown-menu,card,sonner}.tsx`
- Delete: `frontend/components/ui/field.tsx`, `frontend/components/overlays/modal.tsx`, `frontend/components/overlays/confirm-dialog.tsx`, `frontend/components/overlays/` (directory)
- Modify: `frontend/components/ui/badge.tsx` (add `warning` variant)

- [ ] **Step 1: Remove old custom UI files first (so `shadcn add` writes fresh)**

```bash
cd frontend
git rm components/ui/button.tsx components/ui/input.tsx components/ui/select.tsx components/ui/badge.tsx components/ui/table.tsx components/ui/field.tsx
git rm components/overlays/modal.tsx components/overlays/confirm-dialog.tsx
rmdir components/overlays
```

- [ ] **Step 2: Add shadcn primitives**

```bash
cd frontend
npx shadcn@latest add button input label select badge table form dialog alert-dialog dropdown-menu card sonner --yes
```

Expected: creates all 12 files in `components/ui/`. Installs `@radix-ui/*` and `react-hook-form` peer deps (RHF already installed; no-op).

- [ ] **Step 3: Add `warning` variant to `badge.tsx`**

Open `frontend/components/ui/badge.tsx`. Find the `badgeVariants = cva(...)` call and add `warning` to the variant map. The file currently looks like:

```typescript
const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium ...",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground ...",
        secondary: "border-transparent bg-secondary text-secondary-foreground ...",
        destructive: "border-transparent bg-destructive text-white ...",
        outline: "text-foreground ...",
      },
    },
    defaultVariants: { variant: "default" },
  },
)
```

Add `warning` after `outline`:

```typescript
        outline: "text-foreground ...",
        warning: "border-transparent bg-secondary/60 text-foreground",
```

(The `bg-secondary/60` reuses the existing light-green secondary; that's the "warning" yellow-green tone the old palette used.)

- [ ] **Step 4: Run build (expect errors — they're our migration TODO list)**

```bash
cd frontend
npm run build 2>&1 | tee build-errors.log
```

Expected: many type errors complaining about `variant="primary"`, `variant="danger"`, missing `Field`, missing `Modal`, missing `ConfirmDialog`, etc. **Don't fix yet.** Save the log for reference. Delete it after step 5.

```bash
rm frontend/build-errors.log
```

- [ ] **Step 5: Commit**

```bash
git add frontend/components/ui frontend/package.json frontend/package-lock.json
git commit -m "feat(frontend): add shadcn primitives, delete custom ui/field + overlays"
```

---

## Task 3: Migrate pages using only Button/Input/Badge/Table

This task does a mechanical rename across pages that don't have Select, Modal, ConfirmDialog, or Field. Forms come later (Task 5); selects come later (Task 4).

**Rename rules:**

| Old | New |
|---|---|
| `Button variant="primary"` | `Button variant="default"` (or just remove the prop — `default` is the default) |
| `Button variant="danger"` | `Button variant="destructive"` |
| `Button variant="secondary"` | `Button variant="secondary"` (unchanged) |
| `Button variant="ghost"` | `Button variant="ghost"` (unchanged) |
| `Button size="md"` | remove prop (`default` is the default) |
| `Button size="sm"` | `Button size="sm"` (unchanged) |
| `Badge variant="neutral"` | `Badge variant="outline"` |
| `Badge variant="success"` | `Badge variant="default"` |
| `Badge variant="danger"` | `Badge variant="destructive"` |
| `Badge variant="warning"` | `Badge variant="warning"` (unchanged — added in Task 2) |
| `import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table"` | `import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"` |
| `<THead>` | `<TableHeader>` |
| `<TBody>` | `<TableBody>` |
| `<TR>` | `<TableRow>` |
| `<TH>` | `<TableHead>` |
| `<TD>` | `<TableCell>` |

**Note on Table wrapper:** the old `Table` rendered `<div class="overflow-hidden rounded-xl border border-border/40 bg-white"><table>...`. shadcn's `Table` renders a `<div class="relative w-full overflow-auto"><table>...`. Visual result is similar; do not add extra wrappers.

**Files (pages where ONLY Button/Input/Badge/Table need updating — no Select, no Modal, no Field):**

- `frontend/app/(protected)/audit-logs/page.tsx`
- `frontend/app/(protected)/audit-logs/[id]/page.tsx`
- `frontend/app/(protected)/home/page.tsx`
- `frontend/app/(protected)/me/page.tsx` (also has Field — skip this file in Task 3, handle in Task 5)
- `frontend/app/(protected)/notifications/page.tsx`
- `frontend/app/(protected)/notifications/[id]/page.tsx`
- `frontend/app/(protected)/stock/page.tsx`
- `frontend/app/(protected)/reports/page.tsx`
- `frontend/app/(protected)/reports/consumption/page.tsx`
- `frontend/app/(protected)/reports/sales/page.tsx`
- `frontend/app/(protected)/reports/stock-status/page.tsx`
- `frontend/app/(protected)/reports/waste/page.tsx`
- `frontend/app/(protected)/orders/page.tsx` (also has Select/Field — skip Select/Field bits, handle in Tasks 4/5)
- `frontend/app/(protected)/purchase-orders/page.tsx` (same caveat)

**Pattern check before touching each file:**

For each file, before editing run:

```bash
grep -nE 'variant="(primary|danger|neutral|success)"|size="md"|<(THead|TBody|TR|TH|TD)\b|from "@/components/ui/table"' <file>
```

This catches all rename sites.

- [ ] **Step 1: Migrate `audit-logs/page.tsx`**

Open `frontend/app/(protected)/audit-logs/page.tsx`. Apply the rename rules above (Button variants, Badge variants, Table imports/components). Use editor multi-cursor or sed; the changes are mechanical.

Verify the import line changes from:
```typescript
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table"
```
to:
```typescript
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
```

- [ ] **Step 2: Migrate `audit-logs/[id]/page.tsx`** — same rules.

- [ ] **Step 3: Migrate `home/page.tsx`** — same rules.

- [ ] **Step 4: Migrate `notifications/page.tsx` and `notifications/[id]/page.tsx`** — same rules.

- [ ] **Step 5: Migrate `stock/page.tsx`** — same rules.

- [ ] **Step 6: Migrate `reports/page.tsx`, `reports/consumption/page.tsx`, `reports/sales/page.tsx`, `reports/stock-status/page.tsx`, `reports/waste/page.tsx`** — same rules.

- [ ] **Step 7: Migrate `orders/page.tsx` and `purchase-orders/page.tsx` — ONLY the Button/Badge/Table parts**

These pages also use `Select` and `Field` for filters. Leave the Select/Field code alone for now — Task 4 handles Select, Task 5 handles Field. After this step they'll still have unresolved imports for `Field` and `Select` — that's expected.

- [ ] **Step 8: Run `npm run lint` after each batch and `npm run build`**

```bash
cd frontend
npm run lint
npm run build
```

Lint should be clean. Build will still fail on pages that use `Select`, `Field`, `Modal`, `ConfirmDialog` — that's expected. As long as the pages migrated in Task 3 don't produce new errors, proceed.

- [ ] **Step 9: Commit**

```bash
git add frontend/app
git commit -m "refactor(frontend): rename Button/Badge/Table variants to shadcn equivalents"
```

---

## Task 4: Migrate native `<Select>` to Radix Select

The old `Select` was a styled `<select>` with `<option>` children. shadcn's `Select` is Radix: `<Select><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem/></SelectContent></Select>`. It is controlled (`value` + `onValueChange`); it does not accept `register()` from RHF directly — use `<Controller>` or `field.onChange`.

**Reference snippet — non-form (filter) usage:**

Old:
```tsx
<Select id="filter-category" value={categoryParam} onChange={(e) => setFilter("category", e.target.value)}>
  <option value="">Todas</option>
  {categories.data?.map((c) => (
    <option key={c.id} value={c.id}>{c.name}</option>
  ))}
</Select>
```

New:
```tsx
<Select value={categoryParam || "__all"} onValueChange={(v) => setFilter("category", v === "__all" ? "" : v)}>
  <SelectTrigger id="filter-category" className="w-[180px]">
    <SelectValue placeholder="Categoria" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="__all">Todas</SelectItem>
    {categories.data?.map((c) => (
      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

**Important:** Radix `SelectItem` cannot have `value=""`. Use a sentinel like `__all` and translate at the boundary (URL, RHF). Document this pattern in a comment the first time it appears.

**Reference snippet — RHF usage (form with Controller):**

Old:
```tsx
<Select id="ingredient-category" {...form.register("categoryId")}>
  <option value="">Selecione...</option>
  {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
</Select>
```

New (uses `<Controller>`; full Form integration arrives in Task 5):
```tsx
import { Controller } from "react-hook-form"

<Controller
  control={form.control}
  name="categoryId"
  render={({ field }) => (
    <Select value={field.value || ""} onValueChange={field.onChange}>
      <SelectTrigger id="ingredient-category">
        <SelectValue placeholder="Selecione..." />
      </SelectTrigger>
      <SelectContent>
        {categories.data?.map((c) => (
          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )}
/>
```

**Files with `<Select>`:**

- `frontend/app/(protected)/products/page.tsx` (3 filters)
- `frontend/app/(protected)/orders/page.tsx` (status filter; verify by grep)
- `frontend/app/(protected)/purchase-orders/page.tsx` (status filter)
- `frontend/app/(protected)/ingredients/page.tsx` (category filter)
- `frontend/app/(protected)/ingredients/ingredient-form.tsx` (3 selects)
- `frontend/app/(protected)/orders/order-form.tsx`
- `frontend/app/(protected)/products/product-form.tsx`
- `frontend/app/(protected)/purchase-orders/purchase-order-form.tsx`
- `frontend/app/(protected)/stock-movements/page.tsx`
- `frontend/app/(protected)/stock-movements/adjustment-dialog.tsx`
- `frontend/app/(protected)/users/user-dialog.tsx`
- Any other file matching: `grep -rl 'from "@/components/ui/select"' frontend/app frontend/components`

- [ ] **Step 1: Verify the full file list**

```bash
cd frontend
grep -rl 'from "@/components/ui/select"' app components
```

Update the list above if grep finds more. Proceed only when grep matches what's expected.

- [ ] **Step 2: Migrate page-level filters (non-form Selects)**

For each of `products/page.tsx`, `orders/page.tsx`, `purchase-orders/page.tsx`, `ingredients/page.tsx`, `stock-movements/page.tsx`:

1. Update the import:
   ```typescript
   import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
   ```
2. Rewrite each `<Select>...</Select>` block using the **non-form** pattern above.
3. For the "all/empty" sentinel, use `"__all"` and translate at the URL boundary.

- [ ] **Step 3: Migrate form Selects (RHF) using `Controller`**

For each of `ingredient-form.tsx`, `order-form.tsx`, `product-form.tsx`, `purchase-order-form.tsx`, `adjustment-dialog.tsx`, `user-dialog.tsx`:

1. Add `import { Controller } from "react-hook-form"` if not present.
2. Replace each `<Select {...form.register("x")}>` with the **Controller** pattern shown above.
3. Default values: if the schema allows empty string, use `value={field.value || ""}` and a non-empty sentinel for the placeholder option. If the field is required, no sentinel needed; render placeholder via `<SelectValue placeholder="Selecione..." />`.

- [ ] **Step 4: Run lint and build**

```bash
cd frontend
npm run lint
npm run build
```

Lint must pass. Build will still fail on Modal/ConfirmDialog/Field — that's expected. Verify no NEW Select-related errors.

- [ ] **Step 5: Smoke test in dev**

```bash
cd frontend
npm run dev
```

Open http://localhost:3000/products, http://localhost:3000/ingredients. Verify filter dropdowns open, show options, and applying a filter updates the URL/list. Stop dev server.

- [ ] **Step 6: Commit**

```bash
git add frontend/app
git commit -m "refactor(frontend): migrate native selects to Radix Select with Controller for RHF"
```

---

## Task 5: Migrate forms to shadcn Form + FormField

shadcn's `Form` is a thin wrapper around `react-hook-form`'s `FormProvider`. Each field uses `FormField` (renders via `Controller` under the hood) → `FormItem` → `FormLabel` / `FormControl` / `FormMessage`.

**Reference snippet — single text field:**

Old (using `Field`):
```tsx
<Field label="Nome" htmlFor="category-name" error={form.formState.errors.name?.message}>
  <Input id="category-name" {...form.register("name")} />
</Field>
```

New (shadcn Form):
```tsx
<FormField
  control={form.control}
  name="name"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Nome</FormLabel>
      <FormControl>
        <Input {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Reference snippet — full form wrapper:**

Old:
```tsx
<form id="category-form" className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
  <Field ...>...</Field>
</form>
```

New:
```tsx
<Form {...form}>
  <form id="category-form" className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
    <FormField ... />
  </form>
</Form>
```

**Reference snippet — Select inside Form (replaces Controller from Task 4):**

```tsx
<FormField
  control={form.control}
  name="categoryId"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Categoria</FormLabel>
      <Select onValueChange={field.onChange} value={field.value || ""} disabled={categories.isPending}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder={categories.isPending ? "Carregando..." : "Selecione..."} />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          {categories.data?.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

Note: `FormControl` wraps the trigger, not the whole Select. This is what shadcn's docs recommend.

**Files (every form using `Field` or `<form onSubmit>`):**

- `frontend/app/(public)/auth/page.tsx`
- `frontend/app/(protected)/me/page.tsx` (if it has a form — verify)
- `frontend/app/(protected)/categories/category-dialog.tsx`
- `frontend/app/(protected)/units/unit-dialog.tsx`
- `frontend/app/(protected)/suppliers/supplier-dialog.tsx`
- `frontend/app/(protected)/users/user-dialog.tsx`
- `frontend/app/(protected)/ingredients/ingredient-form.tsx`
- `frontend/app/(protected)/products/product-form.tsx`
- `frontend/app/(protected)/orders/order-form.tsx`
- `frontend/app/(protected)/purchase-orders/purchase-order-form.tsx`
- `frontend/app/(protected)/stock-movements/adjustment-dialog.tsx`

- [ ] **Step 1: Verify the full file list**

```bash
cd frontend
grep -rl 'from "@/components/ui/field"' app components
```

The list above should match. Adjust if grep differs.

- [ ] **Step 2: Migrate `auth/page.tsx` as the reference form**

Pick the simplest form first to establish the pattern, then replicate. `auth/page.tsx` is the smallest. Steps:

1. Update imports:
   ```typescript
   import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
   ```
   Remove `import { Field } from "@/components/ui/field"`.

2. Wrap the `<form>` with `<Form {...form}>`.

3. For each field, replace `<Field><Input/></Field>` with the `FormField` + `FormItem` + `FormControl` pattern.

4. Remove `htmlFor`/`id` props on Input — `FormField` wires `htmlFor` automatically.

5. Remove `form.formState.errors.x?.message` references — `<FormMessage />` reads from RHF context.

- [ ] **Step 3: Migrate `category-dialog.tsx` (simple — 2 fields, no Select)**

Same pattern. Verify the modal still opens (Modal is still the old custom one until Task 6 — that's fine).

- [ ] **Step 4: Migrate `unit-dialog.tsx`, `supplier-dialog.tsx`** — same pattern.

- [ ] **Step 5: Migrate `user-dialog.tsx`** — includes a Select (role). Use the Select-in-FormField pattern from above; remove the standalone `Controller` (you no longer need it because `FormField` is the Controller).

- [ ] **Step 6: Migrate `ingredient-form.tsx`, `product-form.tsx`, `order-form.tsx`, `purchase-order-form.tsx`, `adjustment-dialog.tsx`**

These are the largest forms. Apply the same patterns. Replace any `Controller` blocks from Task 4 with `FormField` (since `FormField` is itself a Controller).

For the `active` checkbox in `ingredient-form.tsx` (currently a plain `<input type="checkbox">`), wrap it in `FormField` + `FormItem` with `<FormControl><input type="checkbox" {...field} checked={!!field.value} /></FormControl>`. Or, if you prefer, do `shadcn add checkbox` later — out of scope for now; keep the native checkbox.

- [ ] **Step 7: Migrate `me/page.tsx`**

If it has a form, apply the same pattern. If it only displays user info, no change needed.

- [ ] **Step 8: Run lint and build**

```bash
cd frontend
npm run lint
npm run build
```

Lint clean. Build will still fail on Modal/ConfirmDialog imports — expected.

- [ ] **Step 9: Smoke test**

```bash
cd frontend
npm run dev
```

Open http://localhost:3000/auth and submit empty form — verify FormMessage shows zod errors. Open http://localhost:3000/ingredients/novo and submit — same check. Stop dev server.

- [ ] **Step 10: Commit**

```bash
git add frontend/app
git commit -m "refactor(frontend): migrate forms to shadcn Form + FormField idiom"
```

---

## Task 6: Modal → Dialog, ConfirmDialog → AlertDialog

**Reference snippet — Dialog (replaces Modal):**

Old:
```tsx
<Modal open={open} onClose={onClose} title="Editar" footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="x-form">Salvar</Button></>}>
  <form id="x-form" onSubmit={...}>...</form>
</Modal>
```

New:
```tsx
<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Editar</DialogTitle>
    </DialogHeader>
    <form id="x-form" onSubmit={...}>...</form>
    <DialogFooter>
      <Button variant="ghost" onClick={onClose}>Cancelar</Button>
      <Button type="submit" form="x-form">Salvar</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Imports:
```typescript
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
```

Note: `Dialog` uses `onOpenChange(open: boolean)`, not `onClose()`. Translate via `(o) => !o && onClose()`.

**Reference snippet — AlertDialog (replaces ConfirmDialog):**

Old:
```tsx
<ConfirmDialog
  open={!!confirmTarget}
  onClose={() => setConfirmTarget(null)}
  onConfirm={handleDeactivate}
  title="Desativar produto"
  message="Tem certeza?"
  confirmLabel="Desativar"
  loading={pending}
/>
```

New:
```tsx
<AlertDialog open={!!confirmTarget} onOpenChange={(o) => !o && setConfirmTarget(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Desativar produto</AlertDialogTitle>
      <AlertDialogDescription>Tem certeza?</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
      <AlertDialogAction onClick={handleDeactivate} disabled={pending} className="bg-destructive text-white hover:bg-destructive/90">
        {pending ? "Processando..." : "Desativar"}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

Imports:
```typescript
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
```

**Files using `Modal`:**

- `frontend/app/(protected)/categories/category-dialog.tsx`
- `frontend/app/(protected)/units/unit-dialog.tsx`
- `frontend/app/(protected)/suppliers/supplier-dialog.tsx`
- `frontend/app/(protected)/users/user-dialog.tsx`
- `frontend/app/(protected)/stock-movements/adjustment-dialog.tsx`

**Files using `ConfirmDialog`:**

- `frontend/app/(protected)/products/page.tsx`
- `frontend/app/(protected)/ingredients/page.tsx`
- `frontend/app/(protected)/categories/page.tsx`
- `frontend/app/(protected)/units/page.tsx`
- `frontend/app/(protected)/suppliers/page.tsx`
- `frontend/app/(protected)/users/page.tsx`
- Any other matching: `grep -rl 'from "@/components/overlays/confirm-dialog"' frontend/app frontend/components`

- [ ] **Step 1: Verify the file lists**

```bash
cd frontend
grep -rl 'from "@/components/overlays/modal"' app components
grep -rl 'from "@/components/overlays/confirm-dialog"' app components
```

Update the lists if grep finds more.

- [ ] **Step 2: Migrate `category-dialog.tsx` first**

Apply the Dialog pattern. Verify by reading through that:
- `<Modal>` block becomes `<Dialog open={open} onOpenChange={(o) => !o && onClose()}><DialogContent>...`
- Title moves into `<DialogHeader><DialogTitle>`
- Footer Buttons move into `<DialogFooter>`
- The form keeps its `id="category-form"` so the submit button outside still triggers it.

- [ ] **Step 3: Migrate `unit-dialog.tsx`, `supplier-dialog.tsx`, `user-dialog.tsx`, `adjustment-dialog.tsx`** — same pattern.

- [ ] **Step 4: Migrate ConfirmDialog usages**

For each page, replace the `<ConfirmDialog ... />` block with the `<AlertDialog>` pattern shown above. The `confirmTarget`/`setConfirmTarget` state stays the same.

For pages using `confirmVariant="primary"` (non-destructive confirm), drop the `className="bg-destructive..."` line on `AlertDialogAction` — it inherits the default Button style.

- [ ] **Step 5: Run lint and build**

```bash
cd frontend
npm run lint
npm run build
```

Build should now pass (modulo any leftover `Modal`/`ConfirmDialog` imports — grep again to catch).

```bash
cd frontend
grep -rn 'from "@/components/overlays' app components
```

Expected: zero results.

- [ ] **Step 6: Smoke test**

```bash
cd frontend
npm run dev
```

Open http://localhost:3000/categories, click "Nova categoria" → dialog opens, escape closes it, submit works. Open http://localhost:3000/products, click delete on an item → AlertDialog opens, "Cancelar" closes, "Desativar" calls the mutation. Stop dev server.

- [ ] **Step 7: Commit**

```bash
git add frontend/app
git commit -m "refactor(frontend): replace custom Modal/ConfirmDialog with Radix Dialog/AlertDialog"
```

---

## Task 7: DropdownMenu in header + NotificationsBell

**Files:**
- Modify: `frontend/app/(protected)/layout.tsx`, `frontend/components/notifications/notifications-bell.tsx`

**Reference snippet — DropdownMenu (replaces custom click-outside menu):**

```tsx
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white" aria-label={user.name}>
      {initials(user.name)}
    </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-48">
    <DropdownMenuLabel>
      <p className="truncate text-sm font-medium">{user.name}</p>
      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
    </DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem asChild>
      <Link href="/me"><UserIcon className="h-4 w-4" /> Meu perfil</Link>
    </DropdownMenuItem>
    <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
      <LogOut className="h-4 w-4" /> Sair
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

- [ ] **Step 1: Refactor user menu in `(protected)/layout.tsx`**

Open `frontend/app/(protected)/layout.tsx`:

1. Add the `DropdownMenu*` imports.
2. Delete `menuOpen`, `setMenuOpen`, `menuRef`, the `useEffect` block that handles click-outside (lines 101-116 in the original).
3. Replace the inline `<div ref={menuRef} className="relative">...</div>` block (around lines 208-239) with the DropdownMenu pattern above.

- [ ] **Step 2: Refactor `notifications-bell.tsx` to use DropdownMenu**

Open `frontend/components/notifications/notifications-bell.tsx`. Read the existing implementation to understand the popover structure, then rewrite using `DropdownMenu` + `DropdownMenuContent` + `DropdownMenuItem`. Drop any click-outside `useEffect` and `ref`-based logic.

Keep:
- The bell icon button as `DropdownMenuTrigger asChild`
- The unread count badge
- The list of recent notifications inside `DropdownMenuContent` (use `DropdownMenuItem asChild` with `<Link>` for each)
- The "Ver todas" link at the bottom

- [ ] **Step 3: Run lint and build**

```bash
cd frontend
npm run lint
npm run build
```

Both clean.

- [ ] **Step 4: Smoke test**

```bash
cd frontend
npm run dev
```

Open any protected page. Click the user avatar → menu opens, click outside closes, "Sair" works. Click the bell → notifications dropdown opens, click a notification → navigates. Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/(protected)/layout.tsx frontend/components/notifications/notifications-bell.tsx
git commit -m "refactor(frontend): use DropdownMenu for header user menu and notifications bell"
```

---

## Task 8: KpiCard uses Card internally

**Files:**
- Modify: `frontend/components/reports/kpi-card.tsx`

- [ ] **Step 1: Read the current KpiCard**

```bash
cat frontend/components/reports/kpi-card.tsx
```

(Use Read tool.) Capture the current API (props) — we keep it identical so callers don't change.

- [ ] **Step 2: Rewrite KpiCard using Card primitives**

Replace the body of `kpi-card.tsx` so the same JSX wraps `<Card><CardHeader><CardTitle/></CardHeader><CardContent/></Card>` instead of plain divs. Keep all props (`label`, `value`, `hint`, etc.) unchanged. Example shape:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Props = { label: string; value: string | number; hint?: string }

export function KpiCard({ label, value, hint }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}
```

If the current props differ, preserve the current signature.

- [ ] **Step 3: Run lint and build**

```bash
cd frontend
npm run lint
npm run build
```

- [ ] **Step 4: Smoke test reports**

```bash
cd frontend
npm run dev
```

Open http://localhost:3000/reports, /reports/sales, /reports/stock-status — KPI cards render with the same content. Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/reports/kpi-card.tsx
git commit -m "refactor(frontend): KpiCard composes shadcn Card primitives"
```

---

## Task 9: Sonner Toaster via shadcn wrapper

**Files:**
- Modify: `frontend/app/layout.tsx`, `frontend/app/providers.tsx`

The shadcn `sonner` component is a thin wrapper that wires Sonner's `Toaster` with theme-aware defaults. Currently the Toaster is in `providers.tsx` directly. Move it to the wrapper for consistency.

- [ ] **Step 1: Verify `components/ui/sonner.tsx` exists**

It was created in Task 2 by `shadcn add sonner`. Open and confirm it exports `Toaster`. The default content looks like:

```tsx
"use client"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner className="toaster group" toastOptions={{...}} {...props} />
)
export { Toaster }
```

- [ ] **Step 2: Remove direct Sonner import from `providers.tsx`**

Open `frontend/app/providers.tsx`. Remove these:
```typescript
import { Toaster } from "sonner"
```
and
```tsx
<Toaster richColors position="top-right" />
```

- [ ] **Step 3: Add Toaster wrapper to `app/layout.tsx`**

Open `frontend/app/layout.tsx`. Add the import and render Toaster at the end of `<body>`:

```tsx
import { Toaster } from "@/components/ui/sonner"

// in the JSX, inside <body>:
<Providers>{children}</Providers>
<Toaster richColors position="top-right" />
```

- [ ] **Step 4: Run lint and build**

```bash
cd frontend
npm run lint
npm run build
```

- [ ] **Step 5: Smoke test**

```bash
cd frontend
npm run dev
```

Trigger any action that calls `toast.success` (e.g., create a category). Verify the toast appears in the top-right. Stop dev server.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/layout.tsx frontend/app/providers.tsx
git commit -m "refactor(frontend): wire Sonner Toaster via shadcn wrapper in root layout"
```

---

## Task 10: Remove legacy tokens from globals.css

**Files:**
- Modify: `frontend/app/globals.css`

- [ ] **Step 1: Verify zero usages of legacy classes and CSS variables**

```bash
cd frontend
grep -rnE 'text-text-primary|text-text-secondary|bg-bg|bg-text-primary|text-danger|bg-danger|border-border|--color-bg|--color-text-primary|--color-text-secondary|--color-primary|--color-secondary|--color-danger|--color-border|--color-icon' app components
```

**Expected: zero matches.** If matches remain, this is a migration gap — go fix the file before continuing. Common gotchas:

- Tailwind classes built from old tokens (`text-text-primary`) → replace with shadcn equivalents (`text-foreground`, `text-muted-foreground` for secondary, `text-destructive`, `bg-destructive`, `border-border`).
- Mapping cheat sheet:
  - `bg-bg` → `bg-background`
  - `text-text-primary` → `text-foreground`
  - `text-text-secondary` → `text-muted-foreground`
  - `bg-text-primary` (used for active sidebar) → `bg-foreground`
  - `text-danger` / `bg-danger` → `text-destructive` / `bg-destructive`
  - `border-border` → `border-border` (unchanged — both old and new use this name)
  - `--color-icon` (used inline as `text-text-primary/50`) → `text-foreground/50`

- [ ] **Step 2: Remove the legacy aliases from `globals.css`**

Open `frontend/app/globals.css`. Delete these lines (added in Task 1 step 3):

From `:root`:
```css
  /* legacy aliases — remove in Task 10 once migration is complete */
  --color-bg: var(--background);
  --color-text-primary: var(--foreground);
  --color-text-secondary: rgb(43 61 80 / 0.65);
  --color-primary: var(--primary);
  --color-secondary: var(--secondary);
  --color-danger: var(--destructive);
  --color-border: var(--border);
  --color-icon: rgb(43 61 80 / 0.5);
```

From `@theme inline`:
```css
  /* legacy aliases (kept so old class names still work during migration) */
  --color-bg: var(--background);
  --color-text-primary: var(--foreground);
  --color-text-secondary: rgb(43 61 80 / 0.65);
  --color-danger: var(--destructive);
  --color-icon: rgb(43 61 80 / 0.5);
```

- [ ] **Step 3: Run lint and build**

```bash
cd frontend
npm run lint
npm run build
```

Both must pass. If build fails because something still uses old tokens, go back to step 1 and find the holdout.

- [ ] **Step 4: Full smoke test**

```bash
cd frontend
npm run dev
```

Open and visually inspect: `/auth`, `/home`, `/products`, `/orders/novo`, `/reports/sales`. Compare with screenshots/memory of the original — paleta deve estar idêntica (creme, navy, verde, coral). Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/globals.css frontend/app frontend/components
git commit -m "chore(frontend): remove legacy palette tokens from globals.css"
```

---

## Task 11: Fix broken tests

**Files:**
- Modify: tests in `frontend/tests/` that depend on the old `<select>`, `Modal`, or other replaced structures

Most schemas / hooks tests are unaffected. The breakers are page/form tests that interact with:
- Native `<option>` (becomes `<SelectItem>` accessible as `role="option"` only when the popover is open)
- Modal close button by `aria-label="Fechar"` (Radix Dialog uses different a11y)
- ConfirmDialog buttons by text (still text-based, but inside `<AlertDialog>` portal)

**Reference patterns:**

Selecting an option in Radix Select:
```typescript
// old: await user.selectOptions(screen.getByLabelText("Categoria"), "id-123")
const trigger = screen.getByLabelText("Categoria")
await user.click(trigger)
const option = await screen.findByRole("option", { name: "Bebidas" })
await user.click(option)
```

Closing a Dialog (Radix dispatches Escape or click on overlay):
```typescript
// old: await user.click(screen.getByLabelText("Fechar"))
await user.keyboard("{Escape}")
// or, if there's an explicit close: await user.click(screen.getByRole("button", { name: /cancelar/i }))
```

Confirming an AlertDialog:
```typescript
// old: await user.click(screen.getByRole("button", { name: /desativar/i }))
// new: same — the action button is still a <button>
await user.click(screen.getByRole("button", { name: /desativar/i }))
```

- [ ] **Step 1: Run the test suite to see what breaks**

```bash
cd frontend
npm run test 2>&1 | tee test-failures.log
```

Note the failing files. Common suspects: `products-page.test.tsx`, `ingredients-page.test.tsx`, `categories-page.test.tsx`, `units-page.test.tsx`, `suppliers-page.test.tsx`, `users-page.test.tsx`, `order-form.test.tsx`, `product-form.test.tsx`, `purchase-order-form.test.tsx`, `auth-page.test.tsx`.

- [ ] **Step 2: Fix each failing test**

For each failing test file:

1. Read the test and identify which assertion broke.
2. If the test selects an `<option>`, rewrite using the Radix Select pattern above.
3. If the test closes a Modal by close-button label, rewrite using keyboard escape or the Cancel button.
4. If the test asserts on `form.formState.errors`, prefer asserting on `FormMessage` text via `findByText`.
5. If the test selects by CSS class (e.g., `.text-text-primary`), update to the new class (`.text-foreground`).

Work file-by-file, running just that file to verify:

```bash
cd frontend
npx vitest run tests/products-page.test.tsx
```

- [ ] **Step 3: Run the full suite green**

```bash
cd frontend
npm run test
```

Expected: all tests pass. Delete `test-failures.log` if you created it.

```bash
rm -f frontend/test-failures.log
```

- [ ] **Step 4: Final verification**

```bash
cd frontend
npm run lint
npm run build
npm run test
```

All three must be green.

- [ ] **Step 5: Smoke test the 5 reference pages once more**

```bash
cd frontend
npm run dev
```

Visit and click around:
1. `/auth` — login form, FormMessage on empty submit
2. `/home` — KPIs and layout
3. `/products` — list, filters, delete confirm
4. `/orders/novo` — full form with Select
5. `/reports/sales` — KPIs and table

Stop dev server.

- [ ] **Step 6: Commit**

```bash
git add frontend/tests
git commit -m "test(frontend): adjust suite for Radix Select/Dialog and shadcn Form structure"
```

---

## Final: open PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin refactor/shadcn-migration
```

- [ ] **Step 2: Open PR via `gh`**

```bash
gh pr create --title "refactor(frontend): migrate to shadcn/ui" --body "$(cat <<'EOF'
## Summary

- Replaces all custom UI primitives (button, input, select, badge, field, table, modal, confirm-dialog) with shadcn/ui equivalents.
- Adopts full shadcn idioms: Radix Dialog/AlertDialog, Radix Select, shadcn Form integrated with react-hook-form, DropdownMenu in header.
- Preserves the current visual identity (cream/navy/green/coral palette) by mapping it to shadcn tokens.
- Light mode only (no dark mode).

## Test plan
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] `npm run test` passes
- [ ] Manual smoke test: /auth, /home, /products, /orders/novo, /reports/sales
- [ ] Visual parity with main branch confirmed on the 5 pages above

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review notes

- **Spec coverage:** Every section of the spec (paleta, escopo, profundidade, dark mode = off, testes = ajustar conforme quebrar, ordem de 11 commits, DoD) has corresponding tasks (1-11) and verification steps.
- **Type/name consistency:** Throughout the plan, `TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell` are used consistently (matches shadcn's exports). `FormField`/`FormItem`/`FormControl`/`FormMessage` consistent. `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogFooter` consistent. `AlertDialog*` consistent.
- **Risk noted in Task 4:** Radix `SelectItem` cannot have empty-string value — explicit `__all` sentinel pattern documented.
- **Risk noted in Task 10:** Mapping cheat sheet for old → new class names so engineer can find holdouts.
- **Verification at every commit:** lint + build at minimum; smoke test for visual-impact commits.
