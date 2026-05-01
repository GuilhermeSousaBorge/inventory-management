# SP1 — Frontend Design (Categories + Suppliers + Ingredients)

## Visão geral

Segunda rodada do frontend do SP1, completando os 3 módulos que faltaram da
fundação (Categorias, Fornecedores, Ingredientes). Com isso o SP1 backend e
frontend ficam pareados antes do início do SP2.

**Objetivo:** entregar CRUD funcional para Categories, Suppliers e Ingredients
seguindo o padrão já estabelecido em `/users` e `/units`, com a única divergência
sendo o formulário de Ingredient (que ganha rotas dedicadas por ter mais campos
e dois selects de FK).

**Stack:** sem mudanças. Tudo já está no projeto — Next.js 16 (App Router),
React 19, Tailwind v4, axios, TanStack Query, RHF, zod, sonner, lucide-react.

---

## Escopo

### Dentro do escopo

- CRUD de Categorias (`/categories`) — leitura para autenticados, escrita OWNER.
- CRUD de Fornecedores (`/suppliers`) — leitura para autenticados, escrita OWNER.
- CRUD de Ingredientes (`/ingredients`) — leitura para autenticados, escrita OWNER.
- Filtros na lista de Ingredientes (categoria + status) com persistência em URL.
- Resolução client-side de FKs no Ingredient (categoryId/defaultSupplierId → nome).
- Tests (schemas, hooks, pages) seguindo o padrão de `ef22711`.

### Fora do escopo

- Endpoint `/ingredients/low-stock` (depende da tabela `stock` — território SP2).
- Busca por nome no Ingredient (backend não suporta hoje; ficaria para uma
  iteração futura, com mudança no backend).
- Coluna de "estoque atual" em Ingredients (SP2).
- Mudança da localização dos tokens (HttpOnly cookies) — segue conforme SP1
  anterior.
- Migração para Zustand — planejada, mas não nesta entrega.

---

## Premissas e decisões

| # | Decisão | Motivo |
|---|---------|--------|
| 1 | Espelhar Users/Units verbatim para Categories e Suppliers | Padrão já validado; abstrair seria premature |
| 2 | Ingredient ganha rotas dedicadas (`/novo`, `/[id]/editar`) | 7-8 campos com FKs; modal ficaria denso |
| 3 | URLs em inglês (`/categories`, `/suppliers`, `/ingredients`) | Convenção real do projeto (sidebar e implementação atual) |
| 4 | Labels da UI em português | Convenção do projeto |
| 5 | Filtros do `/ingredients` na URL via querystring | Shareable; sobrevivem a refresh |
| 6 | Resolver `categoryId`/`defaultSupplierId` para nome client-side | Reaproveita queries já feitas para os selects |
| 7 | Categorias têm hard-delete; tratar 409 com toast amigável | Backend não suporta soft-delete neste recurso |
| 8 | Suppliers e Ingredients têm soft-delete | Padrão do backend |
| 9 | Sem busca por nome em nenhuma listagem | Backend não suporta `?q=`; aceita-se filtro + paginação |

---

## Estrutura de arquivos

```
frontend/
├─ app/(protected)/
│  ├─ categories/
│  │  ├─ page.tsx
│  │  └─ category-dialog.tsx
│  ├─ suppliers/
│  │  ├─ page.tsx
│  │  └─ supplier-dialog.tsx
│  └─ ingredients/
│     ├─ page.tsx                 # lista + filtros + paginação
│     ├─ novo/page.tsx            # form de criação
│     └─ [id]/editar/page.tsx     # form de edição
├─ lib/
│  ├─ categories.ts               # types + zod schemas + hooks
│  ├─ suppliers.ts                # idem
│  └─ ingredients.ts              # idem (+ enum UNITS_OF_MEASURE exportado)
└─ tests/                         # mesma localização dos tests existentes
   ├─ lib/
   │  ├─ categories.schema.test.ts
   │  ├─ categories.test.ts
   │  ├─ suppliers.schema.test.ts
   │  ├─ suppliers.test.ts
   │  ├─ ingredients.schema.test.ts
   │  └─ ingredients.test.ts
   └─ app/
      ├─ categories.test.tsx
      ├─ suppliers.test.tsx
      └─ ingredients.test.tsx
```

A localização exata dos tests segue o que o `vitest.config` do projeto já
estabelece — espelha o que `ef22711` introduziu.

