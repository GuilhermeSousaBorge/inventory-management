# SP4 Alerts, Reports & Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement SP4 — in-app low-stock notifications via Spring `@TransactionalEventListener`, four aggregated read-only reports (consumption / sales / waste / stock-status), and an immutable audit log written explicitly from existing services on sensitive mutations.

**Architecture:** Three new domain packages (`notification/`, `report/`, `audit/`) plus a `shared/event/` record. `StockService` publishes a `StockChangedEvent` after each stock mutation; a listener creates or auto-resolves `notifications` rows in a separate transaction (dedup enforced by a partial unique index). `AuditService` is injected into 7 existing services and called explicitly inside their write transactions. `ReportService` runs four parameterized aggregation queries with no new entities.

**Tech Stack:** Java 21, Spring Boot 4.0.5, Spring Security 6, JJWT 0.12.6, Spring Data JPA, PostgreSQL 16 (JSONB), Flyway, SpringDoc 3.0.3.

**Note on tests:** this project is a learning exercise. The user implements the code; Claude writes integration tests afterward. This plan does **not** include test tasks. Once tasks 1-25 are done, hand off for testing per the "Handoff to Testing" section at the end.

---

## File Map

```
src/main/resources/db/migration/
  V17__alter_stock_movements_add_direction.sql      (new)
  V18__create_notifications.sql                     (new)
  V19__create_audit_logs.sql                        (new)

src/main/java/br/com/easy_inventory/management/
  shared/event/StockChangedEvent.java               (new)
  shared/security/SecurityConfig.java               (modify: add 2 GET permits)

  movement/entity/StockMovement.java                (modify: add direction field)
  movement/dto/MovementResponse.java                (modify: add direction field)

  stock/service/StockService.java                   (modify: persist direction;
                                                              inject ApplicationEventPublisher;
                                                              inject AuditService;
                                                              audit + publish event)

  notification/
    entity/NotificationType.java
    entity/NotificationStatus.java
    entity/Notification.java
    repository/NotificationRepository.java
    dto/NotificationResponse.java
    service/NotificationService.java
    listener/StockLevelListener.java
    controller/NotificationController.java

  audit/
    entity/AuditAction.java
    entity/AuditLog.java
    repository/AuditLogRepository.java
    dto/AuditLogResponse.java
    service/AuditService.java
    controller/AuditLogController.java

  report/
    dto/ConsumptionReportRow.java
    dto/SalesReportRow.java
    dto/WasteReportRow.java
    dto/StockStatusRow.java
    service/ReportService.java
    controller/ReportController.java

  user/service/UserService.java                     (modify: inject AuditService;
                                                              accept actorUserId in update/deactivate;
                                                              audit USER_*)
  user/controller/UserController.java               (modify: pass AuthenticatedUser.currentId())
  unit/service/UnitService.java                     (modify: inject AuditService;
                                                              accept actorUserId in create/update/deactivate;
                                                              audit UNIT_*)
  unit/controller/UnitController.java               (modify: pass AuthenticatedUser.currentId())
  ingredient/service/IngredientService.java         (modify: inject AuditService;
                                                              accept actorUserId in create/update/deactivate;
                                                              audit INGREDIENT_*)
  ingredient/controller/IngredientController.java   (modify: pass AuthenticatedUser.currentId())
  product/service/ProductService.java               (modify: inject AuditService;
                                                              accept actorUserId in create/update/deactivate;
                                                              audit PRODUCT_*)
  product/controller/ProductController.java         (modify: pass AuthenticatedUser.currentId())
  purchase/service/PurchaseOrderService.java        (modify: inject AuditService;
                                                              accept actorUserId in update/cancel;
                                                              audit PURCHASE_ORDER_*)
  purchase/controller/PurchaseOrderController.java  (modify: pass AuthenticatedUser.currentId())
  order/service/OrderService.java                   (modify: inject AuditService;
                                                              accept actorUserId in update/complete/cancel;
                                                              audit ORDER_*)
  order/controller/OrderController.java             (modify: pass AuthenticatedUser.currentId())
```

---

## Task 1: V17 — alter `stock_movements` add `direction`

**Files:** Create `src/main/resources/db/migration/V17__alter_stock_movements_add_direction.sql`

```sql
ALTER TABLE stock_movements
  ADD COLUMN direction VARCHAR(10) CHECK (direction IN ('INCREASE', 'DECREASE'));
```

Nullable on purpose: ENTRY/EXIT keep NULL (direction is implicit in `type`); only ADJUSTMENT going forward will populate it. Pre-existing ADJUSTMENT rows stay NULL — the waste report ignores them via `direction = 'DECREASE'` filter.

- [ ] **Step 1:** Create the migration file with the SQL above.
- [ ] **Step 2:** Commit.

```bash
git add src/main/resources/db/migration/V17__alter_stock_movements_add_direction.sql
git commit -m "feat(sp4): add direction column to stock_movements (V17)"
```

---

## Task 2: Persist `direction` in `StockMovement` entity, DTO, and `StockService.applyAdjustment`

**Files:**
- Modify `src/main/java/br/com/easy_inventory/management/movement/entity/StockMovement.java`
- Modify `src/main/java/br/com/easy_inventory/management/movement/dto/MovementResponse.java`
- Modify `src/main/java/br/com/easy_inventory/management/stock/service/StockService.java`

**Changes to `StockMovement.java`:**

Add the field below `private String reason;`:

```java
@Enumerated(EnumType.STRING)
@Column(length = 10)
private AdjustmentDirection direction;
```

Add the import at the top:

```java
import br.com.easy_inventory.management.movement.entity.AdjustmentDirection;
```

