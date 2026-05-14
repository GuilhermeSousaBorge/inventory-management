# Easy Inventory — Sistema de Gestão para Pizzaria

Sistema completo de gerenciamento de estoque, fornecedores, produtos e pedidos para pizzarias. Desenvolvido com arquitetura moderna baseada em microservices (monorepo).

## 🚀 Tecnologias

### Backend
- **Java 21** + Spring Boot 4.0.5
- **Spring Security 6** + JWT (JJWT 0.12.6)
- **Spring Data JPA** + PostgreSQL 16
- **Flyway** (database migrations)
- **SpringDoc OpenAPI 3** (documentação REST)

### Frontend
- **Next.js 16** (App Router)
- **React 19** + TypeScript
- **Tailwind CSS v4**
- **shadcn/ui** + **Radix UI** (primitivas)
- **TanStack Query v5** (server state)
- **React Hook Form** + **Zod** (forms)
- **axios** (HTTP client)
- **Sonner** (toasts)
- **Lucide React** (ícones)
- **Vitest** (testes) + **Biome** (lint/format)

---

## 📁 Estrutura do Projeto

```
inventory-management/
├── backend/                    # API REST Java/Spring Boot
│   ├── docker-compose.yml     # PostgreSQL + pgAdmin
│   └── src/main/java/
│       └── br/com/easy_inventory/management/
│           ├── auth/           # Autenticação JWT
│           ├── user/           # Gerenciamento de usuários
│           ├── unit/           # Unidades físicas
│           ├── category/       # Categorias de ingredientes
│           ├── supplier/       # Fornecedores
│           ├── ingredient/     # Ingredientes
│           ├── product/        # Produtos (cardápio)
│           ├── order/          # Pedidos de clientes
│           ├── stock/          # Estoque
│           ├── movement/       # Movimentações de estoque
│           ├── purchase/       # Ordens de compra
│           ├── notification/   # Notificações
│           ├── audit/          # Logs de auditoria
│           ├── report/         # Relatórios
│           └── shared/         # Utilidades compartilhadas
│
├── frontend/                   # Aplicação Web Next.js
│   ├── app/                   # Páginas e rotas
│   │   └── (protected)/       # Páginas autenticadas
│   │       ├── home/          # Dashboard
│   │       ├── me/            # Perfil do usuário
│   │       ├── users/         # CRUD usuários
│   │       ├── units/         # CRUD unidades
│   │       ├── categories/    # CRUD categorias
│   │       ├── suppliers/     # CRUD fornecedores
│   │       ├── ingredients/   # CRUD ingredientes
│   │       ├── products/      # CRUD produtos
│   │       ├── orders/        # CRUD pedidos
│   │       ├── stock/         # Saldo de estoque
│   │       ├── stock-movements/ # Movimentações
│   │       ├── purchase-orders/ # Ordens de compra
│   │       ├── notifications/ # Central de notificações
│   │       ├── reports/       # Relatórios (vendas, consumo, estoque, desperdício)
│   │       └── audit-logs/    # Trilha de auditoria
│   ├── components/            # Componentes React (shadcn em components/ui)
│   ├── lib/                   # Hooks, queries e utilities
│   └── tests/                 # Testes Vitest
│
└── docs/                      # Especificações e planos
    └── superpowers/
        ├── specs/             # Design documents
        └── plans/             # Implementation plans
```

---

## 🗂️ Módulos do Sistema

### SP1 — Fundação
- **Autenticação**: Login, refresh token, logout (JWT)
- **Usuários**: CRUD, perfil, alteração de senha
- **Unidades**: Unidades físicas da pizzaria
- **Categorias**: Categorias de ingredientes
- **Fornecedores**: Cadastro de fornecedores
- **Ingredientes**: Ingredientes com custo médio

### SP2 — Estoque
- **Stock**: Saldo atual por ingrediente/unidade
- **Stock Movements**: Histórico de entradas, saídas e ajustes
- **Purchase Orders**: Ordens de compra (PENDING → RECEIVED/CANCELED)