---

## Roteamento e guards

| Rota | Acesso | Conteúdo |
|------|--------|----------|
| `/categories` | autenticado (leitura), OWNER (escrita) | lista + modal create/edit |
| `/suppliers` | autenticado (leitura), OWNER (escrita) | lista + modal create/edit |
| `/ingredients` | autenticado (leitura), OWNER (escrita) | lista com filtros |
| `/ingredients/novo` | OWNER | form dedicado de criação |
| `/ingredients/[id]/editar` | OWNER | form dedicado de edição |

Guards de role inline (mesmo padrão usado em `/users`):
- Listagens: botões de criar/editar/desativar só renderizam para `user.role === 'OWNER'`.
- `/ingredients/novo` e `/ingredients/[id]/editar`: se `user.role !== 'OWNER'` →
  render `<NoAccess />` em vez do form.

A sidebar já tem entradas para os 3 recursos (Catálogo: Categorias, Ingredientes;
Suprimentos: Fornecedores). Nenhuma mudança de layout necessária — a
implementação só "preenche" rotas que hoje dão 404.

---

## Módulo: Categories

### Tela `/categories`

**Header:** título "Categorias", descrição curta, botão "+ Nova categoria"
(só OWNER).

**Tabela:**
- Colunas: Nome, Descrição (truncada com ellipsis), Ações (`⋯`, só OWNER).
- Menu de ações:
  - **Editar** → abre `category-dialog` em modo edit.
  - **Excluir** → `<ConfirmDialog>` (mensagem destrutiva, vermelho) → `DELETE /categories/{id}`.
- Paginação: 20/pg, prev/next + indicador "Página X de Y".
- Estados: vazio (CTA "Criar primeira categoria"), loading (5 linhas skeleton),
  erro (banner com retry).

### `category-dialog.tsx`

Campos:
- `name`: 1-100, obrigatório.
- `description`: ≤255, opcional (textarea).

Sem campo `active` — categorias não têm soft-delete.

Submit:
- Sucesso → fecha modal, invalida `['categories']`, toast.
- 400 com `fieldErrors` → banner no topo do form.

### Delete

Hard delete via `<ConfirmDialog>`. Backend retorna 409 (ou 400) se houver
ingredientes vinculados → tratamos no `useDeleteCategory` repassando o erro,
e a página exibe toast vermelho:

> "Não é possível remover: existem ingredientes nesta categoria."

---

## Módulo: Suppliers

### Tela `/suppliers`

**Header:** título "Fornecedores", descrição, botão "+ Novo fornecedor" (só OWNER).

**Tabela:**
- Colunas: Nome, Contato (`contactName` com fallback "—"), Telefone, Status
  (badge Ativo/Inativo), Ações (só OWNER).
- Menu de ações:
  - **Editar** → abre `supplier-dialog` em modo edit.
  - **Desativar/Reativar** → `<ConfirmDialog>` para desativar; reativar é direto
    via `PUT` com `active: true`.
- Paginação 20/pg, mesmos estados.

### `supplier-dialog.tsx`

Campos:
- `name`: 1-150, obrigatório.
- `contactName`: ≤100, opcional.
- `phone`: ≤20, opcional.
- `email`: e-mail válido se preenchido, ≤150, opcional.
- `address`: ≤255, opcional.
- `active`: checkbox, só no editar.

Submit análogo ao de Users — invalida `['suppliers']`.

---

## Módulo: Ingredients

### Tela `/ingredients`

**Header:** título "Ingredientes", descrição, botão "+ Novo ingrediente"
(só OWNER) → navega para `/ingredients/novo`.

**Barra de filtros** (acima da tabela):
- Dropdown "Categoria": opção "Todas" + lista de todas as categorias.
- Select "Status": Ativos (default) | Inativos | Todos.
- Filtros refletem na URL via querystring (`?category=&active=`); estado da UI
  é derivado de `useSearchParams` para sobreviver a refresh.

**Tabela:**
- Colunas:
  - Nome
  - Categoria (nome resolvido client-side)
  - Mínimo (`{minimum_qty} {unit_of_measure}`, ex: "5.000 kg")
  - Fornecedor padrão (nome ou "—")
  - Status (badge Ativo/Inativo)
  - Ações (só OWNER)
- Menu de ações:
  - **Editar** → `/ingredients/{id}/editar`.
  - **Desativar/Reativar** → `<ConfirmDialog>` + mutation.
