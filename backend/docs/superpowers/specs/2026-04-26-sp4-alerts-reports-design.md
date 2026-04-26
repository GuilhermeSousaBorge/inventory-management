# SP4 — Alertas, Relatórios & Auditoria — Design

## Visão Geral

Sub-projeto 4 estende SP1/SP2/SP3 com três capacidades transversais: notificações de estoque baixo (RF03), relatórios operacionais (RF06) e auditoria de mutações sensíveis (RNF06). **Previsão de compras (RF08)** sai do escopo deste SP e fica para um SP5 dedicado.

**Goal:** Detectar e notificar estoque abaixo do mínimo automaticamente, expor relatórios agregados (consumo, vendas, desperdício, status de estoque) e registrar histórico imutável das mutações relevantes do sistema.

**Stack:** Mesma de SP1/SP2/SP3 — Java 21, Spring Boot 4.0.5, Spring Security 6, JJWT 0.12.6, Spring Data JPA, PostgreSQL 16, Flyway, SpringDoc OpenAPI 3.0.3.

**Dependências:** Tabelas de SP1 (`users`, `units`, `ingredients`, `categories`), SP2 (`stock`, `stock_movements`) e SP3 (`products`, `product_ingredients`, `orders`, `order_items`) são consumidas por listeners, queries de relatório e instrumentação de auditoria.

**Fora de escopo do SP4:**
- Previsão de compras (RF08) — vai para SP5
- Canais externos de notificação (email, WhatsApp) — só in-app no SP4; tabela `notifications` fica preparada para um worker externo futuro
- Exportação CSV/PDF dos relatórios — frontend exporta a partir do JSON

---

## Arquitetura

**Padrão:** Domain-Driven (mesmo de SP1/SP2/SP3). Três pacotes novos em `br.com.easy_inventory.management`:

```
notification/      → alertas in-app de estoque baixo
  entity/NotificationType.java
  entity/NotificationStatus.java
  entity/Notification.java
  repository/NotificationRepository.java
  dto/NotificationResponse.java
  service/NotificationService.java
  listener/StockLevelListener.java
  controller/NotificationController.java

report/            → leituras agregadas (sem entidades novas)
  dto/ConsumptionReportRow.java
  dto/SalesReportRow.java
  dto/WasteReportRow.java
  dto/StockStatusRow.java
  service/ReportService.java
  controller/ReportController.java

audit/             → log central imutável de mutações sensíveis
  entity/AuditAction.java
  entity/AuditLog.java
  repository/AuditLogRepository.java
  dto/AuditLogResponse.java
  service/AuditService.java
  controller/AuditLogController.java

shared/event/
  StockChangedEvent.java
```

**Modificações em módulos existentes:**

- `stock/StockService` — ganha `ApplicationEventPublisher` no construtor; ao final de `applyEntry/applyExit/applyAdjustment` publica `StockChangedEvent`. Também ganha `AuditService` e audita os três métodos.
- `stock/entity/StockMovement` + `stock/dto/MovementResponse` + `StockService.applyAdjustment` — passam a persistir e expor `AdjustmentDirection` (ver "Schema enhancement V17").
- `user/UserService`, `unit/UnitService`, `ingredient/IngredientService`, `product/ProductService`, `purchase/PurchaseOrderService`, `order/OrderService` — injetam `AuditService` e chamam `auditService.log(...)` nas mutações listadas em "Pontos de instrumentação".
- Vários services (`UserService.update/deactivate/changeRole`, `UnitService.update/deactivate`, `IngredientService.update/deactivate`, `ProductService.create/update/deactivate`, `PurchaseOrderService.create/receive/cancel`) recebem `actorUserId` como parâmetro adicional para registro do autor — alteração mecânica nos controllers passando `AuthenticatedUser.currentId()`.
- `shared/security/SecurityConfig` — abre GETs de `/notifications`, `/reports/**` para autenticados; `/audit-logs` exige OWNER (via `@PreAuthorize` no controller).

**Dependências entre serviços novos:**
- `NotificationService` ← consumido por `StockLevelListener` via `@TransactionalEventListener(phase = AFTER_COMMIT)`
- `ReportService` → reusa repositórios existentes (`StockMovementRepository`, `OrderRepository`, `StockRepository`, `IngredientRepository`)
- `AuditService` → injetado em ~7 services existentes, chamada explícita

