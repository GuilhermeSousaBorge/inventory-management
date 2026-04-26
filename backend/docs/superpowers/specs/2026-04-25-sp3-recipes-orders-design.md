# SP3 — Receitas & Pedidos — Design

## Visão Geral

Sub-projeto 3 estende SP1 (Fundação) e SP2 (Movimentações) com cardápio de produtos, fichas técnicas (receitas) e pedidos de cliente com baixa automática de estoque. Implementa RF04 (ficha técnica das pizzas) e RF05 (baixa automática ao registrar pedido).

**Goal:** Cadastrar produtos (sabor+tamanho), definir fichas técnicas com ingredientes e quantidades, registrar pedidos de cliente e descontar estoque automaticamente quando a cozinha inicia o preparo.

**Stack:** Mesma de SP1/SP2 — Java 21, Spring Boot 4.0.5, Spring Security 6, JJWT 0.12.6, Spring Data JPA, PostgreSQL 16, Flyway, SpringDoc OpenAPI 3.0.3.

**Dependências:** Tabelas de SP1 (`categories`, `ingredients`, `units`, `users`) e SP2 (`stock`, `stock_movements`) são FKs e serviços reutilizados.

---

## Arquitetura

**Padrão:** Domain-Driven (mesmo de SP1/SP2). Dois pacotes novos em `br.com.easy_inventory.management`:

```
product/           → cardápio e fichas técnicas
  entity/ProductSize.java
  entity/Product.java
  entity/ProductIngredient.java
  repository/ProductRepository.java
  dto/ProductIngredientRequest.java
  dto/ProductIngredientResponse.java
  dto/CreateProductRequest.java
  dto/UpdateProductRequest.java
  dto/ProductResponse.java
  service/ProductService.java
  controller/ProductController.java

order/             → pedidos de cliente com baixa automática
  entity/OrderStatus.java
  entity/Order.java
  entity/OrderItem.java
  repository/OrderRepository.java
  dto/OrderItemRequest.java
  dto/OrderItemResponse.java
  dto/CreateOrderRequest.java
  dto/UpdateOrderRequest.java
  dto/OrderResponse.java
  service/OrderService.java
  controller/OrderController.java
```

**Dependências entre serviços:**
- `ProductService` — autônomo, depende de `IngredientRepository` e `CategoryRepository`
- `OrderService` → `ProductRepository` (carregar fichas técnicas) + `StockService.applyExit()` (baixa automática)

**Invariante central:** A baixa de estoque na transição PENDING → IN_PROGRESS reutiliza `StockService.applyExit()` do SP2, mantendo lock pessimístico e audit trail via `stock_movements` (tipo EXIT). Transação única — falha em qualquer ingrediente faz rollback completo.

---

## Modelo de Produtos

Cada produto representa uma combinação sabor+tamanho (ex: "Margherita G", "Calabresa M"). Produtos distintos têm fichas técnicas independentes — uma Margherita G usa quantidades diferentes de ingredientes que uma Margherita M.

---

## Módulo: Product (`/products`)

### Tabela `products`

| Campo | Tipo | |
|---|---|---|
| id | UUID | PK |
| name | VARCHAR(150) | não nulo |
| size | VARCHAR(20) | não nulo, CHECK IN ('P','M','G','GG') |
| category_id | UUID | FK → categories, opcional |
| price | DECIMAL(10,2) | não nulo |
| description | VARCHAR(255) | opcional |
| active | BOOLEAN | default true |
| created_at | TIMESTAMP | não nulo |

**Constraint:** `UNIQUE (name, size)` — não pode ter "Margherita G" duplicada.

**Índices:** `(category_id)`, `(active)`.

### Tabela `product_ingredients`

| Campo | Tipo | |
|---|---|---|
| id | UUID | PK |
| product_id | UUID | FK → products, ON DELETE CASCADE |
| ingredient_id | UUID | FK → ingredients, não nulo |
| quantity | DECIMAL(10,3) | não nulo, CHECK > 0 |

**Constraint:** `UNIQUE (product_id, ingredient_id)` — sem duplicata de ingrediente na mesma ficha.

**Índice:** `(product_id)`.

### Endpoints

```
GET    /products              → lista; filtros: ?category={id}&size={P|M|G|GG}&active={bool} (todos)
POST   /products              → cria produto com ficha técnica (OWNER)
GET    /products/{id}         → detalhe com ficha técnica (todos)
PUT    /products/{id}         → atualiza produto e substitui ficha técnica (OWNER)
DELETE /products/{id}         → soft delete (OWNER)
```

