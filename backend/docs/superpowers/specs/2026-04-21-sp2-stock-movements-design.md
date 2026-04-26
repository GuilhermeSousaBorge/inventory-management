# SP2 — Movimentações de Estoque — Design

## Visão Geral

Sub-projeto 2 estende SP1 (Fundação) com rastreamento de saldo de estoque, histórico imutável de movimentações, ordens de compra com workflow, e cálculo de custo médio ponderado. É o coração operacional do sistema — define como a pizzaria sabe quanto tem de cada ingrediente e quanto custou.

**Goal:** Persistir saldo por (ingrediente × unidade), registrar entradas/saídas/ajustes de forma auditável, e orquestrar ordens de compra que impactam estoque e custo médio.

**Stack:** Mesma de SP1 — Java 21, Spring Boot 4.0.5, Spring Security 6, JJWT 0.12.6, Spring Data JPA, PostgreSQL 16, Flyway, SpringDoc OpenAPI 3.0.3.

**Dependências:** Tabelas de SP1 (`units`, `ingredients`, `suppliers`, `users`) são FKs nos novos schemas.

---

## Arquitetura

**Padrão:** Domain-Driven (mesmo de SP1). Três pacotes novos em `br.com.easy_inventory.management`:

```
stock/           → saldo atual por (ingrediente, unidade)
  entity/Stock.java
  repository/StockRepository.java
  dto/StockResponse.java
  service/StockService.java        ← único writer; dona do invariant
  controller/StockController.java

movement/        → audit log imutável
  entity/StockMovement.java
  entity/MovementType.java         ← enum ENTRY / EXIT / ADJUSTMENT
  repository/StockMovementRepository.java
  dto/MovementResponse.java
  dto/CreateAdjustmentRequest.java
  service/MovementService.java     ← mostly read
  controller/MovementController.java

purchase/        → ordens de compra
  entity/PurchaseOrder.java
  entity/PurchaseOrderItem.java
  entity/PurchaseOrderStatus.java  ← enum PENDING / RECEIVED / CANCELED
  repository/PurchaseOrderRepository.java
  dto/CreatePurchaseOrderRequest.java
  dto/UpdatePurchaseOrderRequest.java
  dto/PurchaseOrderItemRequest.java
  dto/PurchaseOrderResponse.java
  dto/PurchaseOrderItemResponse.java
  service/PurchaseOrderService.java
  controller/PurchaseOrderController.java
```

**Extensões em `shared/`:**
- `shared/security/AuthenticatedUser.java` — helper static para obter o `User` logado via `SecurityContextHolder`.

**Invariante central:** `stock.quantity` e `ingredient.average_cost` sempre mudam juntos, atomicamente, sob lock pessimístico da linha do stock. O único ponto de mutação é `StockService.apply*`.

---

## Controle de Concorrência

**Decisão:** `@Lock(LockModeType.PESSIMISTIC_WRITE)` na query de busca do `stock` antes de escrever.

**Por quê pessimístico em vez de otimístico:**
1. A fórmula de custo médio lê `current_qty` + `current_cost`, calcula e escreve. Duas ENTRY concorrentes sob `@Version` causariam retry loop com risco de perder contribuição de custo.
2. `PurchaseOrder.receive()` é transação batelada (N items). Lock por linha é simples; retry no nível de PO seria confuso.
3. Baixa contenção real (pizzaria, não e-commerce). Lock curto é invisível.
4. Menos código: sem `@Version`, sem handler de `ObjectOptimisticLockingFailureException`, sem Spring Retry.

**Query:**
```java
@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("select s from Stock s where s.ingredient.id = :ingredientId and s.unit.id = :unitId")
Optional<Stock> findForUpdate(@Param("ingredientId") UUID ingredientId,
                              @Param("unitId") UUID unitId);
```

**Upsert race (primeira movimentação para um par ingrediente+unidade):** duas threads chamam `findForUpdate`, ambas recebem `Optional.empty()` e tentam INSERT. `UNIQUE (ingredient_id, unit_id)` garante que uma falha com `DataIntegrityViolationException` — capturar e re-ler (encontra a linha commitada e trava).