**Invariante central de notificação:** o `StockLevelListener` roda apenas após o commit da transação que alterou o estoque (`AFTER_COMMIT`). Rollback (ex: saldo insuficiente em `applyExit`) descarta o evento. Dedup é garantida por **índice único parcial** no banco — a aplicação trata `DataIntegrityViolationException` como "alerta já ativo, ignorar".

**Invariante central de auditoria:** `AuditService.log(...)` participa da **mesma transação** do service que o invocou — se a operação rolhar, o log também rolha (consistência forte). Sem `REQUIRES_NEW`, sem listener — chamada explícita rastreável via `git grep`.

---

## Schema enhancement V17 — `stock_movements.direction`

Antes das tabelas novas, SP4 adiciona uma coluna ao SP2 para tornar o relatório de waste possível e a auditoria de ajuste mais informativa.

**Problema:** `StockService.applyAdjustment` recebe `AdjustmentDirection.INCREASE | DECREASE` mas não persiste essa direção em `stock_movements`. Após o save, é impossível distinguir um ajuste positivo (recontagem) de um ajuste negativo (perda).

**Migration V17:**

```sql
ALTER TABLE stock_movements
  ADD COLUMN direction VARCHAR(10) CHECK (direction IN ('INCREASE','DECREASE'));
```

- `direction` é **nullable** — ENTRY/EXIT mantêm `NULL` (direção implícita pelo `type`); apenas `ADJUSTMENT` futuro grava `INCREASE` ou `DECREASE`.
- Linhas `ADJUSTMENT` pré-existentes ficam com `NULL` (banco está em desenvolvimento, sem dados reais a backfillar). Relatório de waste **ignora** ajustes com `direction IS NULL`.

**Mudanças associadas no código:**
- `StockMovement` entity ganha `@Enumerated(STRING) @Column AdjustmentDirection direction;`
- `StockService.applyAdjustment` grava `mv.setDirection(direction)`
- `MovementResponse` DTO inclui `direction` no payload (null para ENTRY/EXIT)

---

## Tabelas novas

### V18 — `notifications`

| Campo | Tipo | |
|---|---|---|
| id | UUID | PK |
| type | VARCHAR(30) | não nulo, CHECK IN ('LOW_STOCK') — extensível |
| status | VARCHAR(20) | não nulo, CHECK IN ('ACTIVE','RESOLVED'), default 'ACTIVE' |
| ingredient_id | UUID | FK → ingredients, não nulo |
| unit_id | UUID | FK → units, não nulo |
| message | VARCHAR(255) | não nulo |
| triggered_quantity | DECIMAL(12,3) | não nulo (snapshot no momento do disparo) |
| min_quantity | DECIMAL(12,3) | não nulo (snapshot no momento) |
| created_at | TIMESTAMP | não nulo, default NOW() |
| resolved_at | TIMESTAMP | nulo até resolução |
| resolved_by | UUID | FK → users, nulo (preenchido só em resolução manual; resolução automática deixa NULL) |

**Índices:**
- `(status, created_at DESC)` — listagem do sino de alertas
- `(ingredient_id, unit_id, status)` — lookup rápido pelo listener

**Constraint chave (dedup):** índice único parcial garantindo no máximo uma notificação ACTIVE por (ingredient_id, unit_id, type):

```sql
CREATE UNIQUE INDEX uq_notification_active_per_ingredient_unit
  ON notifications(ingredient_id, unit_id, type)
  WHERE status = 'ACTIVE';
```

Protege contra race condition entre dois movimentos commitados quase simultaneamente — o segundo `INSERT` viola o índice e o listener trata como "alerta já ativo".

---

### V19 — `audit_logs`

| Campo | Tipo | |
|---|---|---|
| id | UUID | PK |
| action | VARCHAR(40) | não nulo, valor do enum `AuditAction` |
| entity_type | VARCHAR(40) | não nulo, ex: 'Product', 'Ingredient', 'Order', 'StockMovement' |
| entity_id | UUID | não nulo |
| actor_id | UUID | FK → users, não nulo |
| details | JSONB | nulo, payload livre `{ before: {...}, after: {...} }` ou `{ ... contexto ... }` |
| created_at | TIMESTAMP | não nulo, default NOW() |

**Índices:**
- `(entity_type, entity_id, created_at DESC)` — "histórico de mudanças no Produto X"
- `(actor_id, created_at DESC)` — "tudo que o usuário Y fez"
- `(created_at DESC)` — listagem cronológica geral

