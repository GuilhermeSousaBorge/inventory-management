# Inventory Management — Design Completo do Sistema

## Visão Geral

Sistema de gestão de estoque para pizzaria, desenvolvido em 4 sub-projetos incrementais. Cada sub-projeto produz software testável e funcional de forma independente.

---

## Mapa de Tabelas (12 tabelas + 2 auxiliares)

Extraído do diagrama `mapa_tabelas_pizzaria.svg`:

| Domínio | Tabelas | Sub-projeto |
|---|---|---|
| **Acesso** | `users`, `units`, `refresh_tokens` | SP1 |
| **Cardápio** | `products`, `ingredients`, `product_ingredients` | SP1 (ingredients/categories/suppliers) + SP3 (products/product_ingredients) |
| **Estoque** | `stock`, `stock_movements`, `suppliers` | SP1 (suppliers) + SP2 (stock/stock_movements) |
| **Pedidos** | `orders`, `order_items`, `purchase_orders` | SP3 (orders/order_items) + SP2 (purchase_orders) |
| **Auditoria** | `audit_logs`, `notifications` | SP4 |

**Tabelas auxiliares:** `categories`, `refresh_tokens`

---

## Requisitos Funcionais

Extraídos do diagrama `requisitos_gerenciador_estoque_pizzaria.svg`:

| Código | Requisito | Sub-projeto |
|---|---|---|
| RF01 | Cadastro de ingredientes (nome, unidade, qtd mínima, categoria) | SP1 |
| RF02 | Entrada e saída de estoque (compras e consumo por pedido) | SP2 |
| RF03 | Alerta de estoque baixo (notificar quando atingir qtd mínima) | SP4 |
| RF04 | Ficha técnica das pizzas (ingredientes e qtd por tamanho) | SP3 |
| RF05 | Baixa automática (descontar estoque ao registrar pedido) | SP3 |
| RF06 | Histórico e relatórios (movimentações por período, desperdício) | SP4 |
| RF07 | Controle de acesso por perfil (admin, gerente, atendente) | SP1 |
| RF08 | Previsão de compras (sugerir reposição com base no consumo) | SP4 |

## Requisitos Não Funcionais

| Código | Requisito | Impacto no design |
|---|---|---|
| RNF01 | Usabilidade — interface simples, web-first (mobile secondary) | API REST com paginação e filtros claros |
| RNF02 | Desempenho — resposta abaixo de 2s | Índices em FKs e campos de filtro; sem N+1 |
| RNF03 | Disponibilidade offline *(ver nota abaixo)* | Fora do escopo do backend por ora |
| RNF04 | Segurança — JWT + BCrypt | Implementado em SP1 |
| RNF05 | Escalabilidade — suportar múltiplas unidades | Tabela `units` em SP1; lógica multi-unidade futura |
| RNF06 | Auditoria — log de todas as alterações | `audit_logs` em SP4 |
| RNF07 | Manutenibilidade — código modular | Arquitetura domain-driven (SP1+) |
| RNF08 | Backup automático diário | Responsabilidade de infra/deploy, fora do código |

> **RNF03 — Offline:** Funcionalidade offline é responsabilidade do frontend (PWA/service worker). O backend contribui com APIs idempotentes e suporte a sincronização — isso será endereçado quando o frontend for desenvolvido.

---

## Sub-projetos

| # | Escopo | Tabelas criadas |
|---|---|---|
| **SP1 — Fundação** *(este)* | Auth, perfis, unidades físicas, ingredientes, categorias, fornecedores | users, refresh_tokens, units, categories, ingredients, suppliers |
| **SP2 — Movimentações** | Estoque atual, entradas/saídas/devoluções, ordens de compra | stock, stock_movements, purchase_orders |
| **SP3 — Receitas & Pedidos** | Cardápio, fichas técnicas, pedidos, baixa automática | products, product_ingredients, orders, order_items |
| **SP4 — Alertas & Relatórios** | Estoque baixo, email/WhatsApp, relatórios, previsão, auditoria | audit_logs, notifications |

---

# Sub-projeto 1: Fundação

**Goal:** Estabelecer a base do sistema — autenticação JWT, controle de acesso por perfil, unidades físicas da pizzaria e cadastro de ingredientes, categorias e fornecedores.

**Stack:** Java 21, Spring Boot 4, Spring Security + JJWT 0.12.6, Spring Data JPA, PostgreSQL 16, Flyway, SpringDoc OpenAPI 2.5.0.

---

## Arquitetura

**Padrão:** Domain-Driven Organization — pacotes por domínio, não por camada técnica.

```
br.com.easy_inventory.management/
  auth/           → autenticação JWT (login, refresh, logout)
  user/           → gerenciamento de usuários
  unit/           → unidades físicas da pizzaria
  category/       → categorias de ingredientes
  ingredient/     → ingredientes/insumos do estoque
  supplier/       → fornecedores
  shared/         → exceptions, response envelope, config, security filter
```

Cada domínio contém: entidade JPA, repository, service, controller, DTOs de request/response.

**Segurança:** JWT stateless. Nenhum estado de sessão no servidor.

**Schema:** gerenciado exclusivamente por migrações Flyway (`V{n}__{descricao}.sql`).

---

## Perfis de Acesso

O SVG menciona 3 perfis (admin, gerente, atendente). No SP1 implementamos 2 perfis — OWNER e EMPLOYEE — suficientes para os casos de uso imediatos. Um terceiro perfil MANAGER pode ser adicionado sem quebrar o sistema quando necessário.