---

## Módulo: Stock (`/stock`)

Saldo atual. Sem POST/PUT/DELETE público — só muda via `StockService.apply*` (chamado por PurchaseOrderService e MovementService).

### Tabela `stock`

| Campo | Tipo | |
|---|---|---|
| id | UUID | PK |
| ingredient_id | UUID | FK → ingredients, não nulo |
| unit_id | UUID | FK → units, não nulo |
| quantity | DECIMAL(10,3) | não nulo, default 0 |
| updated_at | TIMESTAMP | não nulo |

**Constraint:** `UNIQUE (ingredient_id, unit_id)`.

### Endpoints

```
GET  /stock                → lista saldos; filtros: ?unit={id}&ingredient={id} (todos)
GET  /stock/{id}           → detalhe (todos)
GET  /stock/low            → saldos abaixo do mínimo do ingrediente (todos)
```

**StockResponse:**
```json
{
  "id": "...",
  "ingredientId": "...", "ingredientName": "Mozzarella",
  "unitId": "...",       "unitName": "Centro",
  "quantity": 12.500,
  "minimumQty": 5.000,
  "belowMinimum": false,
  "averageCost": 23.4500,
  "updatedAt": "2026-04-21T12:00:00"
}
```

---

## Módulo: Movement (`/stock-movements`)

Audit log imutável de toda mutação de estoque.

### Tabela `stock_movements`

| Campo | Tipo | |
|---|---|---|
| id | UUID | PK |
| ingredient_id | UUID | FK → ingredients, não nulo |
| unit_id | UUID | FK → units, não nulo |
| type | VARCHAR(20) | não nulo, CHECK IN ('ENTRY','EXIT','ADJUSTMENT') |
| quantity | DECIMAL(10,3) | não nulo, sempre positivo |
| unit_price | DECIMAL(10,4) | obrigatório se type='ENTRY', senão NULL |
| reason | VARCHAR(255) | obrigatório se type='ADJUSTMENT' |
| purchase_order_id | UUID | FK → purchase_orders, opcional |
| created_by | UUID | FK → users, não nulo |
| created_at | TIMESTAMP | não nulo |

**Índices:** `(ingredient_id, unit_id, created_at DESC)`, `(purchase_order_id)`.

**Por quê quantity sempre positivo:** sinal é derivado do `type`, mantém agregações legíveis (`SUM(CASE WHEN type='ENTRY' THEN quantity ELSE -quantity END)`).

### Endpoints

```
GET  /stock-movements        → histórico; filtros: ?ingredient&unit&type&from&to (todos)
GET  /stock-movements/{id}   → detalhe (todos)
POST /stock-movements        → cria ADJUSTMENT (OWNER)
```

**Nenhum PUT/DELETE** — movimentos são imutáveis (audit).

**CreateAdjustmentRequest:**
```json
{
  "ingredientId": "...",
  "unitId": "...",
  "quantity": 5.000,
  "direction": "INCREASE",   // ou "DECREASE"
  "reason": "Devolução ao fornecedor X"
}
```

`direction` é enum `AdjustmentDirection` (INCREASE/DECREASE). `quantity` sempre positivo.

---

## Módulo: Purchase Order (`/purchase-orders`)

Ordem de compra de insumos a fornecedor. Workflow: PENDING → RECEIVED / CANCELED.

### Tabela `purchase_orders`

| Campo | Tipo | |
|---|---|---|
| id | UUID | PK |
| supplier_id | UUID | FK → suppliers, não nulo |
| unit_id | UUID | FK → units, não nulo (destino) |
| status | VARCHAR(20) | não nulo, CHECK IN ('PENDING','RECEIVED','CANCELED') |
| total_cost | DECIMAL(12,4) | não nulo, default 0 |
| notes | VARCHAR(500) | opcional |
| expected_at | DATE | opcional |
| received_at | TIMESTAMP | definido no receive |
| canceled_at | TIMESTAMP | definido no cancel |
| created_by | UUID | FK → users, não nulo |
| created_at | TIMESTAMP | não nulo |

### Tabela `purchase_order_items`