JSONB nativo do Postgres + Hibernate `@JdbcTypeCode(SqlTypes.JSON)` — sem lib extra.

---

### Migrações Flyway (SP4)

```
V17__alter_stock_movements_add_direction.sql
V18__create_notifications.sql
V19__create_audit_logs.sql
```

---

## Módulo: Notification (`/notifications`)

### Evento

```java
// shared/event/StockChangedEvent.java
public record StockChangedEvent(
    UUID ingredientId,
    UUID unitId,
    BigDecimal newQuantity,
    BigDecimal minQuantity
) {}
```

### Publicação

`StockService` recebe `ApplicationEventPublisher` no construtor. Ao final de `applyEntry/applyExit/applyAdjustment` (após o `save` do `Stock` e do `StockMovement`):

```java
publisher.publishEvent(new StockChangedEvent(
    ingredientId, unitId, stock.getQuantity(),
    ingredient.getMinQuantity()
));
```

Publicado **dentro** da transação. Spring entrega só após commit por causa do `@TransactionalEventListener(AFTER_COMMIT)` no listener.

### Listener

```java
// notification/listener/StockLevelListener.java
@Component
class StockLevelListener {
    private final NotificationService notificationService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onStockChanged(StockChangedEvent ev) {
        if (ev.newQuantity().compareTo(ev.minQuantity()) <= 0) {
            notificationService.raiseLowStock(ev);
        } else {
            notificationService.autoResolveLowStock(ev.ingredientId(), ev.unitId());
        }
    }
}
```

### `NotificationService` — comportamento

```java
@Transactional(propagation = REQUIRES_NEW)
public void raiseLowStock(StockChangedEvent ev) {
    try {
        Notification n = new Notification(
            NotificationType.LOW_STOCK,
            ev.ingredientId(), ev.unitId(),
            buildMessage(ev),
            ev.newQuantity(), ev.minQuantity()
        );
        repo.save(n);
    } catch (DataIntegrityViolationException e) {
        // índice único parcial: já existe ACTIVE pra esse (ingredient, unit, type) → silencia
    }
}

@Transactional(propagation = REQUIRES_NEW)
public void autoResolveLowStock(UUID ingredientId, UUID unitId) {
    repo.findActiveByIngredientAndUnit(ingredientId, unitId, NotificationType.LOW_STOCK)
        .ifPresent(n -> {
            n.setStatus(RESOLVED);
            n.setResolvedAt(LocalDateTime.now());
            // resolved_by fica null = resolução automática
        });
}

@Transactional
public NotificationResponse resolveManually(UUID notificationId, UUID actorUserId) {
    Notification n = getOrThrow(notificationId);
    if (n.getStatus() != ACTIVE)
        throw new BusinessException("Notification is not active");
    n.setStatus(RESOLVED);
    n.setResolvedAt(LocalDateTime.now());
    n.setResolvedBy(userRepo.getReferenceById(actorUserId));
    return NotificationResponse.from(n);
}

public Page<NotificationResponse> findAll(NotificationStatus status, UUID unitId,
                                          LocalDateTime from, LocalDateTime to,
                                          Pageable pageable) { ... }
public NotificationResponse findById(UUID id) { ... }
```

**Por que `REQUIRES_NEW`:** `@TransactionalEventListener(AFTER_COMMIT)` roda fora de qualquer transação ativa; sem `REQUIRES_NEW` o `save` ficaria em auto-commit. `REQUIRES_NEW` cria uma transação curta dedicada à criação/resolução da notificação.

**Mensagem padrão:** `"<ingredientName> abaixo do mínimo na unidade <unitName>: <triggeredQuantity> <unitOfMeasure> ≤ <minQuantity> <unitOfMeasure>"`.

### Endpoints

```
GET    /notifications                       lista; filtros: ?status={ACTIVE|RESOLVED}&unit={id}&from&to (auth)
GET    /notifications/{id}                  detalhe (auth)
POST   /notifications/{id}/resolve          marca como resolvido manualmente (OWNER)
```

Sem `POST /notifications` — notificações nascem só do listener, nunca via API.