| Ação | OWNER | EMPLOYEE |
|---|---|---|
| Login / Refresh | ✅ | ✅ |
| Ver próprio perfil / trocar senha | ✅ | ✅ |
| Gerenciar usuários | ✅ | ❌ |
| Gerenciar unidades | ✅ | ❌ |
| Leitura de ingredientes, categorias, fornecedores | ✅ | ✅ |
| Criar/editar/excluir ingredientes, categorias, fornecedores | ✅ | ❌ |

O primeiro usuário OWNER é criado via migration Flyway — não existe rota de registro público.

---

## Módulo: Auth (`/auth`)

### Endpoints

```
POST /auth/login    → {email, password} → {accessToken, refreshToken}
POST /auth/refresh  → {refreshToken} → {accessToken}
POST /auth/logout   → invalida o refresh token
```

### Tokens
- **Access token:** validade 8h, claims: userId, email, role
- **Refresh token:** validade 7 dias, armazenado em `refresh_tokens` (tokenHash, userId, expiresAt, revoked)

### Logout
O refresh token é marcado como `revoked = true`. Access tokens expiram naturalmente.

---

## Módulo: Usuários (`/users`)

### Tabela `users`

| Campo | Tipo | |
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
POST   /users           → cria (OWNER)
GET    /users/{id}      → detalhe (OWNER)
PUT    /users/{id}      → atualiza nome, email, role, active (OWNER)
DELETE /users/{id}      → desativa — soft delete (OWNER)
GET    /users/me        → perfil próprio (todos)
PUT    /users/me/password → {currentPassword, newPassword} (todos)
```

---

## Módulo: Unidades (`/units`)

Representa as unidades físicas da pizzaria. Incluída em SP1 como fundação — necessária para `orders` (SP3) e `stock` (SP2) referenciarem a localização correta.

### Tabela `units`

| Campo | Tipo | |
|---|---|---|
| id | UUID | PK |
| name | VARCHAR(100) | não nulo |
| address | VARCHAR(255) | opcional |
| active | BOOLEAN | default true |
| created_at | TIMESTAMP | não nulo |

### Endpoints

```
GET    /units        → lista todas (todos)
POST   /units        → cria (OWNER)
GET    /units/{id}   → detalhe (todos)
PUT    /units/{id}   → atualiza (OWNER)
DELETE /units/{id}   → desativa — soft delete (OWNER)
```

---

## Módulo: Categorias (`/categories`)

### Tabela `categories`

| Campo | Tipo | |
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
DELETE /categories/{id}  → remove se sem ingredientes vinculados (OWNER)
```

---

## Módulo: Fornecedores (`/suppliers`)

### Tabela `suppliers`

| Campo | Tipo | |
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
DELETE /suppliers/{id}   → desativa — soft delete (OWNER)
```

Fornecedor desativado não pode ser selecionado em novas entradas. Histórico preservado.

---

## Módulo: Ingredientes (`/ingredients`)

O SVG usa o nome `ingredients` para os itens de estoque da pizzaria. Inclui tanto matérias-primas como embalagens e bebidas — tudo que é controlado no estoque. O campo `current_stock` não existe aqui; a quantidade atual é gerenciada pela tabela `stock` (SP2), que relaciona ingredient + unit (localização) + qty.

### Tabela `ingredients`

| Campo | Tipo | |
|---|---|---|
| id | UUID | PK |
| name | VARCHAR(150) | não nulo |
| description | VARCHAR(255) | opcional |
| category_id | UUID | FK → categories |
| unit_of_measure | ENUM('kg','g','L','ml','un','cx') | não nulo |
| minimum_qty | DECIMAL(10,3) | não nulo |
| average_cost | DECIMAL(10,4) | calculado, default 0 |
| expiry_date | DATE | opcional |
| default_supplier_id | UUID | FK → suppliers, opcional |
| active | BOOLEAN | default true |
| created_at | TIMESTAMP | não nulo |

> **Nota:** `average_cost` é recalculado no SP2 a cada entrada de estoque usando a fórmula de custo médio ponderado:
> ```
> novo_custo = (qtd_atual × custo_atual + qtd_entrada × preço_unitário) / (qtd_atual + qtd_entrada)
> ```

### Endpoints

```
GET    /ingredients            → lista todos; filtros: ?category={id}&active={bool} (todos)
POST   /ingredients            → cria (OWNER)
GET    /ingredients/{id}       → detalhe (todos)
PUT    /ingredients/{id}       → atualiza (OWNER)
DELETE /ingredients/{id}       → desativa — soft delete (OWNER)
GET    /ingredients/low-stock  → ingredientes abaixo do mínimo — lê tabela stock (todos)
```

---

## Convenções de API

- `200 OK` (GET/PUT), `201 Created` (POST), `204 No Content` (DELETE)
- `400` com lista de erros de validação, `401` não autenticado, `403` sem permissão, `404` não encontrado
- Envelope de resposta:
  ```json
  { "data": { ... } }
  ```
  ou listas:
  ```json
  { "data": [...], "page": 0, "size": 20, "total": 100 }
  ```

---

## Migrações Flyway (SP1)

```
V1__create_users.sql
V2__create_refresh_tokens.sql
V3__create_units.sql
V4__insert_default_unit.sql
V5__insert_default_owner.sql
V6__create_categories.sql
V7__create_suppliers.sql
V8__create_ingredients.sql
```