| Campo | Tipo | |
|---|---|---|
| id | UUID | PK |
| purchase_order_id | UUID | FK → purchase_orders, ON DELETE CASCADE |
| ingredient_id | UUID | FK → ingredients, não nulo |
| quantity | DECIMAL(10,3) | não nulo |
| unit_price | DECIMAL(10,4) | não nulo, capturado na criação do PO |

**Constraint:** `UNIQUE (purchase_order_id, ingredient_id)` — sem linhas duplicadas para o mesmo ingrediente.

### Endpoints

```
GET    /purchase-orders                    → lista; filtros ?status&supplier&unit&from&to (todos)
GET    /purchase-orders/{id}               → detalhe com items (todos)
POST   /purchase-orders                    → cria em PENDING (OWNER)
PUT    /purchase-orders/{id}               → edita (só PENDING, substitui items) (OWNER)
POST   /purchase-orders/{id}/receive       → PENDING → RECEIVED (OWNER)
POST   /purchase-orders/{id}/cancel        → PENDING → CANCELED (OWNER)
```

**CreatePurchaseOrderRequest:**
```json
{
  "supplierId": "...",
  "unitId": "...",
  "notes": "Compra semanal",
  "expectedAt": "2026-04-28",
  "items": [
    { "ingredientId": "...", "quantity": 50.0, "unitPrice": 12.50 },
    { "ingredientId": "...", "quantity": 10.0, "unitPrice": 28.00 }
  ]
}
```

**Receive workflow:**
1. Valida `status == PENDING`
2. Para cada item: `stockService.applyEntry(ingredient, unit, qty, unitPrice, poId, actor)`
3. `status = RECEIVED`, `received_at = now()`
4. Transação única — falha em qualquer item faz rollback completo

---

## Endpoint de baixo estoque (reativa RF da SP1)

`GET /stock/low` retorna todas as linhas de stock onde `quantity < ingredient.minimum_qty`. Implementado via JPQL join entre `Stock` e `Ingredient`. Mora no módulo stock (não em ingredient), porque a condição é per-(ingredient, unit), não per-ingredient global.

---

## Service: responsabilidades

### `StockService` — único writer

```java
// READ
Page<StockResponse> findAll(UUID unitId, UUID ingredientId, Pageable pageable);
StockResponse findById(UUID id);
Page<StockResponse> findBelowMinimum(Pageable pageable);

// WRITE — chamados por PurchaseOrderService e MovementService
@Transactional
void applyEntry(UUID ingredientId, UUID unitId,
                BigDecimal quantity, BigDecimal unitPrice,
                UUID purchaseOrderId, UUID actorUserId);

@Transactional
void applyExit(UUID ingredientId, UUID unitId,
               BigDecimal quantity, String reason, UUID actorUserId);

@Transactional
StockMovement applyAdjustment(UUID ingredientId, UUID unitId,
                              BigDecimal quantity, AdjustmentDirection direction,
                              String reason, UUID actorUserId);
```

**`applyEntry` algoritmo:**
1. Lock pessimístico (`findForUpdate`) no `stock`; se não existe, cria (com tratamento de unique violation race).
2. Carrega `Ingredient` (atualiza `averageCost`).
3. Calcula:
   ```
   newQty    = currentQty + entryQty
   newAvgCost = (currentQty × currentAvgCost + entryQty × unitPrice) / newQty
              (round HALF_UP, scale 4)
   ```
4. `stock.quantity = newQty`, `stock.updatedAt = now`.
5. `ingredient.averageCost = newAvgCost`.
6. Insere `StockMovement` (type=ENTRY, quantity, unitPrice, purchaseOrderId, createdBy).

**Edge case — primeira entrada (currentQty = 0):** `newAvgCost = unitPrice` (fórmula degenera corretamente).

**`applyExit`:** lock, validar `currentQty ≥ quantity`, decrementa, cria movement EXIT. **Não toca averageCost.**

**`applyAdjustment`:** lock, aplica delta conforme `direction`:
- INCREASE: `newQty = currentQty + quantity`; não recalcula avg_cost (sem unit_price)
- DECREASE: valida saldo, `newQty = currentQty - quantity`

