# Inventory Management — Sub-projeto 1: Fundação

## Visão Geral do Sistema Completo

Sistema de gestão de estoque para pizzaria, desenvolvido em 4 sub-projetos:

| Sub-projeto | Escopo |
|---|---|
| **1. Fundação** *(este)* | Auth, usuários, itens, categorias, fornecedores |
| **2. Movimentações** | Entradas, saídas, devoluções, validade, custo |
| **3. Receitas & Pedidos** | Receitas por tamanho, pedidos, baixa automática |
| **4. Alertas & Relatórios** | Painel de estoque baixo, email/WhatsApp, relatórios |

---

## Sub-projeto 1: Fundação

**Goal:** Estabelecer a base do sistema — autenticação JWT, controle de acesso por perfil, e cadastro de itens, categorias e fornecedores.

**Stack:** Java 21, Spring Boot 4, Spring Security + JJWT 0.12.6, Spring Data JPA, PostgreSQL 16, Flyway, SpringDoc OpenAPI 2.5.0.

---

## Arquitetura

**Padrão:** Domain-Driven Organization — pacotes organizados por domínio, não por camada técnica.

```
br.com.easy_inventory.management/
  auth/           → autenticação JWT (login, refresh, logout)
  user/           → gerenciamento de usuários
  category/       → categorias de itens
  item/           → itens do estoque
  supplier/       → fornecedores
  shared/         → utilitários compartilhados (exceptions, responses, config)
```

Cada domínio contém: entidade JPA, repository, service, controller, DTOs de request/response.

**Segurança:** JWT stateless. Nenhum estado de sessão no servidor. Todos os endpoints (exceto `/auth/login`) exigem `Authorization: Bearer <token>`.

**Schema:** gerenciado exclusivamente por migrações Flyway (`V{n}__{descricao}.sql`).

---

## Perfis de Acesso

| Ação | OWNER | EMPLOYEE |
|---|---|---|
| Login / Refresh | ✅ | ✅ |
| Ver próprio perfil / trocar senha | ✅ | ✅ |
| Gerenciar usuários | ✅ | ❌ |
| Leitura de itens, categorias, fornecedores | ✅ | ✅ |
| Criar/editar/excluir itens, categorias, fornecedores | ✅ | ❌ |

O primeiro usuário OWNER é criado via migration do Flyway com senha padrão — não existe rota de registro público.

---

## Módulo: Auth (`/auth`)

### Endpoints

```
POST /auth/login    → recebe {email, password}, retorna {accessToken, refreshToken}
POST /auth/refresh  → recebe {refreshToken}, retorna novo {accessToken}
POST /auth/logout   → invalida o refresh token
```

### Tokens
- **Access token:** validade 8h, contém userId, email, role
- **Refresh token:** validade 7 dias, armazenado em tabela `refresh_tokens` (tokenHash, userId, expiresAt, revoked)

### Fluxo de logout
O refresh token é marcado como `revoked = true` no banco. Access tokens expiram naturalmente (sem blacklist).

---

## Módulo: Usuários (`/users`)

### Entidade `users`

| Campo | Tipo | Observação |
|---|---|---|
| id | UUID | PK |
| name | VARCHAR(100) | não nulo |
| email | VARCHAR(150) | único, não nulo |
| password_hash | VARCHAR(255) | BCrypt |
| role | ENUM('OWNER','EMPLOYEE') | não nulo |
| active | BOOLEAN | default true |
| created_at | TIMESTAMP | não nulo |

### Endpoints

```
GET    /users           → lista todos (OWNER)
POST   /users           → cria usuário (OWNER)
GET    /users/{id}      → detalhe (OWNER)
PUT    /users/{id}      → atualiza nome, email, role, active (OWNER)
DELETE /users/{id}      → desativa (soft delete) (OWNER)
GET    /users/me        → perfil próprio (todos)
PUT    /users/me/password → troca senha (todos); body: {currentPassword, newPassword}
```

---

## Módulo: Categorias (`/categories`)

### Entidade `categories`

| Campo | Tipo | Observação |
|---|---|---|
| id | UUID | PK |
| name | VARCHAR(100) | único, não nulo |
| description | VARCHAR(255) | opcional |
| created_at | TIMESTAMP | não nulo |

### Endpoints

```
GET    /categories       → lista todas (todos)
POST   /categories       → cria (OWNER)
GET    /categories/{id}  → detalhe (todos)
PUT    /categories/{id}  → atualiza (OWNER)
DELETE /categories/{id}  → remove se não houver itens vinculados (OWNER)
```

---

## Módulo: Fornecedores (`/suppliers`)

### Entidade `suppliers`

| Campo | Tipo | Observação |
|---|---|---|
| id | UUID | PK |
| name | VARCHAR(150) | não nulo |
| contact_name | VARCHAR(100) | opcional |
| phone | VARCHAR(20) | opcional |
| email | VARCHAR(150) | opcional |
| address | VARCHAR(255) | opcional |
| active | BOOLEAN | default true |
| created_at | TIMESTAMP | não nulo |

### Endpoints

```
GET    /suppliers        → lista todos (todos)
POST   /suppliers        → cria (OWNER)
GET    /suppliers/{id}   → detalhe (todos)
PUT    /suppliers/{id}   → atualiza (OWNER)
DELETE /suppliers/{id}   → desativa (soft delete) (OWNER)
```

Fornecedor desativado não pode ser selecionado em novas entradas. Histórico preservado.

---

## Módulo: Itens (`/items`)

### Entidade `items`

| Campo | Tipo | Observação |
|---|---|---|
| id | UUID | PK |
| name | VARCHAR(150) | não nulo |
| description | VARCHAR(255) | opcional |
| category_id | UUID | FK → categories |
| unit | ENUM | kg, g, L, ml, un, cx |
| current_stock | DECIMAL(10,3) | não nulo, default 0 |
| minimum_stock | DECIMAL(10,3) | não nulo |
| average_cost | DECIMAL(10,4) | calculado, default 0 |
| expiry_date | DATE | opcional |
| default_supplier_id | UUID | FK → suppliers, opcional |
| active | BOOLEAN | default true |
| created_at | TIMESTAMP | não nulo |

### Cálculo de Custo Médio

Recalculado a cada entrada de estoque (implementado no Sub-projeto 2):

```
novo_custo_médio = (qtd_atual × custo_médio_atual + qtd_entrada × preço_unitário)
                  / (qtd_atual + qtd_entrada)
```

### Endpoints

```
GET    /items            → lista todos, suporta filtros: ?category={id}&active={bool} (todos)
POST   /items            → cria (OWNER)
GET    /items/{id}       → detalhe (todos)
PUT    /items/{id}       → atualiza (OWNER)
DELETE /items/{id}       → desativa (soft delete) (OWNER)
GET    /items/low-stock  → itens com current_stock < minimum_stock (todos)
```

---

## Convenções de API

- Respostas de sucesso: `200 OK` (GET/PUT), `201 Created` (POST), `204 No Content` (DELETE)
- Erros de validação: `400 Bad Request` com lista de campos e mensagens
- Não autorizado: `401 Unauthorized`
- Proibido: `403 Forbidden`
- Não encontrado: `404 Not Found`
- Envelope de resposta padrão:
  ```json
  { "data": { ... } }
  ```
  ou para listas:
  ```json
  { "data": [...], "page": 0, "size": 20, "total": 100 }
  ```

---

## Migrações Flyway (ordem)

```
V1__create_users.sql
V2__create_refresh_tokens.sql
V3__insert_default_owner.sql
V4__create_categories.sql
V5__create_suppliers.sql
V6__create_items.sql
```