**CreateProductRequest:**
```json
{
  "name": "Margherita",
  "size": "G",
  "categoryId": "...",
  "price": 45.90,
  "description": "Molho de tomate, mozzarella e manjericão",
  "ingredients": [
    { "ingredientId": "...", "quantity": 0.300 },
    { "ingredientId": "...", "quantity": 0.200 }
  ]
}
```

**ProductResponse:**
```json
{
  "id": "...",
  "name": "Margherita",
  "size": "G",
  "categoryId": "...", "categoryName": "Pizzas Tradicionais",
  "price": 45.90,
  "description": "...",
  "active": true,
  "createdAt": "2026-04-25T12:00:00",
  "ingredients": [
    {
      "id": "...",
      "ingredientId": "...", "ingredientName": "Mozzarella",
      "quantity": 0.300, "unitOfMeasure": "kg"
    }
  ]
}
```

---

## Módulo: Order (`/orders`)

Pedido de cliente. Workflow: **PENDING → IN_PROGRESS → COMPLETED** ou **PENDING → CANCELED**.

### Tabela `orders`

| Campo | Tipo | |
|---|---|---|
| id | UUID | PK |
| unit_id | UUID | FK → units, não nulo |
| status | VARCHAR(20) | não nulo, CHECK IN ('PENDING','IN_PROGRESS','COMPLETED','CANCELED') |
| total_price | DECIMAL(12,2) | não nulo, default 0 |
| notes | VARCHAR(500) | opcional |
| created_by | UUID | FK → users, não nulo |
| started_at | TIMESTAMP | definido ao entrar em IN_PROGRESS |
| completed_at | TIMESTAMP | definido ao completar |
| canceled_at | TIMESTAMP | definido ao cancelar |
| created_at | TIMESTAMP | não nulo |

**Índices:** `(unit_id)`, `(status)`, `(created_at DESC)`.

### Tabela `order_items`

| Campo | Tipo | |
|---|---|---|
| id | UUID | PK |
| order_id | UUID | FK → orders, ON DELETE CASCADE |
| product_id | UUID | FK → products, não nulo |
| quantity | INTEGER | não nulo, CHECK > 0 |
| unit_price | DECIMAL(10,2) | não nulo (captura preço no momento do pedido) |

**Constraint:** `UNIQUE (order_id, product_id)` — mesmo produto aparece uma vez, com `quantity > 1` se for mais de uma unidade.

**Índice:** `(order_id)`.

### Endpoints

```
GET    /orders                    → lista; filtros: ?unit={id}&status={...}&from&to (todos)
GET    /orders/{id}               → detalhe com items (todos)
POST   /orders                    → cria em PENDING (OWNER)
PUT    /orders/{id}               → edita (só PENDING, substitui items) (OWNER)
POST   /orders/{id}/start         → PENDING → IN_PROGRESS + baixa estoque (OWNER)
POST   /orders/{id}/complete      → IN_PROGRESS → COMPLETED (OWNER)
POST   /orders/{id}/cancel        → PENDING → CANCELED (OWNER)
```

**CreateOrderRequest:**
```json
{
  "unitId": "...",
  "notes": "Sem cebola na Calabresa",
  "items": [
    { "productId": "...", "quantity": 2 },
    { "productId": "...", "quantity": 1 }
  ]
}
```

**OrderResponse:**
```json
{
  "id": "...",
  "unitId": "...", "unitName": "Centro",
  "status": "PENDING",
  "totalPrice": 137.70,
  "notes": "Sem cebola na Calabresa",
  "createdById": "...",
  "startedAt": null,
  "completedAt": null,
  "canceledAt": null,
  "createdAt": "2026-04-25T19:30:00",
  "items": [
    {
      "id": "...",
      "productId": "...", "productName": "Margherita G",
      "quantity": 2,
      "unitPrice": 45.90,
      "subtotal": 91.80
    }
  ]
}
```

---

## Baixa Automática de Estoque (RF05)

Implementada na transição `POST /orders/{id}/start` (PENDING → IN_PROGRESS).

### Algoritmo

1. Valida `status == PENDING`
2. Para cada `order_item`:
   - Carrega o `Product` com sua ficha técnica (`product_ingredients`)
   - Para cada `product_ingredient`: calcula `ingredient_qty × order_item.quantity`
3. Agrupa quantidades por `ingredient_id` (caso dois produtos diferentes usem o mesmo ingrediente)
4. Para cada ingrediente agrupado: `stockService.applyExit(ingredientId, order.unitId, totalQty, "Order #" + orderId, actorUserId)`
5. Se qualquer ingrediente tiver saldo insuficiente → `BusinessException` + rollback completo (transação única)
6. `status = IN_PROGRESS`, `started_at = now()`