- Paginação 20/pg, mesmos estados.

**Resolução de FKs:**
- `useCategories()` (sem params, retorna lista completa) com `staleTime` longo.
- `useSuppliers({ active: true })` com `staleTime` longo.
- A página monta `Map<id, name>` para Categorias e Fornecedores e usa na
  renderização da tabela. As mesmas queries servem ao dropdown de filtro e aos
  selects do form em `/novo` e `/[id]/editar`.

### Tela `/ingredients/novo` e `/ingredients/[id]/editar`

Layout: card centrado max-w-2xl com:
- Breadcrumb leve no topo: "Ingredientes › Novo" ou "Ingredientes › Editar".
- Título da página.
- Form em uma coluna (todos os campos full-width).
- Rodapé: "Cancelar" (volta para `/ingredients`) e "Salvar".

**Campos:**

| Campo | Tipo UI | Validação |
|-------|---------|-----------|
| `name` | input texto | 1-150, obrigatório |
| `description` | textarea | ≤255, opcional |
| `categoryId` | `<Select>` nativo com categorias | obrigatório |
| `unitOfMeasure` | `<Select>` enum: kg, g, L, ml, un, cx | obrigatório |
| `minimumQty` | input number step=0.001 | ≥ 0, obrigatório |
| `expiryDate` | input date | opcional |
| `defaultSupplierId` | `<Select>` com fornecedores ativos + opção "Nenhum" | opcional |
| `active` | checkbox | só no editar |

**Guard de role:** se `user.role !== 'OWNER'` → render `<NoAccess />`.

**Submit:**
- Loading do botão "Salvar" durante request.
- Sucesso → toast "Ingrediente criado/atualizado", invalida `['ingredients']`,
  `router.replace('/ingredients')`.
- 400 com `fieldErrors` → banner no topo do form.

**Página de edição (`/ingredients/[id]/editar`):**
- Pre-fetch via `useIngredient(id)` para popular `defaultValues` do RHF.
- Loading: esqueleto do form.
- 404: mensagem inline "Ingrediente não encontrado" + link "Voltar".

---

## Tipos e schemas (lib/)

### `lib/categories.ts`

```ts
export type Category = {
  id: string
  name: string
  description: string | null
  createdAt: string
}

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(255).nullish(),
})
export const updateCategorySchema = createCategorySchema
```

### `lib/suppliers.ts`

```ts
export type Supplier = {
  id: string
  name: string
  contactName: string | null
  phone: string | null
  email: string | null
  address: string | null
  active: boolean
  createdAt: string
}

export const createSupplierSchema = z.object({
  name: z.string().min(1).max(150),
  contactName: z.string().max(100).nullish(),
  phone: z.string().max(20).nullish(),
  email: z.string().email().max(150).or(z.literal('')).nullish(),
  address: z.string().max(255).nullish(),
})
export const updateSupplierSchema = createSupplierSchema.extend({
  active: z.boolean(),
})
```

### `lib/ingredients.ts`

```ts
export const UNITS_OF_MEASURE = ['kg', 'g', 'L', 'ml', 'un', 'cx'] as const
export type UnitOfMeasure = typeof UNITS_OF_MEASURE[number]

export type Ingredient = {
  id: string
  name: string
  description: string | null
  categoryId: string
  unitOfMeasure: UnitOfMeasure
  minimumQty: number
  averageCost: number
  expiryDate: string | null  // ISO date
  defaultSupplierId: string | null
  active: boolean
  createdAt: string
}

export const createIngredientSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(255).nullish(),
  categoryId: z.string().uuid(),
  unitOfMeasure: z.enum(UNITS_OF_MEASURE),
  minimumQty: z.coerce.number().nonnegative(),
  expiryDate: z.string().date().nullish().or(z.literal('')),
  defaultSupplierId: z.string().uuid().nullish().or(z.literal('')),
})
export const updateIngredientSchema = createIngredientSchema.extend({
  active: z.boolean(),
})
```

---

## Hooks por recurso

### `lib/categories.ts`

```ts
useCategories(params?: { page?: number; size?: number })  // sem params: lista completa
useCategory(id: string)
useCreateCategory()
useUpdateCategory()
useDeleteCategory()  // hard delete; repassa erro 409 ao caller
```

Query keys: `['categories']` ou `['categories', { page, size }]`. Mutations
invalidam `['categories']`.