(Adjust to actual package — `AdjustmentDirection` is already in `movement.entity`, so this import is for consumers; the entity itself is in the same package and doesn't need an import.)

Add getter/setter at the bottom:

```java
public AdjustmentDirection getDirection() { return direction; }
public void setDirection(AdjustmentDirection direction) { this.direction = direction; }
```

**Changes to `MovementResponse.java`:**

Add `AdjustmentDirection direction` to the record (after `MovementType type`) and to `from(...)`:

```java
package br.com.easy_inventory.management.movement.dto;

import br.com.easy_inventory.management.movement.entity.AdjustmentDirection;
import br.com.easy_inventory.management.movement.entity.MovementType;
import br.com.easy_inventory.management.movement.entity.StockMovement;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record MovementResponse(
        UUID id,
        UUID ingredientId, String ingredientName,
        UUID unitId, String unitName,
        MovementType type,
        AdjustmentDirection direction,
        BigDecimal quantity,
        BigDecimal unitPrice,
        String reason,
        UUID purchaseOrderId,
        UUID createdById,
        LocalDateTime createdAt
) {
    public static MovementResponse from(StockMovement m) {
        return new MovementResponse(
                m.getId(),
                m.getIngredient().getId(), m.getIngredient().getName(),
                m.getUnit().getId(), m.getUnit().getName(),
                m.getType(),
                m.getDirection(),
                m.getQuantity(),
                m.getUnitPrice(),
                m.getReason(),
                m.getPurchaseOrderId(),
                m.getCreatedBy().getId(),
                m.getCreatedAt()
        );
    }
}
```

**Changes to `StockService.applyAdjustment`:**

Inside the existing method, after `mv.setType(MovementType.ADJUSTMENT);` add:

```java
mv.setDirection(direction);
```

(The `direction` parameter is already in scope.)

- [ ] **Step 1:** Edit `StockMovement.java` to add the field and accessors.
- [ ] **Step 2:** Edit `MovementResponse.java` to expose the field.
- [ ] **Step 3:** Edit `StockService.applyAdjustment` to persist the field.
- [ ] **Step 4:** `mvnw.cmd compile` — confirm the project compiles.
- [ ] **Step 5:** Commit.

```bash
git add src/main/java/br/com/easy_inventory/management/movement/entity/StockMovement.java \
        src/main/java/br/com/easy_inventory/management/movement/dto/MovementResponse.java \
        src/main/java/br/com/easy_inventory/management/stock/service/StockService.java
git commit -m "feat(sp4): persist adjustment direction on stock_movements"
```

---

## Task 3: V18 — `notifications` table

**Files:** Create `src/main/resources/db/migration/V18__create_notifications.sql`

```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(30) NOT NULL CHECK (type IN ('LOW_STOCK')),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RESOLVED')),
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    unit_id UUID NOT NULL REFERENCES units(id),
    message VARCHAR(255) NOT NULL,
    triggered_quantity DECIMAL(12,3) NOT NULL,
    min_quantity DECIMAL(12,3) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP,
    resolved_by UUID REFERENCES users(id)
);

CREATE INDEX idx_notifications_status_created ON notifications(status, created_at DESC);
CREATE INDEX idx_notifications_ingredient_unit_status ON notifications(ingredient_id, unit_id, status);

CREATE UNIQUE INDEX uq_notification_active_per_ingredient_unit
    ON notifications(ingredient_id, unit_id, type)
    WHERE status = 'ACTIVE';
```

The partial unique index is the dedup contract: at most one ACTIVE notification per (ingredient, unit, type). The application catches `DataIntegrityViolationException` and silences it.

- [ ] **Step 1:** Create the migration file with the SQL above.
- [ ] **Step 2:** Commit.

```bash
git add src/main/resources/db/migration/V18__create_notifications.sql
git commit -m "feat(sp4): add V18 notifications migration with dedup partial index"
```

---

## Task 4: V19 — `audit_logs` table

**Files:** Create `src/main/resources/db/migration/V19__create_audit_logs.sql`

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(40) NOT NULL,
    entity_type VARCHAR(40) NOT NULL,
    entity_id UUID NOT NULL,
    actor_id UUID NOT NULL REFERENCES users(id),
    details JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
```

`action` is stored as plain VARCHAR (no CHECK constraint) to allow the `AuditAction` enum to evolve without schema migrations.

- [ ] **Step 1:** Create the migration file with the SQL above.
- [ ] **Step 2:** Commit.

```bash
git add src/main/resources/db/migration/V19__create_audit_logs.sql
git commit -m "feat(sp4): add V19 audit_logs migration"
```

---

## Task 5: `StockChangedEvent` record

**Files:** Create `src/main/java/br/com/easy_inventory/management/shared/event/StockChangedEvent.java`

```java
package br.com.easy_inventory.management.shared.event;

import java.math.BigDecimal;
import java.util.UUID;

public record StockChangedEvent(
        UUID ingredientId,
        UUID unitId,
        BigDecimal newQuantity,
        BigDecimal minQuantity
) {}
```

- [ ] **Step 1:** Create the file with the contents above.
- [ ] **Step 2:** Commit.

```bash
git add src/main/java/br/com/easy_inventory/management/shared/event/StockChangedEvent.java
git commit -m "feat(sp4): add StockChangedEvent record"
```

---

## Task 6: `NotificationType` + `NotificationStatus` enums

**Files:**
- Create `src/main/java/br/com/easy_inventory/management/notification/entity/NotificationType.java`
- Create `src/main/java/br/com/easy_inventory/management/notification/entity/NotificationStatus.java`

**NotificationType.java:**
```java
package br.com.easy_inventory.management.notification.entity;

public enum NotificationType { LOW_STOCK }
```

**NotificationStatus.java:**
```java
package br.com.easy_inventory.management.notification.entity;

public enum NotificationStatus { ACTIVE, RESOLVED }
```

- [ ] **Step 1:** Create both enum files.
- [ ] **Step 2:** Commit.

```bash
git add src/main/java/br/com/easy_inventory/management/notification/entity/NotificationType.java \
        src/main/java/br/com/easy_inventory/management/notification/entity/NotificationStatus.java
git commit -m "feat(sp4): add NotificationType and NotificationStatus enums"
```

---

## Task 7: `Notification` entity

**Files:** Create `src/main/java/br/com/easy_inventory/management/notification/entity/Notification.java`

```java
package br.com.easy_inventory.management.notification.entity;

import br.com.easy_inventory.management.ingredient.entity.Ingredient;
import br.com.easy_inventory.management.unit.entity.Unit;
import br.com.easy_inventory.management.user.entity.User;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "notifications")
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private NotificationType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private NotificationStatus status = NotificationStatus.ACTIVE;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ingredient_id", nullable = false)
    private Ingredient ingredient;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "unit_id", nullable = false)
    private Unit unit;

    @Column(nullable = false, length = 255)
    private String message;

    @Column(name = "triggered_quantity", nullable = false, precision = 12, scale = 3)
    private BigDecimal triggeredQuantity;

    @Column(name = "min_quantity", nullable = false, precision = 12, scale = 3)
    private BigDecimal minQuantity;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resolved_by")
    private User resolvedBy;

    @PrePersist
    void prePersist() { this.createdAt = LocalDateTime.now(); }

    public UUID getId() { return id; }
    public NotificationType getType() { return type; }
    public void setType(NotificationType type) { this.type = type; }
    public NotificationStatus getStatus() { return status; }
    public void setStatus(NotificationStatus status) { this.status = status; }
    public Ingredient getIngredient() { return ingredient; }
    public void setIngredient(Ingredient ingredient) { this.ingredient = ingredient; }
    public Unit getUnit() { return unit; }
    public void setUnit(Unit unit) { this.unit = unit; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public BigDecimal getTriggeredQuantity() { return triggeredQuantity; }
    public void setTriggeredQuantity(BigDecimal triggeredQuantity) { this.triggeredQuantity = triggeredQuantity; }
    public BigDecimal getMinQuantity() { return minQuantity; }
    public void setMinQuantity(BigDecimal minQuantity) { this.minQuantity = minQuantity; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(LocalDateTime resolvedAt) { this.resolvedAt = resolvedAt; }
    public User getResolvedBy() { return resolvedBy; }
    public void setResolvedBy(User resolvedBy) { this.resolvedBy = resolvedBy; }
}
```

- [ ] **Step 1:** Create the file.
- [ ] **Step 2:** Commit.

```bash
git add src/main/java/br/com/easy_inventory/management/notification/entity/Notification.java
git commit -m "feat(sp4): add Notification entity"
```

---

## Task 8: `NotificationRepository`

**Files:** Create `src/main/java/br/com/easy_inventory/management/notification/repository/NotificationRepository.java`

```java
package br.com.easy_inventory.management.notification.repository;

import br.com.easy_inventory.management.notification.entity.Notification;
import br.com.easy_inventory.management.notification.entity.NotificationStatus;
import br.com.easy_inventory.management.notification.entity.NotificationType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    @Query("select n from Notification n " +
           "where n.ingredient.id = :ingredientId " +
           "  and n.unit.id = :unitId " +
           "  and n.type = :type " +
           "  and n.status = br.com.easy_inventory.management.notification.entity.NotificationStatus.ACTIVE")
    Optional<Notification> findActive(@Param("ingredientId") UUID ingredientId,
                                      @Param("unitId") UUID unitId,
                                      @Param("type") NotificationType type);

    @Query("select n from Notification n where " +
           "(:status is null or n.status = :status) and " +
           "(:unitId is null or n.unit.id = :unitId) and " +
           "(:from is null or n.createdAt >= :from) and " +
           "(:to is null or n.createdAt <= :to) " +
           "order by n.createdAt desc")
    Page<Notification> search(@Param("status") NotificationStatus status,
                              @Param("unitId") UUID unitId,
                              @Param("from") LocalDateTime from,
                              @Param("to") LocalDateTime to,
                              Pageable pageable);
}
```

- [ ] **Step 1:** Create the file.
- [ ] **Step 2:** Commit.

```bash
git add src/main/java/br/com/easy_inventory/management/notification/repository/NotificationRepository.java
git commit -m "feat(sp4): add NotificationRepository with active-lookup and search queries"
```

---

## Task 9: `NotificationResponse` DTO

**Files:** Create `src/main/java/br/com/easy_inventory/management/notification/dto/NotificationResponse.java`

```java
package br.com.easy_inventory.management.notification.dto;

import br.com.easy_inventory.management.notification.entity.Notification;
import br.com.easy_inventory.management.notification.entity.NotificationStatus;
import br.com.easy_inventory.management.notification.entity.NotificationType;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record NotificationResponse(
        UUID id,
        NotificationType type,
        NotificationStatus status,
        UUID ingredientId,
        String ingredientName,
        UUID unitId,
        String unitName,
        String message,
        BigDecimal triggeredQuantity,
        BigDecimal minQuantity,
        LocalDateTime createdAt,
        LocalDateTime resolvedAt,
        UUID resolvedBy
) {
    public static NotificationResponse from(Notification n) {
        return new NotificationResponse(
                n.getId(),
                n.getType(),
                n.getStatus(),
                n.getIngredient().getId(),
                n.getIngredient().getName(),
                n.getUnit().getId(),
                n.getUnit().getName(),
                n.getMessage(),
                n.getTriggeredQuantity(),
                n.getMinQuantity(),
                n.getCreatedAt(),
                n.getResolvedAt(),
                n.getResolvedBy() != null ? n.getResolvedBy().getId() : null
        );
    }
}
```

- [ ] **Step 1:** Create the file.
- [ ] **Step 2:** Commit.

```bash
git add src/main/java/br/com/easy_inventory/management/notification/dto/NotificationResponse.java
git commit -m "feat(sp4): add NotificationResponse DTO"
```

---

## Task 10: `NotificationService`

**Files:** Create `src/main/java/br/com/easy_inventory/management/notification/service/NotificationService.java`

```java
package br.com.easy_inventory.management.notification.service;