**NotificationResponse:**
```json
{
  "id": "...",
  "type": "LOW_STOCK",
  "status": "ACTIVE",
  "ingredientId": "...", "ingredientName": "Mozzarella",
  "unitId": "...", "unitName": "Centro",
  "message": "Mozzarella abaixo do mínimo na unidade Centro: 0.500 kg ≤ 1.000 kg",
  "triggeredQuantity": 0.500,
  "minQuantity": 1.000,
  "createdAt": "2026-04-26T18:30:00",
  "resolvedAt": null,
  "resolvedBy": null
}
```

---

## Módulo: Report (`/reports`)

Quatro endpoints `GET` retornando JSON agregado. Sem entidades novas — `ReportService` faz queries diretamente nos repositórios existentes via `@Query` JPQL ou nativa quando agregação for melhor em SQL puro. Sem paginação — relatórios retornam lista completa do filtro (volume esperado é baixo).

### `GET /reports/consumption?from&to&unit&ingredient`

Soma `EXIT` de `stock_movements` por ingrediente no período.

```sql
SELECT m.ingredient_id, i.name, i.unit_of_measure,
       SUM(m.quantity) AS total_qty,
       COUNT(*) AS movement_count
  FROM stock_movements m
  JOIN ingredients i ON i.id = m.ingredient_id
 WHERE m.type = 'EXIT'
   AND (:unitId IS NULL OR m.unit_id = :unitId)
   AND (:ingredientId IS NULL OR m.ingredient_id = :ingredientId)
   AND m.created_at BETWEEN :from AND :to
 GROUP BY m.ingredient_id, i.name, i.unit_of_measure
 ORDER BY total_qty DESC
```

**`ConsumptionReportRow`:**
```json
{ "ingredientId": "...", "ingredientName": "Mozzarella",
  "unitOfMeasure": "kg", "totalQuantity": 45.300, "movementCount": 78 }
```

### `GET /reports/sales?from&to&unit&product`

Soma `order_items` de orders com status `COMPLETED` no período (apenas COMPLETED conta como venda).

```sql
SELECT oi.product_id, p.name, p.size,
       SUM(oi.quantity) AS units_sold,
       SUM(oi.quantity * oi.unit_price) AS revenue,
       COUNT(DISTINCT oi.order_id) AS orders_count
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN products p ON p.id = oi.product_id
 WHERE o.status = 'COMPLETED'
   AND (:unitId IS NULL OR o.unit_id = :unitId)
   AND (:productId IS NULL OR oi.product_id = :productId)
   AND o.completed_at BETWEEN :from AND :to
 GROUP BY oi.product_id, p.name, p.size
 ORDER BY revenue DESC
```

**`SalesReportRow`:**
```json
{ "productId": "...", "productName": "Margherita", "size": "G",
  "unitsSold": 124, "revenue": 5691.60, "ordersCount": 87 }
```

### `GET /reports/waste?from&to&unit&ingredient`

Soma `ADJUSTMENT` com `direction = 'DECREASE'` no período (perdas, quebras, vencimentos). Depende de V17.

```sql
SELECT m.ingredient_id, i.name, i.unit_of_measure,
       SUM(m.quantity) AS waste_qty,
       COUNT(*) AS adjustment_count
  FROM stock_movements m
  JOIN ingredients i ON i.id = m.ingredient_id
 WHERE m.type = 'ADJUSTMENT'
   AND m.direction = 'DECREASE'
   AND (:unitId IS NULL OR m.unit_id = :unitId)
   AND (:ingredientId IS NULL OR m.ingredient_id = :ingredientId)
   AND m.created_at BETWEEN :from AND :to
 GROUP BY m.ingredient_id, i.name, i.unit_of_measure
 ORDER BY waste_qty DESC
```

**`WasteReportRow`:**
```json
{ "ingredientId": "...", "ingredientName": "Mozzarella",
  "unitOfMeasure": "kg", "wasteQuantity": 2.500, "adjustmentCount": 4 }
```

### `GET /reports/stock-status?unit`

Snapshot do estoque atual classificado em três níveis (sem período — é "agora").

```sql
SELECT s.ingredient_id, i.name, i.unit_of_measure,
       s.quantity, i.min_quantity,
       CASE
         WHEN s.quantity <= i.min_quantity THEN 'LOW'
         WHEN s.quantity <= i.min_quantity * 1.5 THEN 'WARNING'
         ELSE 'OK'
       END AS level
  FROM stock s
  JOIN ingredients i ON i.id = s.ingredient_id
 WHERE i.active = true
   AND (:unitId IS NULL OR s.unit_id = :unitId)
 ORDER BY (s.quantity / NULLIF(i.min_quantity, 0)) ASC
```