### `lib/suppliers.ts`

```ts
useSuppliers(params?: { active?: boolean; page?: number; size?: number })
useSupplier(id: string)
useCreateSupplier()
useUpdateSupplier()
useDeactivateSupplier()
```

Query keys: `['suppliers']` ou `['suppliers', { active, page, size }]`.

### `lib/ingredients.ts`

```ts
useIngredients(filters?: {
  category?: string
  active?: boolean
  page?: number
  size?: number
})
useIngredient(id: string)
useCreateIngredient()
useUpdateIngredient()
useDeactivateIngredient()
```

Query keys: `['ingredients', { category, active, page, size }]`. Mutations
invalidam `['ingredients']`.

### Convenções compartilhadas

- Strings vazias em campos opcionais são convertidas para `null` antes do
  submit (transform no caminho do mutate, ou `.transform()` no schema).
- Tratamento de erro 400/409 reaproveita o `ApiError` normalizado pelo
  interceptor do axios.
- `staleTime` para listas usadas como fontes de selects (categorias completas,
  suppliers ativos): 5 minutos — reduz refetch desnecessário entre as
  navegações da rodada.

---

## Tratamento de erros (UX)

Mesmas regras do SP1 anterior. Notas específicas desta rodada:

| Cenário | Tratamento |
|---------|------------|
| `DELETE /categories/{id}` retorna 409/400 com ingredientes vinculados | Toast vermelho com mensagem amigável (acima); listagem não muda |
| 400 em `POST/PUT /ingredients` com `categoryId` inexistente | Banner no topo do form com mensagem do backend |
| Categoria/Supplier excluído entre o load da lista e o submit do ingrediente | Backend retorna 400 → banner; usuário recarrega e tenta de novo |

---

## Testes

Vitest + RTL, seguindo o padrão estabelecido em `ef22711`.

**Schema tests** (`tests/lib/<recurso>.schema.test.ts`):
- Boundary (min/max length) dos obrigatórios.
- Suppliers: e-mail vazio aceito; e-mail inválido rejeitado.
- Ingredients: enum `unitOfMeasure` valida os 6 valores; rejeita outros;
  `minimumQty` rejeita negativos; `expiryDate` aceita ISO date e vazio.

**API/hooks tests** (`tests/lib/<recurso>.test.ts`):
- Mock do axios.
- `useCategories`/`useSuppliers`/`useIngredients` fazem GET correto com/sem
  params.
- `useCreate*` envia body certo e invalida a query certa.
- `useDeactivate*` chama `DELETE /<recurso>/{id}`.
- `useDeleteCategory` repassa o 409 para o caller.
- `useIngredients({ category, active })` monta a querystring esperada.

**Page tests** (`tests/app/<recurso>.test.tsx`):
- Render em estados: vazio, com dados, loading, erro.
- Botões de ação aparecem só para OWNER (mock `useAuth`).
- Modal/route de criar abre e fecha corretamente.
- Para `/ingredients`: mudar filtro de categoria/status atualiza a URL e dispara
  refetch.
- Para `/categories`: confirm dialog de delete; erro 409 vira toast com a
  mensagem amigável.

Sem coverage gates novos — manter o threshold atual do projeto.

---

## Critérios de pronto

- [ ] Sidebar leva às 3 rotas sem 404.
- [ ] Categories: OWNER cria/edita/exclui; EMPLOYEE só lê. Excluir categoria
      com ingredientes vinculados mostra toast amigável.
- [ ] Suppliers: OWNER cria/edita/desativa; EMPLOYEE só lê. Soft-delete
      preserva histórico.
- [ ] Ingredients lista: filtros de categoria e status persistem na URL e
      sobrevivem a refresh; coluna "Mínimo" exibe `{qty} {unit}`; coluna
      Categoria/Fornecedor mostra nomes (não UUIDs).
- [ ] Ingredients form: rotas dedicadas; selects populados das queries em
      cache; validação client-side coincide com backend; sucesso volta para a
      lista com toast.
- [ ] EMPLOYEE acessando `/ingredients/novo` ou `/ingredients/[id]/editar`
      direto pela URL vê `<NoAccess />`.
- [ ] Toasts em sucesso/erro de todas as mutations.
- [ ] Tests novos passam (schema, hooks, pages para os 3 módulos).
- [ ] `npm run build` sobe sem warnings; `npm run test` verde.
