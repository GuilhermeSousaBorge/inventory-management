# SP1 — Frontend Design (Auth + Users + Units)

## Visão geral

Primeira leva do frontend, espelhando o subset Auth + Users + Units do SP1 do backend.
Categorias, Fornecedores e Ingredientes (também em SP1 backend) ficam para uma rodada
posterior antes de iniciar SP2.

**Objetivo:** estabelecer no frontend as fundações usadas por todos os SPs seguintes
— autenticação, cliente HTTP, padrão de CRUD com listagem paginada, formulários
validados e feedback visual — e entregar telas funcionais para os 3 módulos do escopo.

**Stack já no projeto:** Next.js 16 (App Router), React 19, Tailwind v4, lucide-react.

**Dependências a instalar nesta rodada:**
- `axios` — cliente HTTP único, configurado com interceptors.
- `@tanstack/react-query` + `@tanstack/react-query-devtools` — server state, cache, mutations.
- `react-hook-form` + `zod` + `@hookform/resolvers` — formulários e validação.
- `sonner` — toasts.

Sem lib de componentes (Radix/shadcn) no escopo. Modal e overlays escritos à mão sobre
Tailwind. Se a acessibilidade do dialog ficar um problema na implementação, abro
exceção pontual para `@radix-ui/react-dialog`.

---

## Escopo

### Dentro do escopo

- Login (`/auth`) com persistência de sessão via JWT (access + refresh).
- Auto-refresh transparente em 401 com single-flight.
- Logout via menu do avatar no header.
- Roteamento e guards (autenticação + role OWNER).
- Tela de boas-vindas (`/home`) — placeholder até SP4 trazer dashboard real.
- Perfil próprio (`/me`) — leitura de dados + alterar senha.
- CRUD de usuários (`/usuarios`) — OWNER apenas.
- CRUD de unidades (`/unidades`) — leitura para todos autenticados, escrita para OWNER.

### Fora do escopo

- Categorias, Fornecedores, Ingredientes (próxima rodada).
- Migração para Zustand (planejada, mas não nesta entrega).
- Cookies HttpOnly / mudança de auth no backend.
- Dashboard com gráficos (SP4).
- PWA / offline (RNF03).

---

## Premissas e decisões

| # | Decisão | Motivo |
|---|---------|--------|
| 1 | Apenas Auth + Users + Units nesta rodada | Estabelece o esqueleto antes de replicar para os outros 3 módulos |
| 2 | Tokens em `localStorage` (access + refresh) | App interno; reduz fricção; refator pra Zustand depois é mecânico |
| 3 | TanStack Query para server state | Padrão para CRUD escalável; invalidação declarativa |
| 4 | RHF + zod para forms | Schema espelha Bean Validation do backend; tipos derivados do schema |
| 5 | Modal para criar/editar (híbrido) | Forms curtos no escopo; promovem-se a rotas dedicadas se crescerem |
| 6 | `next.config.ts` com `rewrites()` `/api/* → :8080` | Sem CORS; same-origin em dev e produção |
| 7 | axios com interceptors | Single-flight de refresh; normalização de erros num lugar só |
| 8 | URLs em português (`/usuarios`, `/unidades`) | Já estabelecido na sidebar existente |
| 9 | Componentes co-localizados quando usados em 1 lugar | Promovidos a `components/` ao virarem reutilizáveis |

---

## Estrutura de arquivos

```
frontend/
├─ next.config.ts                        # rewrites /api/* → http://localhost:8080/*
├─ app/
│  ├─ layout.tsx                         # já existe
│  ├─ providers.tsx                      # NOVO — QueryClientProvider + AuthProvider + <Toaster/>
│  ├─ page.tsx                           # redirect baseado em status de auth
│  ├─ (public)/
│  │  └─ auth/page.tsx                   # já existe — plugar mutation de login
│  └─ (protected)/
│     ├─ layout.tsx                      # já existe — adicionar guard + bind ao usuário real + menu do avatar
│     ├─ home/page.tsx                   # NOVO — placeholder
│     ├─ me/page.tsx                     # NOVO — perfil + trocar senha
│     ├─ usuarios/
│     │  ├─ page.tsx                     # lista + paginação + ações
│     │  └─ user-dialog.tsx              # modal criar/editar (co-localizado)
│     └─ unidades/
│        ├─ page.tsx
│        └─ unit-dialog.tsx
├─ lib/
│  ├─ api.ts                             # axios instance + interceptors (auth, refresh, error normalize)
│  ├─ auth.tsx                           # AuthContext + Provider + useAuth + tokenStorage helpers
│  ├─ users.ts                           # tipos + zod schemas + hooks (useUsers, useUser, useCreateUser, useUpdateUser, useDeactivateUser, useChangeMyPassword)
│  └─ units.ts                           # idem para unidades
└─ components/
   ├─ ui/
   │  ├─ button.tsx
   │  ├─ input.tsx
   │  ├─ field.tsx                       # label + mensagem de erro inline
   │  ├─ select.tsx
   │  ├─ badge.tsx
   │  └─ table.tsx
   └─ overlays/
      ├─ modal.tsx                       # dialog primitivo (acessível, sem dep externa)
      └─ confirm-dialog.tsx
```