Cria movement ADJUSTMENT com `reason`.

### `PurchaseOrderService` — orquestrador

```java
Page<PurchaseOrderResponse> findAll(PurchaseOrderStatus status, UUID supplierId, UUID unitId,
                                     LocalDate from, LocalDate to, Pageable pageable);
PurchaseOrderResponse findById(UUID id);

@Transactional PurchaseOrderResponse create(CreatePurchaseOrderRequest req, UUID actorUserId);
@Transactional PurchaseOrderResponse update(UUID id, UpdatePurchaseOrderRequest req);
@Transactional PurchaseOrderResponse receive(UUID id, UUID actorUserId);
@Transactional PurchaseOrderResponse cancel(UUID id);
```

`receive()` itera items e chama `stockService.applyEntry` para cada — transação REQUIRED garante atomicidade.

### `MovementService` — quase só leitura

```java
Page<MovementResponse> findAll(UUID ingredientId, UUID unitId, MovementType type,
                               LocalDateTime from, LocalDateTime to, Pageable pageable);
MovementResponse findById(UUID id);

@Transactional
MovementResponse createAdjustment(CreateAdjustmentRequest req, UUID actorUserId);
// ↑ delega para stockService.applyAdjustment
```

---

## Validação

| Regra | Onde | Exception |
|---|---|---|
| PO deve ser PENDING para receive/cancel/update | `PurchaseOrderService` | `BusinessException` 400 |
| PO precisa ter ≥1 item | `@NotEmpty` em `items` | 400 |
| Ingredientes duplicados em PO | `PurchaseOrderService.create/update` | `BusinessException` 400 |
| EXIT: saldo ≥ quantidade | `StockService.applyExit` | `BusinessException` 400 |
| ADJUSTMENT DECREASE: saldo não fica negativo | `StockService.applyAdjustment` | `BusinessException` 400 |
| `reason` obrigatório em ADJUSTMENT | `@NotBlank` em DTO | 400 |
| Ingrediente/fornecedor inativo não aceito em PO nova | `PurchaseOrderService.create` | `BusinessException` 400 |
| Ingrediente/unidade/fornecedor inexistentes | services | `ResourceNotFoundException` 404 |

Reaproveita `GlobalExceptionHandler` de SP1.

---

## Actor Tracking

`stock_movements.created_by` e `purchase_orders.created_by` precisam do UUID do usuário logado.

**Solução:** `shared/security/AuthenticatedUser.java` utility:

```java
public final class AuthenticatedUser {
    private AuthenticatedUser() {}
    public static User current() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof User user)) {
            throw new IllegalStateException("No authenticated user in context");
        }
        return user;
    }
    public static UUID currentId() { return current().getId(); }
}
```

Chamado nos controllers (para passar ao service) ou diretamente no service.

---

## Convenções de API

Mesmas de SP1:
- 200 (GET/PUT/POST-actions), 201 (POST create), 204 (cancel via POST action retorna 200 com response; DELETE não existe aqui)
- Envelope `{"data": ...}` para single, `{"data": [...], page, size, total}` para listas
- GETs autenticados (qualquer role), mutações OWNER
- SecurityConfig adiciona permits públicos para GET `/stock/**`, `/stock-movements/**`, `/purchase-orders/**`

---

## Migrações Flyway (SP2)

```
V9__create_stock.sql
V10__create_stock_movements.sql
V11__create_purchase_orders.sql
V12__create_purchase_order_items.sql
```

Uma migration por tabela — consistente com SP1.

---

## Fora de escopo (SP2)

- **RETURN como tipo de movimento** — usar ADJUSTMENT com `reason` descritivo
- **Optimistic locking / @Version** — pessimistic resolve
- **Baixa automática de estoque por pedido de cliente** — vai para SP3
- **FIFO / LIFO / COGS** — apenas custo médio ponderado
- **Partial receipt de PO** — tudo-ou-nada
- **Notificações de estoque baixo** — só query; notificação fica em SP4
- **BaseEntity / @MappedSuperclass** — mantém pattern per-entity de SP1
- **Hard delete de PO** — `cancel` cobre o caso
