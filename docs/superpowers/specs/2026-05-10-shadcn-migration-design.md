# Migração do frontend para shadcn/ui

## Contexto

O frontend (`frontend/`) é um Next.js 16 + React 19 + Tailwind v4 + TypeScript, com componentes de UI custom em `components/ui/` (button, input, select, badge, field, table), overlays próprios (`modal`, `confirm-dialog`) e formulários baseados em `react-hook-form` + `zod`. A paleta é definida em [app/globals.css](../../../frontend/app/globals.css) com tokens próprios (`--color-bg`, `--color-text-primary`, `--color-primary`, `--color-secondary`, `--color-danger`, etc.).

Esta refatoração troca os componentes custom pelos primitivos do shadcn/ui em uma única branch (big-bang), preservando a identidade visual atual e adotando integralmente os idiomas do shadcn (Dialog/AlertDialog Radix, Form integrado com RHF, Select Radix).

## Decisões

- **Paleta**: manter as cores atuais (creme `#f5f5db`, navy `#2b3d50`, primary `#28af60`, secondary `#c1ff80`, danger `#bf3a2b`), mapeadas para os tokens canônicos do shadcn (`--background`, `--foreground`, `--primary`, `--secondary`, `--destructive`, etc.).
- **Escopo**: big-bang em uma única branch, com commits pequenos e auto-contidos.
- **Profundidade**: adoção completa dos idiomas shadcn — sem wrappers preservando APIs antigas.
- **Dark mode**: fora do escopo (YAGNI). Só light.
- **Testes**: ajustar conforme quebrarem; tolerar suite vermelha entre commits 3 e 10, exigir verde no commit final.

## Fundação (setup)

### Inicialização

Rodar `npx shadcn@latest init` em `frontend/`:

- Cria `components.json` com `style: new-york`, `cssVariables: true`, alias `@/components`, `@/lib`, `@/hooks`.
- Instala `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`.
- Cria helper `cn()` em [lib/utils.ts](../../../frontend/lib/utils.ts).

### Mapeamento de tokens (globals.css)

| Token shadcn | Cor atual |
|---|---|
| `--background` | `#f5f5db` |
| `--foreground` | `#2b3d50` |
| `--primary` / `--primary-foreground` | `#28af60` / `#ffffff` |
| `--secondary` / `--secondary-foreground` | `#c1ff80` / `#2b3d50` |
| `--destructive` / `--destructive-foreground` | `#bf3a2b` / `#ffffff` |
| `--muted` / `--muted-foreground` | `rgb(43 61 80 / 0.04)` / `rgb(43 61 80 / 0.65)` |
| `--accent` / `--accent-foreground` | `rgb(43 61 80 / 0.06)` / `#2b3d50` |
| `--border` | `rgb(43 61 80 / 0.3)` |
| `--input` | `rgb(43 61 80 / 0.3)` |
| `--ring` | `#28af60` |
| `--card` / `--card-foreground` | `#ffffff` / `#2b3d50` |
| `--popover` / `--popover-foreground` | `#ffffff` / `#2b3d50` |
| `--radius` | `0.625rem` |

### Compatibilidade durante a migração

Os tokens antigos (`--color-bg`, `--color-text-primary`, `--color-primary`, `--color-secondary`, `--color-danger`, `--color-border`, `--color-icon`, `--color-text-secondary`) permanecem em `globals.css` apontando para as novas variáveis até o commit final de cleanup. Isso permite que páginas ainda não migradas continuem renderizando.

### Dependências auto-instaladas pelo `shadcn add`

- `@radix-ui/react-dialog`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-select`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-label`, `@radix-ui/react-slot`
- `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`

## Mapeamento de componentes

Tudo em `components/ui/` é substituído pelos arquivos gerados pelo `shadcn add`. Os custom atuais são deletados (sem wrappers).

| Atual | Vira | Impacto |
|---|---|---|
| `ui/button.tsx` (variants `primary\|secondary\|danger\|ghost`, sizes `sm\|md`) | `ui/button.tsx` (shadcn: `default\|secondary\|destructive\|outline\|ghost\|link`, sizes `default\|sm\|lg\|icon`) | Rename de variants: `primary`→`default`, `danger`→`destructive`. `size="md"` vira `default`. |
| `ui/input.tsx` | `ui/input.tsx` (shadcn) | API quase idêntica. |
| `ui/select.tsx` (`<select>` nativo) | `ui/select.tsx` (Radix: `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`) | Quebra estrutural. Forms RHF passam a usar `<Controller>` ou `field.onChange`. |
| `ui/badge.tsx` (`neutral\|success\|danger\|warning`) | `ui/badge.tsx` (shadcn: `default\|secondary\|destructive\|outline`) + variant custom `warning` adicionada manualmente | `success`→`default`. `warning` adicionada em `badgeVariants`. |
| `ui/field.tsx` | Deletado. `ui/form.tsx` (shadcn: `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`) | Forms reescritos para `<Form {...form}>` com `FormField` por campo. |
| `ui/table.tsx` (`Table`, `THead`, `TBody`, `TR`, `TH`, `TD`) | `ui/table.tsx` (shadcn: `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`) | Rename direto. Estilo do wrapper (`overflow-hidden rounded-xl border`) move para a página ou container externo. |
| `overlays/modal.tsx` | Deletado. `ui/dialog.tsx` (shadcn/Radix) | Páginas reescrevem para `<Dialog open onOpenChange>` + `DialogContent`/`DialogHeader`/`DialogTitle`/`DialogFooter`. |
| `overlays/confirm-dialog.tsx` | Deletado. `ui/alert-dialog.tsx` (shadcn/Radix) | Trocas para `<AlertDialog>` com `AlertDialogTrigger`/`AlertDialogContent`/`AlertDialogAction`/`AlertDialogCancel`. |
| `reports/kpi-card.tsx` | Refatorado para usar `ui/card.tsx` (shadcn) internamente | Mantém nome/API `KpiCard`. |
| `reports/export-csv-button.tsx` | Usa `Button` novo | Trivial. |
| `notifications/notifications-bell.tsx` | Usa `ui/dropdown-menu.tsx` (shadcn) | Popover custom vira `DropdownMenu`. |
| Menu de usuário inline em `(protected)/layout.tsx` | Vira `DropdownMenu` (shadcn) | Remove `useRef`+`useEffect` de click-outside. |