**Audit trail:** Cada chamada a `applyExit` cria um `stock_movement` do tipo EXIT com reason `"Order #<orderId>"`. Rastreabilidade completa.

---

## Service: responsabilidades

### `ProductService`

```java
Page<ProductResponse> findAll(UUID categoryId, ProductSize size, Boolean active, Pageable pageable);
ProductResponse findById(UUID id);

@Transactional ProductResponse create(CreateProductRequest req);
@Transactional ProductResponse update(UUID id, UpdateProductRequest req);
@Transactional void deactivate(UUID id);
```

### `OrderService`

```java
Page<OrderResponse> findAll(UUID unitId, OrderStatus status,
                            LocalDateTime from, LocalDateTime to, Pageable pageable);
OrderResponse findById(UUID id);

@Transactional OrderResponse create(CreateOrderRequest req, UUID actorUserId);
@Transactional OrderResponse update(UUID id, UpdateOrderRequest req);
@Transactional OrderResponse start(UUID id, UUID actorUserId);
@Transactional OrderResponse complete(UUID id);
@Transactional OrderResponse cancel(UUID id);
```

`start()` é o método mais complexo — orquestra a baixa automática conforme algoritmo acima.

---

## Validação

| Regra | Onde | Exception |
|---|---|---|
| Product precisa ter ≥1 ingrediente na ficha | `@NotEmpty` em `ingredients` | 400 |
| Ingredientes duplicados na ficha | `ProductService.create/update` | `BusinessException` 400 |
| Ingrediente inativo não aceito na ficha | `ProductService.create/update` | `BusinessException` 400 |
| UNIQUE (name, size) violado | DB constraint | `BusinessException` 400 |
| Order precisa ter ≥1 item | `@NotEmpty` em `items` | 400 |
| Produtos duplicados no pedido | `OrderService.create/update` | `BusinessException` 400 |
| Produto inativo não aceito em novo pedido | `OrderService.create` | `BusinessException` 400 |
| Só PENDING pode ser editado | `OrderService.update` | `BusinessException` 400 |
| Só PENDING pode ser started | `OrderService.start` | `BusinessException` 400 |
| Só IN_PROGRESS pode ser completed | `OrderService.complete` | `BusinessException` 400 |
| Só PENDING pode ser canceled | `OrderService.cancel` | `BusinessException` 400 |
| Saldo insuficiente no start | `StockService.applyExit` | `BusinessException` 400 + rollback |
| Product/Ingredient/Unit inexistente | services | `ResourceNotFoundException` 404 |

Reaproveita `GlobalExceptionHandler` de SP1.

---

## Controle de Acesso

| Ação | OWNER | EMPLOYEE |
|---|---|---|
| Listar/detalhar produtos | ✅ | ✅ |
| Criar/editar/desativar produtos | ✅ | ❌ |
| Listar/detalhar pedidos | ✅ | ✅ |
| Criar/editar/start/complete/cancel pedidos | ✅ | ❌ |

Mesma política de SP1/SP2 — mutações restritas a OWNER.

---

## Convenções de API

Mesmas de SP1/SP2:
- 200 (GET/PUT/POST-actions), 201 (POST create), 204 (DELETE soft)
- Envelope `{"data": ...}` para single, `{"data": [...], page, size, total}` para listas
- GETs autenticados (qualquer role), mutações OWNER
- SecurityConfig adiciona permits para GET `/products/**` e `/orders/**`

---

## Migrações Flyway (SP3)

```
V13__create_products.sql
V14__create_product_ingredients.sql
V15__create_orders.sql
V16__create_order_items.sql
```

Uma migration por tabela — consistente com SP1/SP2.

---

## Fora de escopo (SP3)

- **Estorno de estoque em cancelamento** — só PENDING cancela, estoque não foi descontado ainda
- **EMPLOYEE cria pedidos** — mantém OWNER-only por ora, relaxar futuramente
- **Desconto / cupom** — não previsto nos requisitos
- **Mesa / delivery / número do pedido** — pode ser adicionado depois sem quebrar
- **Imagem do produto** — fora do escopo
- **Relatórios de vendas / consumo** — vai para SP4
- **Partial start / preparo parcial** — tudo-ou-nada, como PO receive
- **BaseEntity / @MappedSuperclass** — mantém pattern per-entity dos SPs anteriores