import br.com.easy_inventory.management.ingredient.entity.Ingredient;
import br.com.easy_inventory.management.ingredient.repository.IngredientRepository;
import br.com.easy_inventory.management.notification.dto.NotificationResponse;
import br.com.easy_inventory.management.notification.entity.Notification;
import br.com.easy_inventory.management.notification.entity.NotificationStatus;
import br.com.easy_inventory.management.notification.entity.NotificationType;
import br.com.easy_inventory.management.notification.repository.NotificationRepository;
import br.com.easy_inventory.management.shared.event.StockChangedEvent;
import br.com.easy_inventory.management.shared.exception.BusinessException;
import br.com.easy_inventory.management.shared.exception.ResourceNotFoundException;
import br.com.easy_inventory.management.unit.entity.Unit;
import br.com.easy_inventory.management.unit.repository.UnitRepository;
import br.com.easy_inventory.management.user.repository.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class NotificationService {

    private final NotificationRepository repo;
    private final IngredientRepository ingredientRepo;
    private final UnitRepository unitRepo;
    private final UserRepository userRepo;

    public NotificationService(NotificationRepository repo,
                               IngredientRepository ingredientRepo,
                               UnitRepository unitRepo,
                               UserRepository userRepo) {
        this.repo = repo;
        this.ingredientRepo = ingredientRepo;
        this.unitRepo = unitRepo;
        this.userRepo = userRepo;
    }

    // ----- READ -----

    public Page<NotificationResponse> findAll(NotificationStatus status, UUID unitId,
                                              LocalDateTime from, LocalDateTime to,
                                              Pageable pageable) {
        return repo.search(status, unitId, from, to, pageable).map(NotificationResponse::from);
    }

    public NotificationResponse findById(UUID id) {
        return NotificationResponse.from(getOrThrow(id));
    }

    // ----- LISTENER ENTRY POINTS -----

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void raiseLowStock(StockChangedEvent ev) {
        Ingredient ing = ingredientRepo.findById(ev.ingredientId())
                .orElseThrow(() -> new ResourceNotFoundException("Ingredient not found: " + ev.ingredientId()));
        Unit unit = unitRepo.findById(ev.unitId())
                .orElseThrow(() -> new ResourceNotFoundException("Unit not found: " + ev.unitId()));

        Notification n = new Notification();
        n.setType(NotificationType.LOW_STOCK);
        n.setStatus(NotificationStatus.ACTIVE);
        n.setIngredient(ing);
        n.setUnit(unit);
        n.setTriggeredQuantity(ev.newQuantity());
        n.setMinQuantity(ev.minQuantity());
        n.setMessage(buildLowStockMessage(ing, unit, ev));

        try {
            repo.saveAndFlush(n);
        } catch (DataIntegrityViolationException e) {
            // partial unique index: an ACTIVE notification already exists for this (ingredient, unit, type) — ignore
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void autoResolveLowStock(UUID ingredientId, UUID unitId) {
        repo.findActive(ingredientId, unitId, NotificationType.LOW_STOCK)
            .ifPresent(n -> {
                n.setStatus(NotificationStatus.RESOLVED);
                n.setResolvedAt(LocalDateTime.now());
                // resolvedBy remains null = auto-resolution
            });
    }

    // ----- MANUAL RESOLUTION -----

    @Transactional
    public NotificationResponse resolveManually(UUID notificationId, UUID actorUserId) {
        Notification n = getOrThrow(notificationId);
        if (n.getStatus() != NotificationStatus.ACTIVE) {
            throw new BusinessException("Notification is not active");
        }
        n.setStatus(NotificationStatus.RESOLVED);
        n.setResolvedAt(LocalDateTime.now());
        n.setResolvedBy(userRepo.getReferenceById(actorUserId));
        return NotificationResponse.from(n);
    }

    // ----- PRIVATE -----

    private String buildLowStockMessage(Ingredient ing, Unit unit, StockChangedEvent ev) {
        return ing.getName() + " abaixo do mínimo na unidade " + unit.getName() + ": "
                + ev.newQuantity() + " " + ing.getUnitOfMeasure() + " ≤ "
                + ev.minQuantity() + " " + ing.getUnitOfMeasure();
    }

    Notification getOrThrow(UUID id) {
        return repo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found: " + id));
    }
}
```

> **Why `saveAndFlush`:** plain `save` would defer the INSERT until transaction commit, and the constraint violation would surface outside our `try/catch`. `saveAndFlush` forces the INSERT immediately so the catch block runs.

> **Why `REQUIRES_NEW`:** `@TransactionalEventListener(AFTER_COMMIT)` runs outside any active transaction. Without `REQUIRES_NEW`, the `save` would auto-commit per statement and any failure couldn't roll back. `REQUIRES_NEW` opens a dedicated short transaction per notification operation.

- [ ] **Step 1:** Create the file.
- [ ] **Step 2:** `mvnw.cmd compile` — confirm it compiles.
- [ ] **Step 3:** Commit.

```bash
git add src/main/java/br/com/easy_inventory/management/notification/service/NotificationService.java
git commit -m "feat(sp4): add NotificationService with raise/auto-resolve/manual-resolve"
```

---

## Task 11: `StockLevelListener`

**Files:** Create `src/main/java/br/com/easy_inventory/management/notification/listener/StockLevelListener.java`

```java
package br.com.easy_inventory.management.notification.listener;

import br.com.easy_inventory.management.notification.service.NotificationService;
import br.com.easy_inventory.management.shared.event.StockChangedEvent;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class StockLevelListener {

    private final NotificationService notificationService;

    public StockLevelListener(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

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

- [ ] **Step 1:** Create the file.
- [ ] **Step 2:** Commit.

```bash
git add src/main/java/br/com/easy_inventory/management/notification/listener/StockLevelListener.java
git commit -m "feat(sp4): add StockLevelListener (AFTER_COMMIT) for low-stock alerts"
```

---

## Task 12: Wire `StockService` to publish `StockChangedEvent`

**Files:** Modify `src/main/java/br/com/easy_inventory/management/stock/service/StockService.java`

Add the import:

```java
import br.com.easy_inventory.management.shared.event.StockChangedEvent;
import org.springframework.context.ApplicationEventPublisher;
```

Add the field:

```java
private final ApplicationEventPublisher publisher;
```

Update the constructor signature to accept and assign it (append to the existing parameter list — last position):

```java
public StockService(StockRepository stockRepository,
                    StockMovementRepository movementRepository,
                    IngredientRepository ingredientRepository,
                    UnitRepository unitRepository,
                    UserRepository userRepository,
                    EntityManager entityManager,
                    ApplicationEventPublisher publisher) {
    this.stockRepository = stockRepository;
    this.movementRepository = movementRepository;
    this.ingredientRepository = ingredientRepository;
    this.unitRepository = unitRepository;
    this.userRepository = userRepository;
    this.entityManager = entityManager;
    this.publisher = publisher;
}
```

In `applyEntry`, replace the final `return movementRepository.save(mv);` with:

```java
StockMovement saved = movementRepository.save(mv);
publisher.publishEvent(new StockChangedEvent(
        ing.getId(), unit.getId(), stock.getQuantity(), ing.getMinQuantity()));
return saved;
```

In `applyExit`, do the same — replace the final `return movementRepository.save(mv);` with:

```java
StockMovement saved = movementRepository.save(mv);
publisher.publishEvent(new StockChangedEvent(
        ing.getId(), unit.getId(), stock.getQuantity(), ing.getMinQuantity()));
return saved;
```

In `applyAdjustment`, do the same — replace the final `return movementRepository.save(mv);` with:

```java
StockMovement saved = movementRepository.save(mv);
publisher.publishEvent(new StockChangedEvent(
        ing.getId(), unit.getId(), stock.getQuantity(), ing.getMinQuantity()));
return saved;
```

- [ ] **Step 1:** Edit `StockService.java` per the changes above.
- [ ] **Step 2:** `mvnw.cmd compile` — confirm it compiles.
- [ ] **Step 3:** Commit.

```bash
git add src/main/java/br/com/easy_inventory/management/stock/service/StockService.java
git commit -m "feat(sp4): publish StockChangedEvent from StockService write methods"
```

---

## Task 13: `NotificationController` + `SecurityConfig` permit

**Files:**
- Create `src/main/java/br/com/easy_inventory/management/notification/controller/NotificationController.java`
- Modify `src/main/java/br/com/easy_inventory/management/shared/security/SecurityConfig.java`

**NotificationController.java:**
```java
package br.com.easy_inventory.management.notification.controller;

import br.com.easy_inventory.management.notification.dto.NotificationResponse;
import br.com.easy_inventory.management.notification.entity.NotificationStatus;
import br.com.easy_inventory.management.notification.service.NotificationService;
import br.com.easy_inventory.management.shared.dto.ApiResponse;
import br.com.easy_inventory.management.shared.dto.PageResponse;
import br.com.easy_inventory.management.shared.security.AuthenticatedUser;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.UUID;

@RestController
@RequestMapping("/notifications")
public class NotificationController {

    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<PageResponse<NotificationResponse>> list(
            @RequestParam(required = false) NotificationStatus status,
            @RequestParam(required = false) UUID unit,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<NotificationResponse> result = service.findAll(status, unit, from, to,
                PageRequest.of(page, size));
        return ResponseEntity.ok(PageResponse.of(result.getContent(), page, size, result.getTotalElements()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<NotificationResponse>> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.of(service.findById(id)));
    }

    @PostMapping("/{id}/resolve")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<NotificationResponse>> resolve(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.of(
                service.resolveManually(id, AuthenticatedUser.currentId())));
    }
}
```

**SecurityConfig.java — locate this block inside `authorizeHttpRequests`:**
```java
.requestMatchers(HttpMethod.GET, "/orders", "/orders/**").permitAll()
```

Add immediately below it:

```java
.requestMatchers(HttpMethod.GET, "/notifications", "/notifications/**").permitAll()
```

- [ ] **Step 1:** Create `NotificationController.java`.
- [ ] **Step 2:** Edit `SecurityConfig.java` to add the permit.
- [ ] **Step 3:** `mvnw.cmd compile` — confirm it compiles.
- [ ] **Step 4:** Commit.

```bash
git add src/main/java/br/com/easy_inventory/management/notification/controller/NotificationController.java \
        src/main/java/br/com/easy_inventory/management/shared/security/SecurityConfig.java
git commit -m "feat(sp4): add NotificationController and open GET permits"
```

---

## Task 14: `AuditAction` enum

**Files:** Create `src/main/java/br/com/easy_inventory/management/audit/entity/AuditAction.java`

```java
package br.com.easy_inventory.management.audit.entity;

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

- [ ] **Step 1:** Create the file.
- [ ] **Step 2:** Commit.

```bash
git add src/main/java/br/com/easy_inventory/management/audit/entity/AuditAction.java
git commit -m "feat(sp4): add AuditAction enum"
```

---

## Task 15: `AuditLog` entity

**Files:** Create `src/main/java/br/com/easy_inventory/management/audit/entity/AuditLog.java`

```java
package br.com.easy_inventory.management.audit.entity;

import br.com.easy_inventory.management.user.entity.User;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "audit_logs")
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private AuditAction action;

    @Column(name = "entity_type", nullable = false, length = 40)
    private String entityType;

    @Column(name = "entity_id", nullable = false)
    private UUID entityId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "actor_id", nullable = false)
    private User actor;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> details;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() { this.createdAt = LocalDateTime.now(); }

    public UUID getId() { return id; }
    public AuditAction getAction() { return action; }
    public void setAction(AuditAction action) { this.action = action; }
    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }
    public UUID getEntityId() { return entityId; }
    public void setEntityId(UUID entityId) { this.entityId = entityId; }
    public User getActor() { return actor; }
    public void setActor(User actor) { this.actor = actor; }
    public Map<String, Object> getDetails() { return details; }
    public void setDetails(Map<String, Object> details) { this.details = details; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
```

- [ ] **Step 1:** Create the file.
- [ ] **Step 2:** `mvnw.cmd compile` — confirm Hibernate finds `JdbcTypeCode` (already on classpath via Spring Data JPA).
- [ ] **Step 3:** Commit.

```bash
git add src/main/java/br/com/easy_inventory/management/audit/entity/AuditLog.java
git commit -m "feat(sp4): add AuditLog entity with JSONB details"
```

---

## Task 16: `AuditLogRepository`

**Files:** Create `src/main/java/br/com/easy_inventory/management/audit/repository/AuditLogRepository.java`

```java
package br.com.easy_inventory.management.audit.repository;

import br.com.easy_inventory.management.audit.entity.AuditAction;
import br.com.easy_inventory.management.audit.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.UUID;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    @Query("select a from AuditLog a where " +
           "(:entityType is null or a.entityType = :entityType) and " +
           "(:entityId is null or a.entityId = :entityId) and " +
           "(:actorId is null or a.actor.id = :actorId) and " +
           "(:action is null or a.action = :action) and " +
           "(:from is null or a.createdAt >= :from) and " +
           "(:to is null or a.createdAt <= :to) " +
           "order by a.createdAt desc")
    Page<AuditLog> search(@Param("entityType") String entityType,
                          @Param("entityId") UUID entityId,
                          @Param("actorId") UUID actorId,
                          @Param("action") AuditAction action,
                          @Param("from") LocalDateTime from,
                          @Param("to") LocalDateTime to,
                          Pageable pageable);
}
```

- [ ] **Step 1:** Create the file.
- [ ] **Step 2:** Commit.

```bash
git add src/main/java/br/com/easy_inventory/management/audit/repository/AuditLogRepository.java
git commit -m "feat(sp4): add AuditLogRepository with search query"
```

---

## Task 17: `AuditService` and `AuditLogResponse` DTO

**Files:**
- Create `src/main/java/br/com/easy_inventory/management/audit/dto/AuditLogResponse.java`
- Create `src/main/java/br/com/easy_inventory/management/audit/service/AuditService.java`

**AuditLogResponse.java:**
```java
package br.com.easy_inventory.management.audit.dto;

import br.com.easy_inventory.management.audit.entity.AuditAction;
import br.com.easy_inventory.management.audit.entity.AuditLog;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

public record AuditLogResponse(
        UUID id,
        AuditAction action,
        String entityType,
        UUID entityId,
        UUID actorId,
        String actorName,
        Map<String, Object> details,
        LocalDateTime createdAt
) {
    public static AuditLogResponse from(AuditLog log) {
        return new AuditLogResponse(
                log.getId(),
                log.getAction(),
                log.getEntityType(),
                log.getEntityId(),
                log.getActor().getId(),
                log.getActor().getName(),
                log.getDetails(),
                log.getCreatedAt()
        );
    }
}
```

**AuditService.java:**
```java
package br.com.easy_inventory.management.audit.service;

import br.com.easy_inventory.management.audit.dto.AuditLogResponse;
import br.com.easy_inventory.management.audit.entity.AuditAction;
import br.com.easy_inventory.management.audit.entity.AuditLog;
import br.com.easy_inventory.management.audit.repository.AuditLogRepository;
import br.com.easy_inventory.management.shared.exception.ResourceNotFoundException;
import br.com.easy_inventory.management.user.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Service
public class AuditService {

    private final AuditLogRepository repo;
    private final UserRepository userRepo;

    public AuditService(AuditLogRepository repo, UserRepository userRepo) {
        this.repo = repo;
        this.userRepo = userRepo;
    }

    public Page<AuditLogResponse> findAll(String entityType, UUID entityId, UUID actorId,
                                          AuditAction action, LocalDateTime from, LocalDateTime to,
                                          Pageable pageable) {
        return repo.search(entityType, entityId, actorId, action, from, to, pageable)
                .map(AuditLogResponse::from);
    }

    public AuditLogResponse findById(UUID id) {
        return AuditLogResponse.from(
                repo.findById(id).orElseThrow(() -> new ResourceNotFoundException("AuditLog not found: " + id)));
    }

    @Transactional
    public void log(AuditAction action, String entityType, UUID entityId,
                    UUID actorId, Map<String, Object> details) {
        AuditLog entry = new AuditLog();
        entry.setAction(action);
        entry.setEntityType(entityType);
        entry.setEntityId(entityId);
        entry.setActor(userRepo.getReferenceById(actorId));
        entry.setDetails(details);
        repo.save(entry);
    }
}
```

> `log()` participates in the **caller's** transaction by default — `@Transactional` here only covers the case where it's called outside a transaction (defensive). When called from another `@Transactional` service, it joins that transaction, so a rollback on the caller rolls the audit row back too.

- [ ] **Step 1:** Create both files.
- [ ] **Step 2:** `mvnw.cmd compile` — confirm.
- [ ] **Step 3:** Commit.

```bash
git add src/main/java/br/com/easy_inventory/management/audit/dto/AuditLogResponse.java \
        src/main/java/br/com/easy_inventory/management/audit/service/AuditService.java
git commit -m "feat(sp4): add AuditService and AuditLogResponse DTO"
```

---

## Task 18: `AuditLogController`

**Files:** Create `src/main/java/br/com/easy_inventory/management/audit/controller/AuditLogController.java`

```java
package br.com.easy_inventory.management.audit.controller;

import br.com.easy_inventory.management.audit.dto.AuditLogResponse;
import br.com.easy_inventory.management.audit.entity.AuditAction;
import br.com.easy_inventory.management.audit.service.AuditService;
import br.com.easy_inventory.management.shared.dto.ApiResponse;
import br.com.easy_inventory.management.shared.dto.PageResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.UUID;

@RestController
@RequestMapping("/audit-logs")
@PreAuthorize("hasRole('OWNER')")
public class AuditLogController {

    private final AuditService service;

    public AuditLogController(AuditService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<PageResponse<AuditLogResponse>> list(
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) UUID entityId,
            @RequestParam(required = false) UUID actorId,
            @RequestParam(required = false) AuditAction action,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<AuditLogResponse> result = service.findAll(entityType, entityId, actorId, action,
                from, to, PageRequest.of(page, size));
        return ResponseEntity.ok(PageResponse.of(result.getContent(), page, size, result.getTotalElements()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<AuditLogResponse>> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.of(service.findById(id)));
    }
}
```

> No SecurityConfig change — `/audit-logs` falls through to `.anyRequest().authenticated()` and the class-level `@PreAuthorize("hasRole('OWNER')")` enforces the OWNER restriction.

- [ ] **Step 1:** Create the file.
- [ ] **Step 2:** Commit.

```bash
git add src/main/java/br/com/easy_inventory/management/audit/controller/AuditLogController.java
git commit -m "feat(sp4): add AuditLogController (OWNER-only)"
```

---

## Task 19: Instrument `UserService` with audit

**Files:**
- Modify `src/main/java/br/com/easy_inventory/management/user/service/UserService.java`
- Modify `src/main/java/br/com/easy_inventory/management/user/controller/UserController.java`

**Changes to `UserService.java`:**

Add imports:
```java
import br.com.easy_inventory.management.audit.entity.AuditAction;
import br.com.easy_inventory.management.audit.service.AuditService;

import java.util.HashMap;
import java.util.Map;
```

Add field and update constructor:
```java
private final AuditService auditService;

public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder, AuditService auditService) {
    this.userRepository = userRepository;
    this.passwordEncoder = passwordEncoder;
    this.auditService = auditService;
}
```

Replace `create`, `update`, `deactivate`:

```java
@Transactional
public UserResponse create(CreateUserRequest request, UUID actorUserId) {
    if (userRepository.existsByEmail(request.email())) {
        throw new BusinessException("Email already in use");
    }
    User user = new User();
    user.setName(request.name());
    user.setEmail(request.email());
    user.setPasswordHash(passwordEncoder.encode(request.password()));
    user.setRole(request.role());
    User saved = userRepository.save(user);

    auditService.log(AuditAction.USER_CREATED, "User", saved.getId(), actorUserId,
            Map.of("name", saved.getName(), "email", saved.getEmail(), "role", saved.getRole().name()));
    return UserResponse.from(saved);
}

@Transactional
public UserResponse update(UUID id, UpdateUserRequest request, UUID actorUserId) {
    User user = getOrThrow(id);
    if (!user.getEmail().equals(request.email()) && userRepository.existsByEmail(request.email())) {
        throw new BusinessException("Email already in use");
    }

    Map<String, Object> before = Map.of(
            "name", user.getName(), "email", user.getEmail(),
            "role", user.getRole().name(), "active", user.isActive());
    boolean roleChanged = user.getRole() != request.role();

    user.setName(request.name());
    user.setEmail(request.email());
    user.setRole(request.role());
    user.setActive(request.active());
    User saved = userRepository.save(user);

    Map<String, Object> after = Map.of(
            "name", saved.getName(), "email", saved.getEmail(),
            "role", saved.getRole().name(), "active", saved.isActive());

    auditService.log(AuditAction.USER_UPDATED, "User", saved.getId(), actorUserId,
            Map.of("before", before, "after", after));
    if (roleChanged) {
        auditService.log(AuditAction.USER_ROLE_CHANGED, "User", saved.getId(), actorUserId,
                Map.of("before", before.get("role"), "after", after.get("role")));
    }
    return UserResponse.from(saved);
}

@Transactional
public void deactivate(UUID id, UUID actorUserId) {
    User user = getOrThrow(id);
    user.setActive(false);
    userRepository.save(user);
    auditService.log(AuditAction.USER_DEACTIVATED, "User", id, actorUserId, null);
}
```

**Changes to `UserController.java`:**

Add the import:
```java
import br.com.easy_inventory.management.shared.security.AuthenticatedUser;
```

Update the three call sites to pass `AuthenticatedUser.currentId()`:

```java
// inside @PostMapping create:
var response = userService.create(request, AuthenticatedUser.currentId());

// inside @PutMapping update:
return ResponseEntity.ok(ApiResponse.of(userService.update(id, request, AuthenticatedUser.currentId())));

// inside @DeleteMapping deactivate:
userService.deactivate(id, AuthenticatedUser.currentId());
```

- [ ] **Step 1:** Edit `UserService.java`.
- [ ] **Step 2:** Edit `UserController.java`.
- [ ] **Step 3:** `mvnw.cmd compile` — confirm.
- [ ] **Step 4:** Commit.

```bash
git add src/main/java/br/com/easy_inventory/management/user/service/UserService.java \
        src/main/java/br/com/easy_inventory/management/user/controller/UserController.java
git commit -m "feat(sp4): audit user create/update/deactivate + role-changed action"
```

---

## Task 20: Instrument `UnitService` with audit

**Files:**
- Modify `src/main/java/br/com/easy_inventory/management/unit/service/UnitService.java`
- Modify `src/main/java/br/com/easy_inventory/management/unit/controller/UnitController.java`

**Changes to `UnitService.java`:**

Add imports:
```java
import br.com.easy_inventory.management.audit.entity.AuditAction;
import br.com.easy_inventory.management.audit.service.AuditService;

import java.util.Map;
```

Add field and update constructor (append `AuditService auditService` parameter; assign):

```java
private final AuditService auditService;
// adjust constructor accordingly
```

Add `UUID actorUserId` parameter to `create`, `update`, `deactivate` and call `auditService.log(...)` at the end of each. Pattern (mirror UserService):

```java
@Transactional
public UnitResponse create(CreateUnitRequest request, UUID actorUserId) {
    // ... existing logic ...
    Unit saved = unitRepository.save(unit);
    auditService.log(AuditAction.UNIT_CREATED, "Unit", saved.getId(), actorUserId,
            Map.of("name", saved.getName()));
    return UnitResponse.from(saved);
}

@Transactional
public UnitResponse update(UUID id, UpdateUnitRequest request, UUID actorUserId) {
    Unit unit = getOrThrow(id);
    Map<String, Object> before = Map.of("name", unit.getName(), "active", unit.isActive());
    // ... existing field updates ...
    Unit saved = unitRepository.save(unit);
    Map<String, Object> after = Map.of("name", saved.getName(), "active", saved.isActive());
    auditService.log(AuditAction.UNIT_UPDATED, "Unit", saved.getId(), actorUserId,
            Map.of("before", before, "after", after));
    return UnitResponse.from(saved);
}

@Transactional
public void deactivate(UUID id, UUID actorUserId) {
    Unit unit = getOrThrow(id);
    unit.setActive(false);
    unitRepository.save(unit);
    auditService.log(AuditAction.UNIT_DEACTIVATED, "Unit", id, actorUserId, null);
}
```

> Adjust `before`/`after` field set to whatever `Unit` actually exposes. Read the entity to confirm fields before writing the maps.

**Changes to `UnitController.java`:**

Add import `AuthenticatedUser` and update call sites:
```java
unitService.create(request, AuthenticatedUser.currentId());
unitService.update(id, request, AuthenticatedUser.currentId());
unitService.deactivate(id, AuthenticatedUser.currentId());
```

- [ ] **Step 1:** Edit `UnitService.java`.
- [ ] **Step 2:** Edit `UnitController.java`.
- [ ] **Step 3:** `mvnw.cmd compile` — confirm.
- [ ] **Step 4:** Commit.

```bash
git add src/main/java/br/com/easy_inventory/management/unit/service/UnitService.java \
        src/main/java/br/com/easy_inventory/management/unit/controller/UnitController.java
git commit -m "feat(sp4): audit unit create/update/deactivate"
```

---

## Task 21: Instrument `IngredientService` with audit

**Files:**
- Modify `src/main/java/br/com/easy_inventory/management/ingredient/service/IngredientService.java`
- Modify `src/main/java/br/com/easy_inventory/management/ingredient/controller/IngredientController.java`

Same pattern as Tasks 19/20:
- Inject `AuditService` (constructor append).
- Add `UUID actorUserId` to `create`, `update`, `deactivate`.
- `create` → `INGREDIENT_CREATED` with `Map.of("name", saved.getName(), "minQuantity", saved.getMinQuantity())`.
- `update` → capture `before`/`after` snapshots; emit `INGREDIENT_UPDATED` always; **additionally** emit `INGREDIENT_MIN_UPDATED` when `minQuantity` actually changed:

```java
boolean minChanged = ingredient.getMinQuantity().compareTo(request.minQuantity()) != 0;
// ... apply update + save ...
auditService.log(AuditAction.INGREDIENT_UPDATED, "Ingredient", saved.getId(), actorUserId,
        Map.of("before", before, "after", after));
if (minChanged) {
    auditService.log(AuditAction.INGREDIENT_MIN_UPDATED, "Ingredient", saved.getId(), actorUserId,
            Map.of("before", before.get("minQuantity"), "after", after.get("minQuantity")));
}
```

- `deactivate` → `INGREDIENT_DEACTIVATED` with `details = null`.

Update the three controller call sites to pass `AuthenticatedUser.currentId()`.

> Read the existing `IngredientService.update` to identify all fields that should appear in `before`/`after`. Include at minimum: name, category id, minQuantity, unitOfMeasure, active.

- [ ] **Step 1:** Edit `IngredientService.java`.
- [ ] **Step 2:** Edit `IngredientController.java`.
- [ ] **Step 3:** `mvnw.cmd compile` — confirm.
- [ ] **Step 4:** Commit.

```bash
git add src/main/java/br/com/easy_inventory/management/ingredient/service/IngredientService.java \
        src/main/java/br/com/easy_inventory/management/ingredient/controller/IngredientController.java
git commit -m "feat(sp4): audit ingredient create/update/deactivate + min-updated action"
```

---

## Task 22: Instrument `ProductService` with audit

**Files:**
- Modify `src/main/java/br/com/easy_inventory/management/product/service/ProductService.java`
- Modify `src/main/java/br/com/easy_inventory/management/product/controller/ProductController.java`

Same pattern as Task 21, with two extra adicional events:
- `update` captures pre-update `price` and pre-update recipe (a `Set<UUID>` of ingredient IDs and quantities map). After applying changes, emit:
  - Always: `PRODUCT_UPDATED` with `before/after`
  - When `price` changed: `PRODUCT_PRICE_CHANGED` with `{ before: <old>, after: <new> }`
  - When recipe changed (any new/removed ingredient or any quantity changed): `PRODUCT_RECIPE_CHANGED` with `{ before: [...], after: [...] }`
- `create` → `PRODUCT_CREATED` with `{ name, size, price, ingredientCount }`.
- `deactivate` → `PRODUCT_DEACTIVATED`.

Recipe-change detection (in `update`, before clearing ingredients):

```java
Map<UUID, BigDecimal> oldRecipe = product.getIngredients().stream()
        .collect(Collectors.toMap(pi -> pi.getIngredient().getId(), ProductIngredient::getQuantity));
BigDecimal oldPrice = product.getPrice();
```

After save:
```java
Map<UUID, BigDecimal> newRecipe = product.getIngredients().stream()
        .collect(Collectors.toMap(pi -> pi.getIngredient().getId(), ProductIngredient::getQuantity));

boolean priceChanged = oldPrice.compareTo(saved.getPrice()) != 0;
boolean recipeChanged = !oldRecipe.equals(newRecipe);
```

Emit events accordingly.

Update controller `create`/`update`/`deactivate` to pass `AuthenticatedUser.currentId()`.

- [ ] **Step 1:** Edit `ProductService.java`.
- [ ] **Step 2:** Edit `ProductController.java`.
- [ ] **Step 3:** `mvnw.cmd compile` — confirm.
- [ ] **Step 4:** Commit.

```bash
git add src/main/java/br/com/easy_inventory/management/product/service/ProductService.java \
        src/main/java/br/com/easy_inventory/management/product/controller/ProductController.java
git commit -m "feat(sp4): audit product create/update/deactivate + price/recipe changed actions"
```

---

## Task 23: Instrument `PurchaseOrderService` with audit

**Files:**
- Modify `src/main/java/br/com/easy_inventory/management/purchase/service/PurchaseOrderService.java`
- Modify `src/main/java/br/com/easy_inventory/management/purchase/controller/PurchaseOrderController.java`

Inject `AuditService`. The signatures already vary:
- `create(req, actorUserId)` — already has actorId; add audit at end with `PURCHASE_ORDER_CREATED` and `Map.of("supplierId", po.getSupplier().getId(), "totalItems", po.getItems().size(), "totalValue", po.getTotalValue())`.
- `update(id, req)` — add `UUID actorUserId` parameter; audit `PURCHASE_ORDER_UPDATED`. (If the spec didn't list `PURCHASE_ORDER_UPDATED` explicitly, reuse `PURCHASE_ORDER_CREATED` action wording — no, follow spec: only `_CREATED`, `_RECEIVED`, `_CANCELED`. So audit update as `PURCHASE_ORDER_CREATED`? No — the spec lists only those three. Skip auditing the `update` method, since it's covered conceptually by re-creating the draft.)

  **Decision:** `update` does NOT emit an audit log (no matching action). Only `create`, `receive`, `cancel` do. Still add `actorUserId` parameter for symmetry only if needed by other audit calls — otherwise leave its signature alone.

  → **Final:** keep `update(id, req)` unchanged (no actor needed, no audit).

- `receive(id, actorUserId)` — already has actorId; audit `PURCHASE_ORDER_RECEIVED` with `Map.of("supplierId", po.getSupplier().getId(), "itemsReceived", po.getItems().size())`.
- `cancel(id)` — add `UUID actorUserId` parameter; audit `PURCHASE_ORDER_CANCELED` with `Map.of("supplierId", po.getSupplier().getId())`.

Update controller call sites:
```java
purchaseOrderService.create(request, AuthenticatedUser.currentId()); // unchanged signature, already passes actor
purchaseOrderService.receive(id, AuthenticatedUser.currentId());     // unchanged, already passes actor
purchaseOrderService.cancel(id, AuthenticatedUser.currentId());      // NEW — pass actor
// update unchanged
```

- [ ] **Step 1:** Edit `PurchaseOrderService.java`.
- [ ] **Step 2:** Edit `PurchaseOrderController.java`.
- [ ] **Step 3:** `mvnw.cmd compile` — confirm.
- [ ] **Step 4:** Commit.

```bash
git add src/main/java/br/com/easy_inventory/management/purchase/service/PurchaseOrderService.java \
        src/main/java/br/com/easy_inventory/management/purchase/controller/PurchaseOrderController.java
git commit -m "feat(sp4): audit purchase order create/receive/cancel"
```

---

## Task 24: Instrument `OrderService` with audit

**Files:**
- Modify `src/main/java/br/com/easy_inventory/management/order/service/OrderService.java`
- Modify `src/main/java/br/com/easy_inventory/management/order/controller/OrderController.java`

Inject `AuditService`. Signatures:
- `create(req, actorUserId)` — already has actor; audit `ORDER_CREATED` with `Map.of("unitId", order.getUnit().getId(), "totalPrice", order.getTotalPrice(), "itemsCount", order.getItems().size())`.
- `update(id, req)` — add `UUID actorUserId` parameter; audit `ORDER_UPDATED` with `Map.of("unitId", order.getUnit().getId(), "totalPrice", order.getTotalPrice(), "itemsCount", order.getItems().size())`.
- `start(id, actorUserId)` — already has actor; audit `ORDER_STARTED` with `Map.of("unitId", order.getUnit().getId(), "totalPrice", order.getTotalPrice(), "itemsCount", order.getItems().size())`.
- `complete(id)` — add `UUID actorUserId`; audit `ORDER_COMPLETED`.
- `cancel(id)` — add `UUID actorUserId`; audit `ORDER_CANCELED`.

Update controller call sites to pass `AuthenticatedUser.currentId()` for `update`, `complete`, `cancel`.

- [ ] **Step 1:** Edit `OrderService.java`.
- [ ] **Step 2:** Edit `OrderController.java`.
- [ ] **Step 3:** `mvnw.cmd compile` — confirm.
- [ ] **Step 4:** Commit.

```bash
git add src/main/java/br/com/easy_inventory/management/order/service/OrderService.java \
        src/main/java/br/com/easy_inventory/management/order/controller/OrderController.java
git commit -m "feat(sp4): audit order create/update/start/complete/cancel"
```

---

## Task 25: Instrument `StockService` with audit

**Files:** Modify `src/main/java/br/com/easy_inventory/management/stock/service/StockService.java`

Inject `AuditService`. Update constructor parameter list (append `AuditService auditService`) and assignment.

In each of `applyEntry`, `applyExit`, `applyAdjustment`, immediately after `StockMovement saved = movementRepository.save(mv);` (before the `publisher.publishEvent` line added in Task 12) call `auditService.log(...)`:

```java
// applyEntry, after save:
auditService.log(AuditAction.STOCK_ENTRY, "StockMovement", saved.getId(), actorUserId,
        Map.of("ingredientId", ing.getId(), "unitId", unit.getId(),
               "quantity", quantity, "unitPrice", unitPrice,
               "purchaseOrderId", purchaseOrderId));

// applyExit, after save:
auditService.log(AuditAction.STOCK_EXIT, "StockMovement", saved.getId(), actorUserId,
        Map.of("ingredientId", ing.getId(), "unitId", unit.getId(),
               "quantity", quantity, "reason", reason == null ? "" : reason));

// applyAdjustment, after save:
auditService.log(AuditAction.STOCK_ADJUSTMENT, "StockMovement", saved.getId(), actorUserId,
        Map.of("ingredientId", ing.getId(), "unitId", unit.getId(),
               "quantity", quantity, "direction", direction.name(),
               "reason", reason));
```

Add the import:
```java
import br.com.easy_inventory.management.audit.entity.AuditAction;
import br.com.easy_inventory.management.audit.service.AuditService;
import java.util.Map;
```

> `Map.of` rejects null values. Handle nullable fields (`purchaseOrderId`, `reason`) defensively as shown — fall back to a sentinel string or use `HashMap` if you need true nulls.

- [ ] **Step 1:** Edit `StockService.java`.
- [ ] **Step 2:** `mvnw.cmd compile` — confirm.
- [ ] **Step 3:** Commit.

```bash
git add src/main/java/br/com/easy_inventory/management/stock/service/StockService.java
git commit -m "feat(sp4): audit stock entry/exit/adjustment movements"
```

---

## Task 26: Report DTOs

**Files:**
- Create `src/main/java/br/com/easy_inventory/management/report/dto/ConsumptionReportRow.java`
- Create `src/main/java/br/com/easy_inventory/management/report/dto/SalesReportRow.java`
- Create `src/main/java/br/com/easy_inventory/management/report/dto/WasteReportRow.java`
- Create `src/main/java/br/com/easy_inventory/management/report/dto/StockStatusRow.java`

**ConsumptionReportRow.java:**
```java
package br.com.easy_inventory.management.report.dto;

import br.com.easy_inventory.management.ingredient.entity.UnitOfMeasure;

import java.math.BigDecimal;
import java.util.UUID;

public record ConsumptionReportRow(
        UUID ingredientId,
        String ingredientName,
        UnitOfMeasure unitOfMeasure,
        BigDecimal totalQuantity,
        long movementCount
) {}
```

**SalesReportRow.java:**
```java
package br.com.easy_inventory.management.report.dto;

import br.com.easy_inventory.management.product.entity.ProductSize;

import java.math.BigDecimal;
import java.util.UUID;

public record SalesReportRow(
        UUID productId,
        String productName,
        ProductSize size,
        long unitsSold,
        BigDecimal revenue,
        long ordersCount
) {}
```

**WasteReportRow.java:**
```java
package br.com.easy_inventory.management.report.dto;

import br.com.easy_inventory.management.ingredient.entity.UnitOfMeasure;

import java.math.BigDecimal;
import java.util.UUID;

public record WasteReportRow(
        UUID ingredientId,
        String ingredientName,
        UnitOfMeasure unitOfMeasure,
        BigDecimal wasteQuantity,
        long adjustmentCount
) {}
```

**StockStatusRow.java:**
```java
package br.com.easy_inventory.management.report.dto;

import br.com.easy_inventory.management.ingredient.entity.UnitOfMeasure;

import java.math.BigDecimal;
import java.util.UUID;

public record StockStatusRow(
        UUID ingredientId,
        String ingredientName,
        UnitOfMeasure unitOfMeasure,
        BigDecimal currentQuantity,
        BigDecimal minQuantity,
        String level   // LOW | WARNING | OK
) {}
```

- [ ] **Step 1:** Create all four files.
- [ ] **Step 2:** Commit.

```bash
git add src/main/java/br/com/easy_inventory/management/report/dto/
git commit -m "feat(sp4): add report row DTOs (consumption, sales, waste, stock-status)"
```

---

## Task 27: `ReportService`

**Files:** Create `src/main/java/br/com/easy_inventory/management/report/service/ReportService.java`

```java
package br.com.easy_inventory.management.report.service;

import br.com.easy_inventory.management.report.dto.ConsumptionReportRow;
import br.com.easy_inventory.management.report.dto.SalesReportRow;
import br.com.easy_inventory.management.report.dto.StockStatusRow;
import br.com.easy_inventory.management.report.dto.WasteReportRow;
import br.com.easy_inventory.management.shared.exception.BusinessException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class ReportService {

    @PersistenceContext
    private EntityManager em;

    public List<ConsumptionReportRow> consumption(LocalDateTime from, LocalDateTime to,
                                                  UUID unitId, UUID ingredientId) {
        validateRange(from, to);
        var sql = """
            SELECT m.ingredient_id, i.name, i.unit_of_measure,
                   SUM(m.quantity) AS total_qty,
                   COUNT(*) AS movement_count
              FROM stock_movements m
              JOIN ingredients i ON i.id = m.ingredient_id
             WHERE m.type = 'EXIT'
               AND (CAST(:unitId AS uuid) IS NULL OR m.unit_id = CAST(:unitId AS uuid))
               AND (CAST(:ingredientId AS uuid) IS NULL OR m.ingredient_id = CAST(:ingredientId AS uuid))
               AND m.created_at BETWEEN :from AND :to
             GROUP BY m.ingredient_id, i.name, i.unit_of_measure
             ORDER BY total_qty DESC
            """;
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery(sql)
                .setParameter("unitId", unitId == null ? null : unitId.toString())
                .setParameter("ingredientId", ingredientId == null ? null : ingredientId.toString())
                .setParameter("from", from).setParameter("to", to)
                .getResultList();
        return rows.stream().map(r -> new ConsumptionReportRow(
                (UUID) r[0],
                (String) r[1],
                br.com.easy_inventory.management.ingredient.entity.UnitOfMeasure.valueOf((String) r[2]),
                (BigDecimal) r[3],
                ((Number) r[4]).longValue()
        )).toList();
    }

    public List<SalesReportRow> sales(LocalDateTime from, LocalDateTime to,
                                      UUID unitId, UUID productId) {
        validateRange(from, to);
        var sql = """
            SELECT oi.product_id, p.name, p.size,
                   SUM(oi.quantity) AS units_sold,
                   SUM(oi.quantity * oi.unit_price) AS revenue,
                   COUNT(DISTINCT oi.order_id) AS orders_count
              FROM order_items oi
              JOIN orders o ON o.id = oi.order_id
              JOIN products p ON p.id = oi.product_id
             WHERE o.status = 'COMPLETED'
               AND (CAST(:unitId AS uuid) IS NULL OR o.unit_id = CAST(:unitId AS uuid))
               AND (CAST(:productId AS uuid) IS NULL OR oi.product_id = CAST(:productId AS uuid))
               AND o.completed_at BETWEEN :from AND :to
             GROUP BY oi.product_id, p.name, p.size
             ORDER BY revenue DESC
            """;
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery(sql)
                .setParameter("unitId", unitId == null ? null : unitId.toString())
                .setParameter("productId", productId == null ? null : productId.toString())
                .setParameter("from", from).setParameter("to", to)
                .getResultList();
        return rows.stream().map(r -> new SalesReportRow(
                (UUID) r[0],
                (String) r[1],
                br.com.easy_inventory.management.product.entity.ProductSize.valueOf((String) r[2]),
                ((Number) r[3]).longValue(),
                (BigDecimal) r[4],
                ((Number) r[5]).longValue()
        )).toList();
    }

    public List<WasteReportRow> waste(LocalDateTime from, LocalDateTime to,
                                      UUID unitId, UUID ingredientId) {
        validateRange(from, to);
        var sql = """
            SELECT m.ingredient_id, i.name, i.unit_of_measure,
                   SUM(m.quantity) AS waste_qty,
                   COUNT(*) AS adjustment_count
              FROM stock_movements m
              JOIN ingredients i ON i.id = m.ingredient_id
             WHERE m.type = 'ADJUSTMENT'
               AND m.direction = 'DECREASE'
               AND (CAST(:unitId AS uuid) IS NULL OR m.unit_id = CAST(:unitId AS uuid))
               AND (CAST(:ingredientId AS uuid) IS NULL OR m.ingredient_id = CAST(:ingredientId AS uuid))
               AND m.created_at BETWEEN :from AND :to
             GROUP BY m.ingredient_id, i.name, i.unit_of_measure
             ORDER BY waste_qty DESC
            """;
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery(sql)
                .setParameter("unitId", unitId == null ? null : unitId.toString())
                .setParameter("ingredientId", ingredientId == null ? null : ingredientId.toString())
                .setParameter("from", from).setParameter("to", to)
                .getResultList();
        return rows.stream().map(r -> new WasteReportRow(
                (UUID) r[0],
                (String) r[1],
                br.com.easy_inventory.management.ingredient.entity.UnitOfMeasure.valueOf((String) r[2]),
                (BigDecimal) r[3],
                ((Number) r[4]).longValue()
        )).toList();
    }

    public List<StockStatusRow> stockStatus(UUID unitId) {
        var sql = """
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
               AND (CAST(:unitId AS uuid) IS NULL OR s.unit_id = CAST(:unitId AS uuid))
             ORDER BY (s.quantity / NULLIF(i.min_quantity, 0)) ASC
            """;
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery(sql)
                .setParameter("unitId", unitId == null ? null : unitId.toString())
                .getResultList();
        return rows.stream().map(r -> new StockStatusRow(
                (UUID) r[0],
                (String) r[1],
                br.com.easy_inventory.management.ingredient.entity.UnitOfMeasure.valueOf((String) r[2]),
                (BigDecimal) r[3],
                (BigDecimal) r[4],
                (String) r[5]
        )).toList();
    }

    private void validateRange(LocalDateTime from, LocalDateTime to) {
        if (from == null || to == null) {
            throw new BusinessException("Both 'from' and 'to' are required");
        }
        if (from.isAfter(to)) {
            throw new BusinessException("'from' must be ≤ 'to'");
        }
    }
}
```

> **Why native queries with `CAST(:param AS uuid)`:** the SP3 plan's `OrderRepository` had to cast nullable parameters explicitly because PostgreSQL JDBC infers types eagerly and `:param IS NULL` on an untyped param fails. The `cast(... as uuid)` workaround mirrors what worked there. The previous fix `cbf92cd` is precedent.

- [ ] **Step 1:** Create the file.
- [ ] **Step 2:** `mvnw.cmd compile` — confirm.
- [ ] **Step 3:** Commit.

```bash
git add src/main/java/br/com/easy_inventory/management/report/service/ReportService.java
git commit -m "feat(sp4): add ReportService with four aggregated queries"
```

---

## Task 28: `ReportController` + `SecurityConfig` permit

**Files:**
- Create `src/main/java/br/com/easy_inventory/management/report/controller/ReportController.java`
- Modify `src/main/java/br/com/easy_inventory/management/shared/security/SecurityConfig.java`

**ReportController.java:**
```java
package br.com.easy_inventory.management.report.controller;

import br.com.easy_inventory.management.report.dto.ConsumptionReportRow;
import br.com.easy_inventory.management.report.dto.SalesReportRow;
import br.com.easy_inventory.management.report.dto.StockStatusRow;
import br.com.easy_inventory.management.report.dto.WasteReportRow;
import br.com.easy_inventory.management.report.service.ReportService;
import br.com.easy_inventory.management.shared.dto.ApiResponse;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/reports")
public class ReportController {

    private final ReportService service;

    public ReportController(ReportService service) {
        this.service = service;
    }

    @GetMapping("/consumption")
    public ResponseEntity<ApiResponse<List<ConsumptionReportRow>>> consumption(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(required = false) UUID unit,
            @RequestParam(required = false) UUID ingredient) {
        return ResponseEntity.ok(ApiResponse.of(service.consumption(from, to, unit, ingredient)));
    }

    @GetMapping("/sales")
    public ResponseEntity<ApiResponse<List<SalesReportRow>>> sales(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(required = false) UUID unit,
            @RequestParam(required = false) UUID product) {
        return ResponseEntity.ok(ApiResponse.of(service.sales(from, to, unit, product)));
    }

    @GetMapping("/waste")
    public ResponseEntity<ApiResponse<List<WasteReportRow>>> waste(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(required = false) UUID unit,
            @RequestParam(required = false) UUID ingredient) {
        return ResponseEntity.ok(ApiResponse.of(service.waste(from, to, unit, ingredient)));
    }

    @GetMapping("/stock-status")
    public ResponseEntity<ApiResponse<List<StockStatusRow>>> stockStatus(
            @RequestParam(required = false) UUID unit) {
        return ResponseEntity.ok(ApiResponse.of(service.stockStatus(unit)));
    }
}
```

**SecurityConfig.java — locate the line added in Task 13:**
```java
.requestMatchers(HttpMethod.GET, "/notifications", "/notifications/**").permitAll()
```

Add immediately below it:

```java
.requestMatchers(HttpMethod.GET, "/reports/**").permitAll()
```

- [ ] **Step 1:** Create `ReportController.java`.
- [ ] **Step 2:** Edit `SecurityConfig.java` to add the permit.
- [ ] **Step 3:** `mvnw.cmd compile` — confirm.
- [ ] **Step 4:** Commit.

```bash
git add src/main/java/br/com/easy_inventory/management/report/controller/ReportController.java \
        src/main/java/br/com/easy_inventory/management/shared/security/SecurityConfig.java
git commit -m "feat(sp4): add ReportController with four endpoints"
```

---

## Task 29: Smoke verification (manual)

**Steps:**

1. `docker-compose up -d` — Postgres running.
2. `mvnw.cmd clean package -DskipTests` — full compile.
3. `mvnw.cmd spring-boot:run` — app starts cleanly, Flyway applies V17, V18, V19.
4. Open Swagger at `http://localhost:8080/swagger-ui.html`. Verify the new endpoints appear:
   - `/notifications` (GET, GET /{id}, POST /{id}/resolve)
   - `/audit-logs` (GET, GET /{id})
   - `/reports/consumption`, `/reports/sales`, `/reports/waste`, `/reports/stock-status`
5. Login via `/auth/login` → click "Authorize" → paste access token (OWNER user from V5).
6. End-to-end smoke:
   - **Audit on user create:** `POST /users` with a new EMPLOYEE → `GET /audit-logs?action=USER_CREATED` shows one new entry; `details` JSON includes name/email/role.
   - **Notification raise:** Pick an ingredient with `min_quantity > 0` and current `stock.quantity` slightly above min. `POST /stock-movements/exit` with quantity that pushes stock below min → `GET /notifications?status=ACTIVE` returns one row matching that (ingredient, unit) with the formatted `message`.
   - **Notification dedup:** `POST /stock-movements/exit` again on the same ingredient/unit → `GET /notifications?status=ACTIVE` still has only one row (no duplicate).
   - **Auto-resolve:** `POST /stock-movements/entry` to push stock back above min → `GET /notifications?status=RESOLVED` shows the previous row with `resolvedAt` set and `resolvedBy = null`.
   - **Manual resolve:** Trigger another LOW; `POST /notifications/{id}/resolve` → returns row with `resolvedBy = <your userId>`. Calling resolve again returns 400.
   - **Stock audit:** `GET /audit-logs?entityType=StockMovement` lists STOCK_ENTRY/EXIT/ADJUSTMENT entries.
   - **Adjustment direction persisted:** `POST /stock-movements/adjustment` with `direction=DECREASE` and a reason → `GET /stock-movements/{id}` response now shows `direction: "DECREASE"`. Audit log row includes `"direction":"DECREASE"`.
   - **Reports — consumption:** `GET /reports/consumption?from=2026-04-01T00:00:00&to=2026-04-30T23:59:59` returns sums per ingredient that match the EXIT movements created above.
   - **Reports — sales:** Complete an order from SP3, then `GET /reports/sales?from=...&to=...` shows one row for that product with revenue = price × qty.
   - **Reports — waste:** `GET /reports/waste?from=...&to=...` shows the DECREASE adjustment from above. Pre-existing ADJUSTMENT rows (with NULL direction) are absent.
   - **Reports — stock-status:** `GET /reports/stock-status` returns rows with `level` ∈ {LOW, WARNING, OK} sorted by ratio ascending.
   - **Audit OWNER-only:** Login as a non-OWNER user → `GET /audit-logs` returns 403.
   - **Reports auth:** Same non-OWNER login → `GET /reports/sales?...` returns 200 (EMPLOYEE allowed).
   - **Bad date range:** `GET /reports/consumption?from=2026-05-01T00:00:00&to=2026-04-01T00:00:00` returns 400 with "from must be ≤ to".
7. Stop the app. No commit.

---

## Handoff to Testing

After Task 29 passes, hand off for integration tests. Expected test files:

- `src/test/java/.../notification/NotificationListenerTest.java` — covers: `applyExit` that pushes stock below min raises a notification (ACTIVE row with correct snapshot fields); second exit doesn't duplicate (dedup partial-index path); `applyEntry` above min auto-resolves (resolved_at set, resolved_by null); rollback in `applyExit` (insufficient stock) does NOT create a notification (AFTER_COMMIT proof); `resolveManually` sets resolvedBy to actor and rejects already-resolved.

- `src/test/java/.../notification/NotificationControllerTest.java` — covers: GET list with status/unit/from/to filters, GET by id, POST /resolve OWNER-only, POST /resolve on non-active returns 400.

- `src/test/java/.../audit/AuditLogIntegrationTest.java` — covers: each instrumented service method writes one row with the right action, entity_type, entity_id, actor; rollback in caller rolls back audit row; GET /audit-logs filters by entityType/entityId/actorId/action/from/to; OWNER-only.

- `src/test/java/.../audit/AuditDetailsTest.java` — covers: `INGREDIENT_MIN_UPDATED` is emitted in addition to `INGREDIENT_UPDATED` only when `minQuantity` changes; `PRODUCT_PRICE_CHANGED` only when price changes; `PRODUCT_RECIPE_CHANGED` only when recipe changes (added/removed/quantity changed ingredient); `USER_ROLE_CHANGED` only when role changes.

- `src/test/java/.../report/ReportServiceTest.java` — for each report: fixture data → query → asserted aggregation; bad range returns 400; null filters return all rows.

- `src/test/java/.../movement/StockMovementDirectionTest.java` — `applyAdjustment(INCREASE)` and `applyAdjustment(DECREASE)` both persist and expose `direction` correctly; `applyEntry` and `applyExit` leave `direction` null.

**Do not create these files yourself.** The user's workflow is to hand them off so Claude writes them.