**Regra de promoção:** componente usado em 1 lugar → co-localizado. Usado em 2+ →
promovido a `components/<categoria>/`.

---

## HTTP client e fluxo de auth

### `lib/api.ts`

Instância única de axios:

```ts
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})
```

**Request interceptor** — anexa `Authorization: Bearer <accessToken>` quando há token.

**Response interceptor (sucesso)** — desembrulha o envelope do backend:
- Se `response.data` tem só `{ data }`, substitui `response.data` por `response.data.data`.
- Se tem `{ data, page, size, total }` (paginado), mantém a forma intacta.

**Response interceptor (erro)** — normaliza para `ApiError { status, message, fieldErrors? }`:
- 400 com `{ errors: string[] }` → `fieldErrors` populado, `message` = primeiro erro.
- 4xx com `{ error: string }` → `message` populado.
- 401 fora de `/auth/login` e `/auth/refresh`:
  1. Se já há refresh em voo, espera essa promise (single-flight).
  2. Senão dispara `POST /auth/refresh` com o refresh token.
  3. Sucesso → atualiza `tokenStorage`, retenta a request original 1 vez (flag `_retry` em `error.config`).
  4. Falhou → `tokenStorage.clear()`, dispara `window.dispatchEvent(new Event('auth:expired'))`, rejeita.

`AuthProvider` registra `window.addEventListener('auth:expired', ...)` no mount e
redireciona para `/auth?expired=1`.

### `tokenStorage` (em `lib/auth.tsx`)

API mínima e estável (para troca futura por Zustand):

```ts
tokenStorage.getAccess(): string | null
tokenStorage.setAccess(token: string): void
tokenStorage.getRefresh(): string | null
tokenStorage.setRefresh(token: string): void
tokenStorage.clear(): void
```

### `AuthProvider`

Estado:

```ts
{ user: User | null, status: 'loading' | 'authenticated' | 'unauthenticated' }
```

API exposta por `useAuth()`:

```ts
{ user, status, login(email, password), logout(), refreshUser() }
```

**Bootstrap (no mount):**
- Sem `accessToken` → `unauthenticated` direto.
- Com `accessToken` → `loading`. Chama `/users/me`. Sucesso → `authenticated`. 401 →
  o response interceptor já tenta refresh; se também falhar, `unauthenticated`.

**login(email, password):**
1. `POST /auth/login` → recebe `{ accessToken, refreshToken }`.
2. `tokenStorage.setAccess()` + `setRefresh()`.
3. `GET /users/me` → seta `user`, status `authenticated`.
4. Caller (página de login) cuida do redirect.

**logout():**
1. `POST /auth/logout` com refresh token (não bloqueia em erro).
2. `tokenStorage.clear()`, `user = null`, status `unauthenticated`.
3. Caller redireciona para `/auth`.

---

## Roteamento e guards

### Mapa de rotas

| Rota | Acesso | Conteúdo |
|------|--------|----------|
| `/` | redirect | `/home` se autenticado, `/auth` caso contrário |
| `/auth` | público (bloqueia logado) | login |
| `/home` | autenticado | placeholder |
| `/me` | autenticado | perfil + alterar senha |
| `/usuarios` | OWNER | CRUD de usuários |
| `/unidades` | autenticado (leitura), OWNER (escrita) | CRUD de unidades |

### Guards

**`(protected)/layout.tsx`** — guard de autenticação:
- `status === 'loading'` → renderiza esqueleto da shell (sidebar+header em pulse, conteúdo cinza).
- `status === 'unauthenticated'` → `useEffect` chama `router.replace('/auth')`, retorna `null`.
- `authenticated` → renderiza children + plumbing do header (avatar/nome do `user`).

**`(public)/auth/page.tsx`** — guard inverso:
- Se `authenticated`, redireciona para `/home`.

**`/usuarios/page.tsx`** — guard de role inline:
- Se `user.role !== 'OWNER'`, renderiza `<NoAccess />` em vez do conteúdo.

**`/unidades/page.tsx`** — leitura sempre, escrita gated:
- Botão "Nova unidade" e menu de ações `⋯` só renderizam quando `user.role === 'OWNER'`.

### Sidebar