### Componentes shadcn a adicionar

`button`, `input`, `label`, `select`, `badge`, `table`, `form`, `dialog`, `alert-dialog`, `dropdown-menu`, `card`, `sonner`.

### Fora do escopo

`sheet`, `command`, `skeleton`, `tooltip`, `tabs`, `popover` avulso, `combobox`. Adicionar conforme necessidade futura.

## Ordem dos commits dentro da branch

1. **`chore: init shadcn + tokens`** — `shadcn init`, escreve `lib/utils.ts` (cn), atualiza `globals.css` com tokens shadcn e mantém os antigos como aliases.
2. **`feat: add shadcn primitives`** — `shadcn add button input label select badge table form dialog alert-dialog dropdown-menu card sonner`. `git rm` dos custom antigos antes para diff limpo. Adiciona variant `warning` em `badgeVariants`.
3. **`refactor: migrar páginas que só usam Button/Input/Badge/Table`** — pesquisa-substituição direta. Inclui: `audit-logs/*`, `home`, `notifications/*`, `me`, `stock`, `reports/*`, `purchase-orders/page`, `orders/page`, `products/page`, `ingredients/page`, `users/page`, `suppliers/page`, `categories/page`, `units/page`, `stock-movements/page`.
4. **`refactor: Selects nativos → Radix Select`** — afeta filtros nas listagens e forms.
5. **`refactor: forms → shadcn Form + zod`** — `auth/page`, `me/page`, `categories/category-dialog`, `units/unit-dialog`, `suppliers/supplier-dialog`, `users/user-dialog`, `ingredients/ingredient-form`, `products/product-form`, `orders/order-form`, `purchase-orders/purchase-order-form`, `stock-movements/adjustment-dialog`.
6. **`refactor: Modal → Dialog, ConfirmDialog → AlertDialog`**.
7. **`refactor: DropdownMenu na header + NotificationsBell`**.
8. **`refactor: KpiCard usa Card por dentro`**.
9. **`feat: instalar Sonner Toaster`** em `app/layout.tsx`.
10. **`chore: remover tokens antigos do globals.css`** — após `grep` confirmar zero usos.
11. **`test: ajustar testes quebrados`** — corrige testes em `tests/` que dependiam de `<option>` / estrutura antiga.

## Riscos & mitigação

- **Forms RHF + Radix Select**: shadcn `Select` não é `<select>`; precisa de `<Controller>` ou `onValueChange={field.onChange}`. Padronizar a receita no primeiro form migrado e replicar.
- **Testes que clicam `<option>`**: reescrita usa `userEvent.click(trigger)` + `findByRole("option", { name })`.
- **Conflito de nome em `components/ui/`**: o `shadcn add` sobrescreve. Fazer `git rm` explícito dos antigos no commit 2 para diff legível.
- **Bundle size**: Radix adiciona ~30-40 KB gzipped. Aceitável.
- **PR grande**: mitigado por commits pequenos e auto-contidos.

## Verificação

Em cada commit:
- `npm run lint` (Biome) limpo.
- `npm run build` passa.
- `npm run test` — verde a partir do commit 11; durante 3-10 pode falhar (documentar no commit message quais testes ficam vermelhos).
- Smoke test manual em uma página afetada.

## Definition of Done

- Zero usos dos custom `components/ui/{button,input,select,badge,field,table}.tsx` antigos.
- `components/overlays/` deletado.
- Zero referências aos tokens antigos (`--color-bg`, `--color-text-primary`, `--color-primary`, `--color-secondary`, `--color-danger`, `--color-border`, `--color-icon`, `--color-text-secondary`) e às classes Tailwind correspondentes (`bg-bg`, `text-text-primary`, `bg-primary`, `text-danger`, `border-border`, etc.).
- `npm run lint`, `npm run build`, `npm run test` verdes.
- Validação visual manual em 5 páginas: `/home`, `/products`, `/orders/novo`, `/reports/sales`, `/auth`. Paleta visualmente idêntica ao antes.