**`StockStatusRow`:**
```json
{ "ingredientId": "...", "ingredientName": "Mozzarella",
  "unitOfMeasure": "kg", "currentQuantity": 0.500,
  "minQuantity": 1.000, "level": "LOW" }
```

`level = LOW | WARNING | OK`. WARNING = entre 100% e 150% do mínimo.

### `ReportService` interface

```java
List<ConsumptionReportRow> consumption(LocalDateTime from, LocalDateTime to,
                                       UUID unitId, UUID ingredientId);
List<SalesReportRow>       sales(LocalDateTime from, LocalDateTime to,
                                 UUID unitId, UUID productId);
List<WasteReportRow>       waste(LocalDateTime from, LocalDateTime to,
                                 UUID unitId, UUID ingredientId);
List<StockStatusRow>       stockStatus(UUID unitId);
```

---

## Módulo: Audit (`/audit-logs`)

### `AuditAction` enum

Lista fechada para evitar typos espalhados pelos services:

```java
public enum AuditAction {
    USER_CREATED, USER_UPDATED, USER_DEACTIVATED, USER_ROLE_CHANGED,
    UNIT_CREATED, UNIT_UPDATED, UNIT_DEACTIVATED,
    INGREDIENT_CREATED, INGREDIENT_UPDATED, INGREDIENT_MIN_UPDATED, INGREDIENT_DEACTIVATED,
    PRODUCT_CREATED, PRODUCT_UPDATED, PRODUCT_PRICE_CHANGED, PRODUCT_RECIPE_CHANGED, PRODUCT_DEACTIVATED,
    STOCK_ENTRY, STOCK_EXIT, STOCK_ADJUSTMENT,
    PURCHASE_ORDER_CREATED, PURCHASE_ORDER_RECEIVED, PURCHASE_ORDER_CANCELED,
    ORDER_CREATED, ORDER_UPDATED, ORDER_STARTED, ORDER_COMPLETED, ORDER_CANCELED
}
```

### `AuditService` API

```java
@Service
public class AuditService {
    private final AuditLogRepository repo;
    private final UserRepository userRepo;

    public void log(AuditAction action, String entityType, UUID entityId,
                    UUID actorId, Map<String, Object> details) {
        AuditLog log = new AuditLog();
        log.setAction(action);
        log.setEntityType(entityType);
        log.setEntityId(entityId);
        log.setActor(userRepo.getReferenceById(actorId));
        log.setDetails(details);
        repo.save(log);
    }
}
```

Chamada **dentro** da mesma transação do service que mutou — consistência forte.

### Pontos de instrumentação

| Service | Métodos | Action(s) | Details (exemplo) |
|---|---|---|---|
| `UserService` | `create`, `update`, `deactivate`, `changeRole` | `USER_CREATED/UPDATED/DEACTIVATED/ROLE_CHANGED` | `{ before: {...}, after: {...} }` parcial |
| `UnitService` | `create`, `update`, `deactivate` | `UNIT_CREATED/UPDATED/DEACTIVATED` | mesmo padrão |
| `IngredientService` | `create`, `update`, `deactivate` | `INGREDIENT_CREATED/UPDATED/DEACTIVATED`; `INGREDIENT_MIN_UPDATED` **adicional** quando `minQuantity` muda | `{ before, after }` |
| `ProductService` | `create`, `update`, `deactivate` | `PRODUCT_CREATED/UPDATED/DEACTIVATED`; `PRODUCT_PRICE_CHANGED` **adicional** quando `price` muda; `PRODUCT_RECIPE_CHANGED` **adicional** quando ficha muda | `{ before, after }` |
| `StockService` | `applyEntry`, `applyExit`, `applyAdjustment` | `STOCK_ENTRY/EXIT/ADJUSTMENT` | `{ ingredientId, unitId, quantity, direction?, reason }` |
| `PurchaseOrderService` | `create`, `receive`, `cancel` | `PURCHASE_ORDER_CREATED/RECEIVED/CANCELED` | `{ supplierId, totalItems, totalValue }` |
| `OrderService` | `create`, `update`, `start`, `complete`, `cancel` | `ORDER_CREATED/UPDATED/STARTED/COMPLETED/CANCELED` | `{ unitId, totalPrice, itemsCount }` |