Atualizar `(protected)/layout.tsx`:
- Itens da sidebar continuam como estão, exceto **Usuários** que é escondido para `EMPLOYEE`.
- Avatar e iniciais saem de `user.name`.

### Menu do avatar (header)

Pequeno popover ao clicar no avatar:
- "Meu perfil" → `/me`.
- "Sair" → `auth.logout()` → `router.replace('/auth')`.

---

## Telas

### `/auth` — login (já existe visualmente)

Plumbing a adicionar:
- `onSubmit` chama `auth.login(email, password)` via TanStack Query mutation.
- Erro 401 → mensagem inline acima do botão: "E-mail ou senha inválidos".
- Erro de rede / 5xx → mensagem inline genérica: "Não foi possível entrar. Tente novamente".
- Botão em `loading`: rótulo "Entrando..." e disabled durante a request.
- Remover `defaultValue` (`ana@pizzaria.com` / `password`) e o texto "Demo: qualquer credencial funciona".
- Após sucesso, `router.replace('/home')`.
- Se chegou em `/auth?expired=1`, mostra um banner discreto "Sua sessão expirou. Faça login novamente."

### `/home` — placeholder

Saudação ("Bem-vinda, {primeiroNome} 👋") + um parágrafo curto. Dois cards de atalho:
- "Sua unidade: {nome}" — link para `/unidades`. Mostra a primeira unidade ativa retornada por `GET /units?size=1`.
- "Seu perfil: {role} · {nome}" — link para `/me`.

Esta tela será substituída pelo dashboard real em SP4.

### `/me` — perfil + alterar senha

Duas seções verticais:

**1) Meu perfil (read-only):**
- Nome, e-mail, perfil (badge), data de criação formatada.
- Origem: `useAuth().user`.

**2) Alterar senha:**
- Campos: senha atual, nova senha, confirmar nova senha.
- Schema zod:
  - `currentPassword`: obrigatório, mín 1.
  - `newPassword`: 6–100 chars.
  - `confirmPassword`: igual a `newPassword` (refine).
- Submit → `PUT /users/me/password` com `{ currentPassword, newPassword }`.
- Sucesso → toast "Senha alterada", limpa form.
- 400 (senha atual incorreta) → erro inline no campo `currentPassword`.

### `/usuarios` — lista (OWNER only)

**Header da página:** título "Usuários", descrição curta, botão primário "+ Novo usuário".

**Tabela:**
- Colunas: Nome, E-mail (truncado com ellipsis), Perfil (badge), Status (Ativo/Inativo), Ações.
- Menu de ações `⋯` por linha:
  - **Editar** → abre `user-dialog` em modo edit (sem campo password).
  - **Desativar** (se ativo) → `<ConfirmDialog>` → `DELETE /users/{id}`.
  - **Reativar** (se inativo) → `PUT /users/{id}` com `active: true`.
- Na linha do próprio usuário (id == user atual), as ações "Desativar" e mudar role são **desabilitadas** com tooltip ("Não é possível desativar a si mesmo").

**Paginação:** prev/next + indicador "Página X de Y · 20 por página". Consome `?page=&size=20`. `total` vem da API.

**Estados:**
- Vazio: mensagem + CTA "Criar primeiro usuário".
- Loading: 5 linhas skeleton.
- Erro: banner discreto com botão "Tentar novamente".

**`user-dialog.tsx` (criar/editar):**
- Campos comuns: nome, e-mail, perfil (select EMPLOYEE/OWNER).
- Campo `senha` apenas no **criar**.
- Campo `ativo` (checkbox) apenas no **editar**.
- Schemas zod:
  - `createSchema`: name 1–100, email válido ≤150, password 6–100, role enum.
  - `updateSchema`: name 1–100, email ≤150, role enum, active boolean.
- Submit → `useCreateUser` ou `useUpdateUser` → ao sucesso fecha modal, invalida `['users']`, toast.
- 400 com `fieldErrors` (ex: e-mail duplicado) → mostra mensagem em cima do form.

### `/unidades` — lista

**Header:** título "Unidades", descrição curta, botão "+ Nova unidade" (só OWNER).

**Tabela:** Nome, Endereço, Status, Ações (só OWNER).

**Estados:** mesmos de `/usuarios`.

**`unit-dialog.tsx`:**
- Campos: nome (obrigatório, ≤100), endereço (opcional, ≤255).
- Campo `ativo` (checkbox) apenas no editar.
- Submit análogo ao de usuário, invalida `['units']`.

---

## Componentes transversais