### SP3 — Cardápio e Pedidos
- **Products**: Produtos do cardápio com fichas técnicas
- **Orders**: Pedidos de clientes (PENDING → IN_PROGRESS → COMPLETED/CANCELED)

### SP4 — Observabilidade e Relatórios
- **Notifications**: Alertas de estoque baixo, pedidos e eventos do sistema
- **Reports**: Relatórios de vendas, consumo, status de estoque e desperdício
- **Audit Logs**: Trilha de auditoria de mutações em recursos sensíveis

---

## ⚡ Como Executar

### 1. Pré-requisitos
- Docker e Docker Compose
- Node.js 20+ (para frontend)
- Java 21 (para backend)

### 2. Iniciar a infraestrutura

```bash
cd backend
docker-compose up -d
```

Isso inicia:
- PostgreSQL na porta 5432 (DB: `pizzaria`, user: `admin`, senha: `admin`)
- pgAdmin na porta 5050 (login: `admin@admin.com` / `admin`)

### 3. Iniciar o Backend

```bash
cd backend
./mvnw spring-boot:run
```

> No Windows use `mvnw.cmd` no lugar de `./mvnw`.

O backend estará disponível em: `http://localhost:8080`
- Swagger UI: `http://localhost:8080/swagger-ui.html`

### 4. Iniciar o Frontend

```bash
cd frontend
npm install
npm run dev
```

O frontend estará disponível em: `http://localhost:3000`

---

## 🔑 Credenciais para Teste

O Flyway insere automaticamente um usuário OWNER padrão na primeira execução:

| Email | Senha | Perfil |
|-------|-------|--------|
| admin@pizzaria.com | admin123 | OWNER |

> O OWNER tem acesso completo (criar, editar, excluir). Para testar o perfil **EMPLOYEE** (somente leitura), crie um novo usuário pela tela de Usuários — as mutações ficam restritas ao OWNER.

---

## 🔌 Endpoints Principais

### Autenticação
```
POST /auth/login          - Login
POST /auth/refresh        - Refresh token
POST /auth/logout         - Logout
```

### Recursos
```
GET    /users             - Listar usuários (OWNER)
POST   /users             - Criar usuário (OWNER)
GET    /users/me          - Meu perfil

GET    /units             - Listar unidades
POST   /units             - Criar unidade (OWNER)

GET    /ingredients       - Listar ingredientes
POST   /ingredients       - Criar ingrediente (OWNER)

GET    /products          - Listar produtos
POST   /products          - Criar produto (OWNER)

GET    /orders            - Listar pedidos
POST   /orders            - Criar pedido (OWNER)
POST   /orders/{id}/start - Iniciar preparo (baixa estoque)

GET    /stock             - Ver saldo
GET    /stock-movements   - Ver histórico
POST   /stock-movements   - Criar ajuste (OWNER)

GET    /notifications     - Listar notificações
GET    /reports/*         - Relatórios (sales, consumption, stock-status, waste)
GET    /audit-logs        - Trilha de auditoria (OWNER)
```

A documentação completa (com schemas) está no Swagger UI.

---

## 🧪 Executar Testes

### Backend
```bash
cd backend
./mvnw test
```

### Frontend
```bash
cd frontend
npm run test          # roda 1x
npm run test:watch    # watch mode
npm run test:ui       # UI do Vitest
```

---

## 📝 Convenções de Commit

```
feat:     Nova funcionalidade
fix:      Correção de bug
chore:    Tarefa de manutenção
docs:     Documentação
test:     Adição de testes
refactor: Refatoração
```

Exemplo:
```bash
git commit -m "feat(backend): add products CRUD

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 📄 Documentação

As especificações e planos de implementação estão disponíveis em:
- `docs/superpowers/specs/` — Documentos de design
- `docs/superpowers/plans/` — Planos de implementação

---

## 📜 Licença

MIT License