**Nota sobre `actorId`:** todo service que vai auditar precisa receber `actorUserId` como parâmetro. Alguns já recebem (ex: `OrderService.start`); outros não (ex: `IngredientService.update`). Refatoração mecânica em ~10 assinaturas — controllers passam `AuthenticatedUser.currentId()`.

**Semântica das actions "adicionais":** uma chamada de `update` audita o evento genérico (`*_UPDATED`) sempre que algum campo mudou, e **adicionalmente** emite eventos específicos (`PRODUCT_PRICE_CHANGED`, `PRODUCT_RECIPE_CHANGED`, `INGREDIENT_MIN_UPDATED`) somente para os facets sensíveis que de fato mudaram. Uma `update` que altera preço e nome de um produto gera dois logs: `PRODUCT_UPDATED` + `PRODUCT_PRICE_CHANGED`. Permite querys como "todas as mudanças de preço da Margherita" sem varrer payloads JSON.

### Endpoints

```
GET /audit-logs               lista paginada; filtros: ?entityType&entityId&actorId&action&from&to (OWNER)
GET /audit-logs/{id}          detalhe (OWNER)
```

Sem POST/PUT/DELETE — logs são imutáveis e nascem só dos services internos.

**`AuditLogResponse`:**
```json
{
  "id": "...",
  "action": "PRODUCT_PRICE_CHANGED",
  "entityType": "Product",
  "entityId": "...",
  "actorId": "...", "actorName": "guilherme",
  "details": { "before": { "price": 45.90 }, "after": { "price": 49.90 } },
  "createdAt": "2026-04-26T19:15:42"
}
```

---

## Validação

| Regra | Onde | Exception |
|---|---|---|
| Resolver notificação que não está ACTIVE | `NotificationService.resolveManually` | `BusinessException` 400 |
| Notificação inexistente | `NotificationService.findById/resolveManually` | `ResourceNotFoundException` 404 |
| Audit log inexistente | `AuditService.findById` | `ResourceNotFoundException` 404 |
| Datas `from`/`to` inválidas (from > to) em relatórios | `ReportService` (cada método) | `BusinessException` 400 |
| Ingrediente/Unit/Product inexistente em filtros de relatório | nada — filtro retorna lista vazia | — |

Reaproveita `GlobalExceptionHandler` de SP1.

---

## Controle de Acesso

| Ação | OWNER | EMPLOYEE |
|---|---|---|
| `GET /notifications` (listar/detalhar) | ✅ | ✅ |
| `POST /notifications/{id}/resolve` | ✅ | ❌ |
| `GET /reports/*` (todos) | ✅ | ✅ |
| `GET /audit-logs` (listar/detalhar) | ✅ | ❌ |

EMPLOYEE vê alertas e relatórios para operação diária; resolução de alertas e auditoria ficam restritos a OWNER.

---

## Convenções de API

Mesmas de SP1/SP2/SP3:
- 200 (GET/PUT/POST-actions), 201 (POST create), 204 (DELETE)
- Envelope `{"data": ...}` para single, `{"data": [...], page, size, total}` para listas paginadas
- Relatórios retornam `{"data": [...]}` (sem paginação)
- GETs de notificações/relatórios autenticados (qualquer role); audit-logs OWNER (`@PreAuthorize`)
- SecurityConfig adiciona permits para GET `/notifications/**`, `/reports/**`

---

## Migrações Flyway (SP4)

```
V17__alter_stock_movements_add_direction.sql
V18__create_notifications.sql
V19__create_audit_logs.sql
```

---

## Fora de escopo (SP4)

- **Previsão de compras (RF08)** — vai para SP5 com algoritmo dedicado
- **Canais externos** (email, WhatsApp, push) — só in-app no SP4; tabela `notifications` fica preparada
- **Tipos de notificação além de LOW_STOCK** — enum extensível, mas só LOW_STOCK no SP4
- **Backfill de `direction` em ADJUSTMENTs antigos** — banco em desenvolvimento, sem dados reais
- **Exportação CSV/PDF dos relatórios** — frontend exporta a partir do JSON
- **Hibernate Envers / interceptor genérico de auditoria** — instrumentação manual via `AuditService` é mais explícita e suficiente para o escopo
- **Auditoria de operações de leitura** — só mutações são logadas
- **Soft delete de `audit_logs`** — logs são imutáveis; sem DELETE, sem TTL no SP4
- **Métricas / dashboards via Micrometer** — fora de escopo