| Componente | Localização | Função |
|------------|-------------|--------|
| `<Button />` | `components/ui/` | variantes: primary (verde), secondary (lima), danger, ghost; tamanhos sm/md |
| `<Input />` | `components/ui/` | input estilizado, integra com RHF via `register` |
| `<Field />` | `components/ui/` | wrapper label + input + erro inline |
| `<Select />` | `components/ui/` | select nativo estilizado (sem combobox custom) |
| `<Badge />` | `components/ui/` | variantes: neutral, success, danger, warning |
| `<Table />` | `components/ui/` | wrapper da tabela com classes do design (cabeçalho cinza, divisória) |
| `<Modal />` | `components/overlays/` | dialog centralizado, overlay escuro, fecha em Esc + clique fora; trava scroll do body |
| `<ConfirmDialog />` | `components/overlays/` | modal genérico (título, mensagem, ação destrutiva em vermelho) |
| `<NoAccess />` | inline em `/usuarios/page.tsx` | mensagem de "sem permissão" + link voltar |
| `<Toaster />` | em `providers.tsx` | sonner |

---

## Validação e tipos

Tipos espelham os DTOs do backend. Em `lib/users.ts`:

```ts
export type Role = 'OWNER' | 'EMPLOYEE'

export type User = {
  id: string
  name: string
  email: string
  role: Role
  active: boolean
  createdAt: string  // ISO
}

export const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(150),
  password: z.string().min(6).max(100),
  role: z.enum(['OWNER', 'EMPLOYEE']),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
```

Em `lib/units.ts`:

```ts
export type Unit = {
  id: string
  name: string
  address: string | null
  active: boolean
  createdAt: string
}
```

---

## Hooks por recurso

### `lib/users.ts`

```ts
useUsers(page, size)             // GET /users — TanStack query, key ['users', page, size]
useUser(id)                      // GET /users/{id} — query, key ['users', id]
useCreateUser()                  // POST /users — invalida ['users']
useUpdateUser()                  // PUT /users/{id} — invalida ['users']
useDeactivateUser()              // DELETE /users/{id} — invalida ['users']
useChangeMyPassword()            // PUT /users/me/password
```

### `lib/units.ts`

Análogo — `useUnits`, `useUnit`, `useCreateUnit`, `useUpdateUnit`, `useDeactivateUnit`.

---

## next.config.ts

```ts
const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://localhost:8080/:path*' },
    ]
  },
}
```

Em produção, configurável via `process.env.BACKEND_URL`.

---

## Tratamento de erros (UX)

| Origem | Tratamento |
|--------|------------|
| 400 com `fieldErrors` em form | Banner no topo do form com mensagem agregada |
| 400/409 fora de form | Toast vermelho com a `message` |
| 401 em request comum | Auto-refresh transparente; se falhar, redirect para `/auth?expired=1` |
| 401 em `/auth/login` | Página de login captura o erro e mostra "E-mail ou senha inválidos" (interceptor não tenta refresh em `/auth/*`) |
| 403 | Toast vermelho "Sem permissão" — provavelmente mostra que a UI permitiu uma ação que não devia (bug a corrigir) |
| 404 | Mensagem inline "Recurso não encontrado" + voltar |
| 5xx / rede | Toast "Falha ao se conectar com o servidor. Tente novamente." |

---

## Convenções

- **Idioma:** UI em português (rótulos, mensagens). Código em inglês.
- **Nomes de arquivos:** kebab-case (`user-dialog.tsx`, `confirm-dialog.tsx`).
- **Componentes:** PascalCase.
- **Hooks:** camelCase com prefixo `use`.
- **Query keys:** array com nome do recurso primeiro (`['users']`, `['users', id]`).

---

## Critérios de pronto

- [ ] `npm install` instala todas as deps novas e o app sobe sem warnings.
- [ ] Login funcional com `admin@pizzaria.com / admin123` (credenciais da migration `V5`).
- [ ] Sessão persiste após refresh da página.
- [ ] 401 em request comum dispara refresh transparente.
- [ ] Logout chama `/auth/logout` e redireciona para `/auth`.
- [ ] `/me` permite trocar a senha; após troca, próximo login usa a senha nova.
- [ ] OWNER consegue criar, editar e desativar usuários; EMPLOYEE não vê o item no menu.
- [ ] OWNER consegue criar, editar e desativar unidades; EMPLOYEE vê a tabela em modo leitura (sem ações).
- [ ] Toasts aparecem em sucesso/erro de mutations.
- [ ] Validação client-side coincide com a do backend (sem 400 inesperados em forms preenchidos corretamente).
- [ ] Navegação respeita guards: `/usuarios` sem auth → `/auth`; `/usuarios` como EMPLOYEE → tela de "sem permissão".
- [ ] Sidebar marca rota ativa corretamente para `/home`, `/me`, `/usuarios`, `/unidades`.
