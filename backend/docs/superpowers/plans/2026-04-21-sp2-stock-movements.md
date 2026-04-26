# SP2 Stock Movements Implementation Plan

> **Goal:** Implement SP2 — stock balances, immutable stock movements, purchase orders with receive workflow, weighted-average cost calculation, and low-stock endpoint.

**Architecture:** Three new domain packages (`stock/`, `movement/`, `purchase/`) extending SP1. `StockService` is the single writer of stock balances and the owner of the `stock.quantity + ingredient.average_cost` invariant, protected by pessimistic row locks.

**Tech Stack:** Java 21, Spring Boot 4.0.5, Spring Security 6, JJWT 0.12.6, Spring Data JPA, PostgreSQL 16, Flyway, SpringDoc 3.0.3.

**Note on tests:** this project is a learning exercise. The user implements the code; Claude writes integration tests afterward. This plan does **not** include test tasks. Once tasks 1-17 are done, hand off for testing.

---

## File Map

```
src/main/resources/db/migration/
  V9__create_stock.sql                    (new)
  V10__create_stock_movements.sql         (new)
  V11__create_purchase_orders.sql         (new)
  V12__create_purchase_order_items.sql    (new)

src/main/java/br/com/easy_inventory/management/
  shared/security/AuthenticatedUser.java  (new)
  shared/security/SecurityConfig.java     (modify: add permits for GETs)

  stock/
    entity/Stock.java
    repository/StockRepository.java
    dto/StockResponse.java
    service/StockService.java
    controller/StockController.java

  movement/
    entity/MovementType.java
    entity/AdjustmentDirection.java
    entity/StockMovement.java
    repository/StockMovementRepository.java
    dto/MovementResponse.java
    dto/CreateAdjustmentRequest.java
    service/MovementService.java
    controller/MovementController.java

  purchase/
    entity/PurchaseOrderStatus.java
    entity/PurchaseOrder.java
    entity/PurchaseOrderItem.java
    repository/PurchaseOrderRepository.java
    dto/PurchaseOrderItemRequest.java
    dto/PurchaseOrderItemResponse.java
    dto/CreatePurchaseOrderRequest.java
    dto/UpdatePurchaseOrderRequest.java
    dto/PurchaseOrderResponse.java
    service/PurchaseOrderService.java
    controller/PurchaseOrderController.java
```

---

## Task 1: V9 — stock table

**Files:** Create `src/main/resources/db/migration/V9__create_stock.sql`

```sql
CREATE TABLE stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    unit_id UUID NOT NULL REFERENCES units(id),
    quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_stock_ingredient_unit UNIQUE (ingredient_id, unit_id)
);

CREATE INDEX idx_stock_unit ON stock(unit_id);
CREATE INDEX idx_stock_ingredient ON stock(ingredient_id);
```

Commit: `git commit -m "feat(sp2): add V9 stock migration"`

---

## Task 2: V10 — stock_movements table

**Files:** Create `src/main/resources/db/migration/V10__create_stock_movements.sql`

```sql
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    unit_id UUID NOT NULL REFERENCES units(id),
    type VARCHAR(20) NOT NULL CHECK (type IN ('ENTRY', 'EXIT', 'ADJUSTMENT')),
    quantity DECIMAL(10,3) NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,4),
    reason VARCHAR(255),
    purchase_order_id UUID,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_movements_ingredient_unit_date
    ON stock_movements(ingredient_id, unit_id, created_at DESC);
CREATE INDEX idx_movements_po ON stock_movements(purchase_order_id);
CREATE INDEX idx_movements_type ON stock_movements(type);
```

FK to purchase_orders is added in Task 4 (after that table exists).

Commit: `git commit -m "feat(sp2): add V10 stock_movements migration"`

---

## Task 3: V11 — purchase_orders table

**Files:** Create `src/main/resources/db/migration/V11__create_purchase_orders.sql`

```sql
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    unit_id UUID NOT NULL REFERENCES units(id),
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'RECEIVED', 'CANCELED')),
    total_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
    notes VARCHAR(500),
    expected_at DATE,
    received_at TIMESTAMP,
    canceled_at TIMESTAMP,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_po_status ON purchase_orders(status);
CREATE INDEX idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_po_unit ON purchase_orders(unit_id);

ALTER TABLE stock_movements
    ADD CONSTRAINT fk_movements_po
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id);
```

Commit: `git commit -m "feat(sp2): add V11 purchase_orders migration"`

---

## Task 4: V12 — purchase_order_items table

**Files:** Create `src/main/resources/db/migration/V12__create_purchase_order_items.sql`

```sql
CREATE TABLE purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    quantity DECIMAL(10,3) NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,4) NOT NULL CHECK (unit_price >= 0),
    CONSTRAINT uq_po_item_ingredient UNIQUE (purchase_order_id, ingredient_id)
);

CREATE INDEX idx_po_items_po ON purchase_order_items(purchase_order_id);
```

Commit: `git commit -m "feat(sp2): add V12 purchase_order_items migration"`

---

## Task 5: AuthenticatedUser helper

**Files:** Create `src/main/java/br/com/easy_inventory/management/shared/security/AuthenticatedUser.java`

```java
package br.com.easy_inventory.management.shared.security;

import br.com.easy_inventory.management.user.entity.User;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;

public final class AuthenticatedUser {

    private AuthenticatedUser() {}

    public static User current() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof User user)) {
            throw new IllegalStateException("No authenticated user in security context");
        }
        return user;
    }

    public static UUID currentId() {
        return current().getId();
    }
}
```

Commit: `git commit -m "feat(sp2): add AuthenticatedUser security helper"`

---

## Task 6: Stock entity + repository

**Files:**
- `src/main/java/br/com/easy_inventory/management/stock/entity/Stock.java`
- `src/main/java/br/com/easy_inventory/management/stock/repository/StockRepository.java`

**Stock.java:**
```java
package br.com.easy_inventory.management.stock.entity;

import br.com.easy_inventory.management.ingredient.entity.Ingredient;
import br.com.easy_inventory.management.unit.entity.Unit;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "stock",
       uniqueConstraints = @UniqueConstraint(name = "uq_stock_ingredient_unit",
                                             columnNames = {"ingredient_id", "unit_id"}))
public class Stock {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ingredient_id", nullable = false)
    private Ingredient ingredient;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "unit_id", nullable = false)
    private Unit unit;

    @Column(nullable = false, precision = 10, scale = 3)
    private BigDecimal quantity = BigDecimal.ZERO;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist @PreUpdate
    void touch() { this.updatedAt = LocalDateTime.now(); }

    public Stock() {}

    public Stock(Ingredient ingredient, Unit unit, BigDecimal quantity) {
        this.ingredient = ingredient;
        this.unit = unit;
        this.quantity = quantity;
    }

    public UUID getId() { return id; }
    public Ingredient getIngredient() { return ingredient; }
    public void setIngredient(Ingredient ingredient) { this.ingredient = ingredient; }
    public Unit getUnit() { return unit; }
    public void setUnit(Unit unit) { this.unit = unit; }
    public BigDecimal getQuantity() { return quantity; }
    public void setQuantity(BigDecimal quantity) { this.quantity = quantity; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
```

**StockRepository.java:**
```java
package br.com.easy_inventory.management.stock.repository;

import br.com.easy_inventory.management.stock.entity.Stock;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface StockRepository extends JpaRepository<Stock, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Stock s " +
           "where s.ingredient.id = :ingredientId and s.unit.id = :unitId")
    Optional<Stock> findForUpdate(@Param("ingredientId") UUID ingredientId,
                                  @Param("unitId") UUID unitId);

    Optional<Stock> findByIngredientIdAndUnitId(UUID ingredientId, UUID unitId);

    Page<Stock> findByUnitId(UUID unitId, Pageable pageable);
    Page<Stock> findByIngredientId(UUID ingredientId, Pageable pageable);
    Page<Stock> findByIngredientIdAndUnitId(UUID ingredientId, UUID unitId, Pageable pageable);

    @Query("select s from Stock s where s.quantity < s.ingredient.minimumQty")
    Page<Stock> findBelowMinimum(Pageable pageable);
}
```

Commit: `git commit -m "feat(sp2): add Stock entity and repository with pessimistic lock"`

---

## Task 7: Stock DTOs + read-side StockService

**Files:**
- `src/main/java/br/com/easy_inventory/management/stock/dto/StockResponse.java`
- `src/main/java/br/com/easy_inventory/management/stock/service/StockService.java`

**StockResponse.java:**
```java
package br.com.easy_inventory.management.stock.dto;

import br.com.easy_inventory.management.stock.entity.Stock;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record StockResponse(
        UUID id,
        UUID ingredientId, String ingredientName,
        UUID unitId, String unitName,
        BigDecimal quantity,
        BigDecimal minimumQty,
        boolean belowMinimum,
        BigDecimal averageCost,
        LocalDateTime updatedAt
) {
    public static StockResponse from(Stock s) {
        var ing = s.getIngredient();
        var unit = s.getUnit();
        boolean below = s.getQuantity().compareTo(ing.getMinimumQty()) < 0;
        return new StockResponse(
                s.getId(),
                ing.getId(), ing.getName(),
                unit.getId(), unit.getName(),
                s.getQuantity(),
                ing.getMinimumQty(),
                below,
                ing.getAverageCost(),
                s.getUpdatedAt()
        );
    }
}
```

**StockService.java (read-only shell — write methods in Task 8):**
```java
package br.com.easy_inventory.management.stock.service;

import br.com.easy_inventory.management.shared.exception.ResourceNotFoundException;
import br.com.easy_inventory.management.stock.dto.StockResponse;
import br.com.easy_inventory.management.stock.entity.Stock;
import br.com.easy_inventory.management.stock.repository.StockRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class StockService {

    private final StockRepository stockRepository;

    public StockService(StockRepository stockRepository) {
        this.stockRepository = stockRepository;
    }

    public Page<StockResponse> findAll(UUID unitId, UUID ingredientId, Pageable pageable) {
        Page<Stock> page;
        if (unitId != null && ingredientId != null) {
            page = stockRepository.findByIngredientIdAndUnitId(ingredientId, unitId, pageable);
        } else if (unitId != null) {
            page = stockRepository.findByUnitId(unitId, pageable);
        } else if (ingredientId != null) {
            page = stockRepository.findByIngredientId(ingredientId, pageable);
        } else {
            page = stockRepository.findAll(pageable);
        }
        return page.map(StockResponse::from);
    }

    public StockResponse findById(UUID id) {
        return StockResponse.from(getOrThrow(id));
    }

    public Page<StockResponse> findBelowMinimum(Pageable pageable) {
        return stockRepository.findBelowMinimum(pageable).map(StockResponse::from);
    }

    private Stock getOrThrow(UUID id) {
        return stockRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Stock not found: " + id));
    }
}
```

Commit: `git commit -m "feat(sp2): add StockResponse DTO and read-side StockService"`

---

## Task 8: StockService write methods (core logic)

**Files:** Modify `src/main/java/br/com/easy_inventory/management/stock/service/StockService.java`

Add write methods and dependencies. Full updated file:

```java
package br.com.easy_inventory.management.stock.service;

import br.com.easy_inventory.management.ingredient.entity.Ingredient;
import br.com.easy_inventory.management.ingredient.repository.IngredientRepository;
import br.com.easy_inventory.management.movement.entity.AdjustmentDirection;
import br.com.easy_inventory.management.movement.entity.MovementType;
import br.com.easy_inventory.management.movement.entity.StockMovement;
import br.com.easy_inventory.management.movement.repository.StockMovementRepository;
import br.com.easy_inventory.management.shared.exception.BusinessException;
import br.com.easy_inventory.management.shared.exception.ResourceNotFoundException;
import br.com.easy_inventory.management.stock.dto.StockResponse;
import br.com.easy_inventory.management.stock.entity.Stock;
import br.com.easy_inventory.management.stock.repository.StockRepository;
import br.com.easy_inventory.management.unit.entity.Unit;
import br.com.easy_inventory.management.unit.repository.UnitRepository;
import br.com.easy_inventory.management.user.entity.User;
import br.com.easy_inventory.management.user.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;

@Service
public class StockService {

    private final StockRepository stockRepository;
    private final StockMovementRepository movementRepository;
    private final IngredientRepository ingredientRepository;
    private final UnitRepository unitRepository;
    private final UserRepository userRepository;
    private final EntityManager entityManager;

    public StockService(StockRepository stockRepository,
                        StockMovementRepository movementRepository,
                        IngredientRepository ingredientRepository,
                        UnitRepository unitRepository,
                        UserRepository userRepository,
                        EntityManager entityManager) {
        this.stockRepository = stockRepository;
        this.movementRepository = movementRepository;
        this.ingredientRepository = ingredientRepository;
        this.unitRepository = unitRepository;
        this.userRepository = userRepository;
        this.entityManager = entityManager;
    }

    // ----- READ -----

    public Page<StockResponse> findAll(UUID unitId, UUID ingredientId, Pageable pageable) {
        Page<Stock> page;
        if (unitId != null && ingredientId != null) {
            page = stockRepository.findByIngredientIdAndUnitId(ingredientId, unitId, pageable);
        } else if (unitId != null) {
            page = stockRepository.findByUnitId(unitId, pageable);
        } else if (ingredientId != null) {
            page = stockRepository.findByIngredientId(ingredientId, pageable);
        } else {
            page = stockRepository.findAll(pageable);
        }
        return page.map(StockResponse::from);
    }

    public StockResponse findById(UUID id) {
        return StockResponse.from(getOrThrow(id));
    }

    public Page<StockResponse> findBelowMinimum(Pageable pageable) {
        return stockRepository.findBelowMinimum(pageable).map(StockResponse::from);
    }

    // ----- WRITE -----

    @Transactional
    public StockMovement applyEntry(UUID ingredientId, UUID unitId,
                                    BigDecimal quantity, BigDecimal unitPrice,
                                    UUID purchaseOrderId, UUID actorUserId) {
        if (quantity == null || quantity.signum() <= 0) {
            throw new BusinessException("Entry quantity must be positive");
        }
        if (unitPrice == null || unitPrice.signum() < 0) {
            throw new BusinessException("Entry unit price must be non-negative");
        }

        Ingredient ing = ingredientRepository.findById(ingredientId)
                .orElseThrow(() -> new ResourceNotFoundException("Ingredient not found: " + ingredientId));
        Unit unit = unitRepository.findById(unitId)
                .orElseThrow(() -> new ResourceNotFoundException("Unit not found: " + unitId));
        User actor = userRepository.findById(actorUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + actorUserId));

        Stock stock = lockOrCreate(ing, unit);

        BigDecimal currentQty = stock.getQuantity();
        BigDecimal currentAvg = ing.getAverageCost() == null ? BigDecimal.ZERO : ing.getAverageCost();

        BigDecimal newQty = currentQty.add(quantity);
        BigDecimal newAvg = currentQty.multiply(currentAvg)
                .add(quantity.multiply(unitPrice))
                .divide(newQty, 4, RoundingMode.HALF_UP);

        stock.setQuantity(newQty);
        ing.setAverageCost(newAvg);

        stockRepository.save(stock);
        ingredientRepository.save(ing);

        StockMovement mv = new StockMovement();
        mv.setIngredient(ing);
        mv.setUnit(unit);
        mv.setType(MovementType.ENTRY);
        mv.setQuantity(quantity);
        mv.setUnitPrice(unitPrice);
        mv.setPurchaseOrderId(purchaseOrderId);
        mv.setCreatedBy(actor);
        return movementRepository.save(mv);
    }

    @Transactional
    public StockMovement applyExit(UUID ingredientId, UUID unitId,
                                   BigDecimal quantity, String reason, UUID actorUserId) {
        if (quantity == null || quantity.signum() <= 0) {
            throw new BusinessException("Exit quantity must be positive");
        }

        Ingredient ing = ingredientRepository.findById(ingredientId)
                .orElseThrow(() -> new ResourceNotFoundException("Ingredient not found: " + ingredientId));
        Unit unit = unitRepository.findById(unitId)
                .orElseThrow(() -> new ResourceNotFoundException("Unit not found: " + unitId));
        User actor = userRepository.findById(actorUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + actorUserId));

        Stock stock = lockOrCreate(ing, unit);

        if (stock.getQuantity().compareTo(quantity) < 0) {
            throw new BusinessException("Insufficient stock: available="
                    + stock.getQuantity() + ", requested=" + quantity);
        }

        stock.setQuantity(stock.getQuantity().subtract(quantity));
        stockRepository.save(stock);

        StockMovement mv = new StockMovement();
        mv.setIngredient(ing);
        mv.setUnit(unit);
        mv.setType(MovementType.EXIT);
        mv.setQuantity(quantity);
        mv.setReason(reason);
        mv.setCreatedBy(actor);
        return movementRepository.save(mv);
    }

    @Transactional
    public StockMovement applyAdjustment(UUID ingredientId, UUID unitId,
                                         BigDecimal quantity, AdjustmentDirection direction,
                                         String reason, UUID actorUserId) {
        if (quantity == null || quantity.signum() <= 0) {
            throw new BusinessException("Adjustment quantity must be positive");
        }
        if (direction == null) {
            throw new BusinessException("Adjustment direction required");
        }
        if (reason == null || reason.isBlank()) {
            throw new BusinessException("Adjustment reason required");
        }

        Ingredient ing = ingredientRepository.findById(ingredientId)
                .orElseThrow(() -> new ResourceNotFoundException("Ingredient not found: " + ingredientId));
        Unit unit = unitRepository.findById(unitId)
                .orElseThrow(() -> new ResourceNotFoundException("Unit not found: " + unitId));
        User actor = userRepository.findById(actorUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + actorUserId));

        Stock stock = lockOrCreate(ing, unit);

        BigDecimal newQty = direction == AdjustmentDirection.INCREASE
                ? stock.getQuantity().add(quantity)
                : stock.getQuantity().subtract(quantity);

        if (newQty.signum() < 0) {
            throw new BusinessException("Adjustment would result in negative stock");
        }
        stock.setQuantity(newQty);
        stockRepository.save(stock);

        StockMovement mv = new StockMovement();
        mv.setIngredient(ing);
        mv.setUnit(unit);
        mv.setType(MovementType.ADJUSTMENT);
        mv.setQuantity(quantity);
        mv.setReason(reason);
        mv.setCreatedBy(actor);
        return movementRepository.save(mv);
    }

    // Handles first-time upsert race: concurrent inserts for same (ingredient, unit).
    private Stock lockOrCreate(Ingredient ing, Unit unit) {
        return stockRepository.findForUpdate(ing.getId(), unit.getId())
                .orElseGet(() -> {
                    Stock s = new Stock(ing, unit, BigDecimal.ZERO);
                    try {
                        stockRepository.saveAndFlush(s);
                        // Re-read with lock so we return a locked entity.
                        entityManager.detach(s);
                        return stockRepository.findForUpdate(ing.getId(), unit.getId())
                                .orElseThrow();
                    } catch (DataIntegrityViolationException race) {
                        return stockRepository.findForUpdate(ing.getId(), unit.getId())
                                .orElseThrow();
                    }
                });
    }

    private Stock getOrThrow(UUID id) {
        return stockRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Stock not found: " + id));
    }
}
```

**Note:** references `MovementType`, `AdjustmentDirection`, `StockMovement`, `StockMovementRepository` — those are created in Task 10. Compilation will fail until Task 10 is done; finish Tasks 9/10/11 in sequence before running build.

Commit (after tasks 9-11 so it compiles): `git commit -m "feat(sp2): add StockService write methods with weighted-average cost"`

---

## Task 9: StockController

**Files:**
- `src/main/java/br/com/easy_inventory/management/stock/controller/StockController.java`
- Modify `src/main/java/br/com/easy_inventory/management/shared/security/SecurityConfig.java` — add permits

**StockController.java:**
```java
package br.com.easy_inventory.management.stock.controller;

import br.com.easy_inventory.management.shared.dto.ApiResponse;
import br.com.easy_inventory.management.shared.dto.PageResponse;
import br.com.easy_inventory.management.stock.dto.StockResponse;
import br.com.easy_inventory.management.stock.service.StockService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/stock")
public class StockController {

    private final StockService stockService;

    public StockController(StockService stockService) {
        this.stockService = stockService;
    }

    @GetMapping
    public ResponseEntity<PageResponse<StockResponse>> list(
            @RequestParam(required = false) UUID unit,
            @RequestParam(required = false) UUID ingredient,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<StockResponse> result = stockService.findAll(unit, ingredient, PageRequest.of(page, size));
        return ResponseEntity.ok(PageResponse.of(result.getContent(), page, size, result.getTotalElements()));
    }

    @GetMapping("/low")
    public ResponseEntity<PageResponse<StockResponse>> low(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<StockResponse> result = stockService.findBelowMinimum(PageRequest.of(page, size));
        return ResponseEntity.ok(PageResponse.of(result.getContent(), page, size, result.getTotalElements()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<StockResponse>> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.of(stockService.findById(id)));
    }
}
```

**SecurityConfig.java — add to the existing `securityFilterChain` bean, inside `authorizeHttpRequests`:**

Locate existing lines that add `requestMatchers(HttpMethod.GET, "/ingredients", "/ingredients/**").permitAll()` and add below them:

```java
                        .requestMatchers(HttpMethod.GET, "/stock", "/stock/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/stock-movements", "/stock-movements/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/purchase-orders", "/purchase-orders/**").permitAll()
```

Commit: `git commit -m "feat(sp2): add StockController and open GET permits"`

---

## Task 10: MovementType + AdjustmentDirection + StockMovement entity + repository

**Files:**
- `src/main/java/br/com/easy_inventory/management/movement/entity/MovementType.java`
- `src/main/java/br/com/easy_inventory/management/movement/entity/AdjustmentDirection.java`
- `src/main/java/br/com/easy_inventory/management/movement/entity/StockMovement.java`
- `src/main/java/br/com/easy_inventory/management/movement/repository/StockMovementRepository.java`

**MovementType.java:**
```java
package br.com.easy_inventory.management.movement.entity;

public enum MovementType { ENTRY, EXIT, ADJUSTMENT }
```

**AdjustmentDirection.java:**
```java
package br.com.easy_inventory.management.movement.entity;

public enum AdjustmentDirection { INCREASE, DECREASE }
```

**StockMovement.java:**
```java
package br.com.easy_inventory.management.movement.entity;

import br.com.easy_inventory.management.ingredient.entity.Ingredient;
import br.com.easy_inventory.management.unit.entity.Unit;
import br.com.easy_inventory.management.user.entity.User;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "stock_movements")
public class StockMovement {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ingredient_id", nullable = false)
    private Ingredient ingredient;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "unit_id", nullable = false)
    private Unit unit;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MovementType type;

    @Column(nullable = false, precision = 10, scale = 3)
    private BigDecimal quantity;

    @Column(name = "unit_price", precision = 10, scale = 4)
    private BigDecimal unitPrice;

    @Column(length = 255)
    private String reason;

    @Column(name = "purchase_order_id")
    private UUID purchaseOrderId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() { this.createdAt = LocalDateTime.now(); }

    public UUID getId() { return id; }
    public Ingredient getIngredient() { return ingredient; }
    public void setIngredient(Ingredient ingredient) { this.ingredient = ingredient; }
    public Unit getUnit() { return unit; }
    public void setUnit(Unit unit) { this.unit = unit; }
    public MovementType getType() { return type; }
    public void setType(MovementType type) { this.type = type; }
    public BigDecimal getQuantity() { return quantity; }
    public void setQuantity(BigDecimal quantity) { this.quantity = quantity; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public void setUnitPrice(BigDecimal unitPrice) { this.unitPrice = unitPrice; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public UUID getPurchaseOrderId() { return purchaseOrderId; }
    public void setPurchaseOrderId(UUID purchaseOrderId) { this.purchaseOrderId = purchaseOrderId; }
    public User getCreatedBy() { return createdBy; }
    public void setCreatedBy(User createdBy) { this.createdBy = createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
```

**StockMovementRepository.java:**
```java
package br.com.easy_inventory.management.movement.repository;

import br.com.easy_inventory.management.movement.entity.MovementType;
import br.com.easy_inventory.management.movement.entity.StockMovement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.UUID;

public interface StockMovementRepository extends JpaRepository<StockMovement, UUID> {

    @Query("select m from StockMovement m where " +
           "(:ingredientId is null or m.ingredient.id = :ingredientId) and " +
           "(:unitId is null or m.unit.id = :unitId) and " +
           "(:type is null or m.type = :type) and " +
           "(:from is null or m.createdAt >= :from) and " +
           "(:to is null or m.createdAt <= :to) " +
           "order by m.createdAt desc")
    Page<StockMovement> search(@Param("ingredientId") UUID ingredientId,
                               @Param("unitId") UUID unitId,
                               @Param("type") MovementType type,
                               @Param("from") LocalDateTime from,
                               @Param("to") LocalDateTime to,
                               Pageable pageable);
}
```

Commit: `git commit -m "feat(sp2): add StockMovement entity and repository"`

---

## Task 11: Movement DTOs + MovementService + MovementController

**Files:**
- `src/main/java/br/com/easy_inventory/management/movement/dto/MovementResponse.java`
- `src/main/java/br/com/easy_inventory/management/movement/dto/CreateAdjustmentRequest.java`
- `src/main/java/br/com/easy_inventory/management/movement/service/MovementService.java`
- `src/main/java/br/com/easy_inventory/management/movement/controller/MovementController.java`

**MovementResponse.java:**
```java
package br.com.easy_inventory.management.movement.dto;

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

**CreateAdjustmentRequest.java:**
```java
package br.com.easy_inventory.management.movement.dto;

import br.com.easy_inventory.management.movement.entity.AdjustmentDirection;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.UUID;

public record CreateAdjustmentRequest(
        @NotNull UUID ingredientId,
        @NotNull UUID unitId,
        @NotNull @DecimalMin("0.001") BigDecimal quantity,
        @NotNull AdjustmentDirection direction,
        @NotBlank @Size(max = 255) String reason
) {}
```

**MovementService.java:**
```java
package br.com.easy_inventory.management.movement.service;

import br.com.easy_inventory.management.movement.dto.CreateAdjustmentRequest;
import br.com.easy_inventory.management.movement.dto.MovementResponse;
import br.com.easy_inventory.management.movement.entity.MovementType;
import br.com.easy_inventory.management.movement.repository.StockMovementRepository;
import br.com.easy_inventory.management.shared.exception.ResourceNotFoundException;
import br.com.easy_inventory.management.stock.service.StockService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class MovementService {

    private final StockMovementRepository movementRepository;
    private final StockService stockService;

    public MovementService(StockMovementRepository movementRepository, StockService stockService) {
        this.movementRepository = movementRepository;
        this.stockService = stockService;
    }

    public Page<MovementResponse> findAll(UUID ingredientId, UUID unitId, MovementType type,
                                          LocalDateTime from, LocalDateTime to, Pageable pageable) {
        return movementRepository.search(ingredientId, unitId, type, from, to, pageable)
                .map(MovementResponse::from);
    }

    public MovementResponse findById(UUID id) {
        return MovementResponse.from(movementRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Movement not found: " + id)));
    }

    @Transactional
    public MovementResponse createAdjustment(CreateAdjustmentRequest req, UUID actorUserId) {
        var movement = stockService.applyAdjustment(
                req.ingredientId(), req.unitId(),
                req.quantity(), req.direction(), req.reason(), actorUserId);
        return MovementResponse.from(movement);
    }
}
```

**MovementController.java:**
```java
package br.com.easy_inventory.management.movement.controller;

import br.com.easy_inventory.management.movement.dto.CreateAdjustmentRequest;
import br.com.easy_inventory.management.movement.dto.MovementResponse;
import br.com.easy_inventory.management.movement.entity.MovementType;
import br.com.easy_inventory.management.movement.service.MovementService;
import br.com.easy_inventory.management.shared.dto.ApiResponse;
import br.com.easy_inventory.management.shared.dto.PageResponse;
import br.com.easy_inventory.management.shared.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.UUID;

@RestController
@RequestMapping("/stock-movements")
public class MovementController {

    private final MovementService movementService;

    public MovementController(MovementService movementService) {
        this.movementService = movementService;
    }

    @GetMapping
    public ResponseEntity<PageResponse<MovementResponse>> list(
            @RequestParam(required = false) UUID ingredient,
            @RequestParam(required = false) UUID unit,
            @RequestParam(required = false) MovementType type,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<MovementResponse> result = movementService.findAll(ingredient, unit, type, from, to,
                PageRequest.of(page, size));
        return ResponseEntity.ok(PageResponse.of(result.getContent(), page, size, result.getTotalElements()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<MovementResponse>> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.of(movementService.findById(id)));
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<MovementResponse>> createAdjustment(
            @Valid @RequestBody CreateAdjustmentRequest request) {
        var response = movementService.createAdjustment(request, AuthenticatedUser.currentId());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(response));
    }
}
```

Commit: `git commit -m "feat(sp2): add Movement module (DTOs, service, controller)"`

---

## Task 12: PurchaseOrderStatus + PurchaseOrder + PurchaseOrderItem entities

**Files:**
- `src/main/java/br/com/easy_inventory/management/purchase/entity/PurchaseOrderStatus.java`
- `src/main/java/br/com/easy_inventory/management/purchase/entity/PurchaseOrder.java`
- `src/main/java/br/com/easy_inventory/management/purchase/entity/PurchaseOrderItem.java`

**PurchaseOrderStatus.java:**
```java
package br.com.easy_inventory.management.purchase.entity;

public enum PurchaseOrderStatus { PENDING, RECEIVED, CANCELED }
```

**PurchaseOrderItem.java:**
```java
package br.com.easy_inventory.management.purchase.entity;

import br.com.easy_inventory.management.ingredient.entity.Ingredient;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "purchase_order_items",
       uniqueConstraints = @UniqueConstraint(name = "uq_po_item_ingredient",
                                             columnNames = {"purchase_order_id", "ingredient_id"}))
public class PurchaseOrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "purchase_order_id", nullable = false)
    private PurchaseOrder purchaseOrder;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ingredient_id", nullable = false)
    private Ingredient ingredient;

    @Column(nullable = false, precision = 10, scale = 3)
    private BigDecimal quantity;

    @Column(name = "unit_price", nullable = false, precision = 10, scale = 4)
    private BigDecimal unitPrice;

    public UUID getId() { return id; }
    public PurchaseOrder getPurchaseOrder() { return purchaseOrder; }
    public void setPurchaseOrder(PurchaseOrder po) { this.purchaseOrder = po; }
    public Ingredient getIngredient() { return ingredient; }
    public void setIngredient(Ingredient ingredient) { this.ingredient = ingredient; }
    public BigDecimal getQuantity() { return quantity; }
    public void setQuantity(BigDecimal quantity) { this.quantity = quantity; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public void setUnitPrice(BigDecimal unitPrice) { this.unitPrice = unitPrice; }
}
```

**PurchaseOrder.java:**
```java
package br.com.easy_inventory.management.purchase.entity;

import br.com.easy_inventory.management.supplier.entity.Supplier;
import br.com.easy_inventory.management.unit.entity.Unit;
import br.com.easy_inventory.management.user.entity.User;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "purchase_orders")
public class PurchaseOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "supplier_id", nullable = false)
    private Supplier supplier;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "unit_id", nullable = false)
    private Unit unit;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PurchaseOrderStatus status = PurchaseOrderStatus.PENDING;

    @Column(name = "total_cost", nullable = false, precision = 12, scale = 4)
    private BigDecimal totalCost = BigDecimal.ZERO;

    @Column(length = 500)
    private String notes;

    @Column(name = "expected_at")
    private LocalDate expectedAt;

    @Column(name = "received_at")
    private LocalDateTime receivedAt;

    @Column(name = "canceled_at")
    private LocalDateTime canceledAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "purchaseOrder",
               cascade = CascadeType.ALL, orphanRemoval = true,
               fetch = FetchType.LAZY)
    private List<PurchaseOrderItem> items = new ArrayList<>();

    @PrePersist
    void prePersist() { this.createdAt = LocalDateTime.now(); }

    public UUID getId() { return id; }
    public Supplier getSupplier() { return supplier; }
    public void setSupplier(Supplier supplier) { this.supplier = supplier; }
    public Unit getUnit() { return unit; }
    public void setUnit(Unit unit) { this.unit = unit; }
    public PurchaseOrderStatus getStatus() { return status; }
    public void setStatus(PurchaseOrderStatus status) { this.status = status; }
    public BigDecimal getTotalCost() { return totalCost; }
    public void setTotalCost(BigDecimal totalCost) { this.totalCost = totalCost; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public LocalDate getExpectedAt() { return expectedAt; }
    public void setExpectedAt(LocalDate expectedAt) { this.expectedAt = expectedAt; }
    public LocalDateTime getReceivedAt() { return receivedAt; }
    public void setReceivedAt(LocalDateTime receivedAt) { this.receivedAt = receivedAt; }
    public LocalDateTime getCanceledAt() { return canceledAt; }
    public void setCanceledAt(LocalDateTime canceledAt) { this.canceledAt = canceledAt; }
    public User getCreatedBy() { return createdBy; }
    public void setCreatedBy(User createdBy) { this.createdBy = createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public List<PurchaseOrderItem> getItems() { return items; }

    public void addItem(PurchaseOrderItem item) {
        items.add(item);
        item.setPurchaseOrder(this);
    }
    public void clearItems() { items.clear(); }
}
```

Commit: `git commit -m "feat(sp2): add PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus"`

---

## Task 13: PurchaseOrder repository + DTOs

**Files:**
- `src/main/java/br/com/easy_inventory/management/purchase/repository/PurchaseOrderRepository.java`
- `src/main/java/br/com/easy_inventory/management/purchase/dto/PurchaseOrderItemRequest.java`
- `src/main/java/br/com/easy_inventory/management/purchase/dto/PurchaseOrderItemResponse.java`
- `src/main/java/br/com/easy_inventory/management/purchase/dto/CreatePurchaseOrderRequest.java`
- `src/main/java/br/com/easy_inventory/management/purchase/dto/UpdatePurchaseOrderRequest.java`
- `src/main/java/br/com/easy_inventory/management/purchase/dto/PurchaseOrderResponse.java`

**PurchaseOrderRepository.java:**
```java
package br.com.easy_inventory.management.purchase.repository;

import br.com.easy_inventory.management.purchase.entity.PurchaseOrder;
import br.com.easy_inventory.management.purchase.entity.PurchaseOrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.UUID;

public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, UUID> {

    @Query("select p from PurchaseOrder p where " +
           "(:status is null or p.status = :status) and " +
           "(:supplierId is null or p.supplier.id = :supplierId) and " +
           "(:unitId is null or p.unit.id = :unitId) and " +
           "(:from is null or p.expectedAt >= :from) and " +
           "(:to is null or p.expectedAt <= :to) " +
           "order by p.createdAt desc")
    Page<PurchaseOrder> search(@Param("status") PurchaseOrderStatus status,
                               @Param("supplierId") UUID supplierId,
                               @Param("unitId") UUID unitId,
                               @Param("from") LocalDate from,
                               @Param("to") LocalDate to,
                               Pageable pageable);
}
```

**PurchaseOrderItemRequest.java:**
```java
package br.com.easy_inventory.management.purchase.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.UUID;

public record PurchaseOrderItemRequest(
        @NotNull UUID ingredientId,
        @NotNull @DecimalMin("0.001") BigDecimal quantity,
        @NotNull @DecimalMin("0.0000") BigDecimal unitPrice
) {}
```

**PurchaseOrderItemResponse.java:**

```java
package br.com.easy_inventory.management.purchase.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record PurchaseOrderItemResponse(
        UUID id,
        UUID ingredientId, String ingredientName,
        BigDecimal quantity,
        BigDecimal unitPrice,
        BigDecimal subtotal
) {
   public static PurchaseOrderItemResponse from(PurchaseOrderItem i) {
      return new PurchaseOrderItemResponse(
              i.getId(),
              i.getIngredient().getId(), i.getIngredient().getName(),
              i.getQuantity(),
              i.getUnitPrice(),
              i.getQuantity().multiply(i.getUnitPrice())
      );
   }
}
```

**CreatePurchaseOrderRequest.java:**
```java
package br.com.easy_inventory.management.purchase.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record CreatePurchaseOrderRequest(
        @NotNull UUID supplierId,
        @NotNull UUID unitId,
        @Size(max = 500) String notes,
        LocalDate expectedAt,
        @NotEmpty @Valid List<PurchaseOrderItemRequest> items
) {}
```

**UpdatePurchaseOrderRequest.java:**
```java
package br.com.easy_inventory.management.purchase.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record UpdatePurchaseOrderRequest(
        @NotNull UUID supplierId,
        @NotNull UUID unitId,
        @Size(max = 500) String notes,
        LocalDate expectedAt,
        @NotEmpty @Valid List<PurchaseOrderItemRequest> items
) {}
```

**PurchaseOrderResponse.java:**
```java
package br.com.easy_inventory.management.purchase.dto;

import br.com.easy_inventory.management.purchase.entity.PurchaseOrder;
import br.com.easy_inventory.management.purchase.entity.PurchaseOrderStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record PurchaseOrderResponse(
        UUID id,
        UUID supplierId, String supplierName,
        UUID unitId, String unitName,
        PurchaseOrderStatus status,
        BigDecimal totalCost,
        String notes,
        LocalDate expectedAt,
        LocalDateTime receivedAt,
        LocalDateTime canceledAt,
        UUID createdById,
        LocalDateTime createdAt,
        List<PurchaseOrderItemResponse> items
) {
    public static PurchaseOrderResponse from(PurchaseOrder po) {
        return new PurchaseOrderResponse(
                po.getId(),
                po.getSupplier().getId(), po.getSupplier().getName(),
                po.getUnit().getId(), po.getUnit().getName(),
                po.getStatus(),
                po.getTotalCost(),
                po.getNotes(),
                po.getExpectedAt(),
                po.getReceivedAt(),
                po.getCanceledAt(),
                po.getCreatedBy().getId(),
                po.getCreatedAt(),
                po.getItems().stream().map(PurchaseOrderItemResponse::from).toList()
        );
    }
}
```

Commit: `git commit -m "feat(sp2): add PurchaseOrder repository and DTOs"`

---

## Task 14: PurchaseOrderService — read + create + update

**Files:** Create `src/main/java/br/com/easy_inventory/management/purchase/service/PurchaseOrderService.java`

```java
package br.com.easy_inventory.management.purchase.service;

import br.com.easy_inventory.management.ingredient.entity.Ingredient;
import br.com.easy_inventory.management.ingredient.repository.IngredientRepository;
import br.com.easy_inventory.management.purchase.dto.*;
import br.com.easy_inventory.management.purchase.entity.PurchaseOrder;
import br.com.easy_inventory.management.purchase.entity.PurchaseOrderStatus;
import br.com.easy_inventory.management.purchase.repository.PurchaseOrderRepository;
import br.com.easy_inventory.management.shared.exception.BusinessException;
import br.com.easy_inventory.management.shared.exception.ResourceNotFoundException;
import br.com.easy_inventory.management.supplier.entity.Supplier;
import br.com.easy_inventory.management.supplier.repository.SupplierRepository;
import br.com.easy_inventory.management.unit.entity.Unit;
import br.com.easy_inventory.management.unit.repository.UnitRepository;
import br.com.easy_inventory.management.user.entity.User;
import br.com.easy_inventory.management.user.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Service
public class PurchaseOrderService {

   private final PurchaseOrderRepository poRepository;
   private final SupplierRepository supplierRepository;
   private final UnitRepository unitRepository;
   private final IngredientRepository ingredientRepository;
   private final UserRepository userRepository;

   public PurchaseOrderService(PurchaseOrderRepository poRepository,
                               SupplierRepository supplierRepository,
                               UnitRepository unitRepository,
                               IngredientRepository ingredientRepository,
                               UserRepository userRepository) {
      this.poRepository = poRepository;
      this.supplierRepository = supplierRepository;
      this.unitRepository = unitRepository;
      this.ingredientRepository = ingredientRepository;
      this.userRepository = userRepository;
   }

   public Page<PurchaseOrderResponse> findAll(PurchaseOrderStatus status, UUID supplierId, UUID unitId,
                                              LocalDate from, LocalDate to, Pageable pageable) {
      return poRepository.search(status, supplierId, unitId, from, to, pageable)
              .map(PurchaseOrderResponse::from);
   }

   public PurchaseOrderResponse findById(UUID id) {
      return PurchaseOrderResponse.from(getOrThrow(id));
   }

   @Transactional
   public PurchaseOrderResponse create(CreatePurchaseOrderRequest req, UUID actorUserId) {
      Supplier supplier = supplierRepository.findById(req.supplierId())
              .orElseThrow(() -> new ResourceNotFoundException("Supplier not found: " + req.supplierId()));
      if (!supplier.isActive()) {
         throw new BusinessException("Supplier is inactive");
      }
      Unit unit = unitRepository.findById(req.unitId())
              .orElseThrow(() -> new ResourceNotFoundException("Unit not found: " + req.unitId()));
      User actor = userRepository.findById(actorUserId)
              .orElseThrow(() -> new ResourceNotFoundException("User not found: " + actorUserId));

      PurchaseOrder po = new PurchaseOrder();
      po.setSupplier(supplier);
      po.setUnit(unit);
      po.setNotes(req.notes());
      po.setExpectedAt(req.expectedAt());
      po.setCreatedBy(actor);

      attachItems(po, req.items());

      return PurchaseOrderResponse.from(poRepository.save(po));
   }

   @Transactional
   public PurchaseOrderResponse update(UUID id, UpdatePurchaseOrderRequest req) {
      PurchaseOrder po = getOrThrow(id);
      if (po.getStatus() != PurchaseOrderStatus.PENDING) {
         throw new BusinessException("Only pending purchase orders can be edited");
      }
      Supplier supplier = supplierRepository.findById(req.supplierId())
              .orElseThrow(() -> new ResourceNotFoundException("Supplier not found: " + req.supplierId()));
      if (!supplier.isActive()) {
         throw new BusinessException("Supplier is inactive");
      }
      Unit unit = unitRepository.findById(req.unitId())
              .orElseThrow(() -> new ResourceNotFoundException("Unit not found: " + req.unitId()));

      po.setSupplier(supplier);
      po.setUnit(unit);
      po.setNotes(req.notes());
      po.setExpectedAt(req.expectedAt());
      po.clearItems();
      attachItems(po, req.items());

      return PurchaseOrderResponse.from(poRepository.save(po));
   }

   private void attachItems(PurchaseOrder po, java.util.List<PurchaseOrderItemRequest> items) {
      Set<UUID> seen = new HashSet<>();
      BigDecimal total = BigDecimal.ZERO;
      for (PurchaseOrderItemRequest it : items) {
         if (!seen.add(it.ingredientId())) {
            throw new BusinessException("Duplicate ingredient in purchase order: " + it.ingredientId());
         }
         Ingredient ing = ingredientRepository.findById(it.ingredientId())
                 .orElseThrow(() -> new ResourceNotFoundException("Ingredient not found: " + it.ingredientId()));
         if (!ing.isActive()) {
            throw new BusinessException("Ingredient is inactive: " + ing.getName());
         }
         PurchaseOrderItem poi = new PurchaseOrderItem();
         poi.setIngredient(ing);
         poi.setQuantity(it.quantity());
         poi.setUnitPrice(it.unitPrice());
         po.addItem(poi);
         total = total.add(it.quantity().multiply(it.unitPrice()));
      }
      po.setTotalCost(total);
   }

   PurchaseOrder getOrThrow(UUID id) {
      return poRepository.findById(id)
              .orElseThrow(() -> new ResourceNotFoundException("Purchase order not found: " + id));
   }
}
```

Commit: `git commit -m "feat(sp2): add PurchaseOrderService with create and update"`

---

## Task 15: PurchaseOrderService — receive + cancel

**Files:** Modify `src/main/java/br/com/easy_inventory/management/purchase/service/PurchaseOrderService.java` — add methods and dependency on `StockService`.

Add these imports:
```java
import br.com.easy_inventory.management.stock.service.StockService;
```

Add `StockService` to the constructor (update all call sites — but this is a new service, so only add):

```java
    private final StockService stockService;

    public PurchaseOrderService(PurchaseOrderRepository poRepository,
                                SupplierRepository supplierRepository,
                                UnitRepository unitRepository,
                                IngredientRepository ingredientRepository,
                                UserRepository userRepository,
                                StockService stockService) {
        this.poRepository = poRepository;
        this.supplierRepository = supplierRepository;
        this.unitRepository = unitRepository;
        this.ingredientRepository = ingredientRepository;
        this.userRepository = userRepository;
        this.stockService = stockService;
    }
```

Add these methods to the class:

```java
    @Transactional
    public PurchaseOrderResponse receive(UUID id, UUID actorUserId) {
        PurchaseOrder po = getOrThrow(id);
        if (po.getStatus() != PurchaseOrderStatus.PENDING) {
            throw new BusinessException("Purchase order is not pending");
        }
        for (PurchaseOrderItem item : po.getItems()) {
            stockService.applyEntry(
                    item.getIngredient().getId(),
                    po.getUnit().getId(),
                    item.getQuantity(),
                    item.getUnitPrice(),
                    po.getId(),
                    actorUserId
            );
        }
        po.setStatus(PurchaseOrderStatus.RECEIVED);
        po.setReceivedAt(java.time.LocalDateTime.now());
        return PurchaseOrderResponse.from(poRepository.save(po));
    }

    @Transactional
    public PurchaseOrderResponse cancel(UUID id) {
        PurchaseOrder po = getOrThrow(id);
        if (po.getStatus() != PurchaseOrderStatus.PENDING) {
            throw new BusinessException("Purchase order is not pending");
        }
        po.setStatus(PurchaseOrderStatus.CANCELED);
        po.setCanceledAt(java.time.LocalDateTime.now());
        return PurchaseOrderResponse.from(poRepository.save(po));
    }
```

Commit: `git commit -m "feat(sp2): add PurchaseOrder receive and cancel workflows"`

---

## Task 16: PurchaseOrderController

**Files:** Create `src/main/java/br/com/easy_inventory/management/purchase/controller/PurchaseOrderController.java`

```java
package br.com.easy_inventory.management.purchase.controller;

import br.com.easy_inventory.management.purchase.dto.CreatePurchaseOrderRequest;
import br.com.easy_inventory.management.purchase.dto.PurchaseOrderResponse;
import br.com.easy_inventory.management.purchase.dto.UpdatePurchaseOrderRequest;
import br.com.easy_inventory.management.purchase.entity.PurchaseOrderStatus;
import br.com.easy_inventory.management.purchase.service.PurchaseOrderService;
import br.com.easy_inventory.management.shared.dto.ApiResponse;
import br.com.easy_inventory.management.shared.dto.PageResponse;
import br.com.easy_inventory.management.shared.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/purchase-orders")
public class PurchaseOrderController {

    private final PurchaseOrderService service;

    public PurchaseOrderController(PurchaseOrderService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<PageResponse<PurchaseOrderResponse>> list(
            @RequestParam(required = false) PurchaseOrderStatus status,
            @RequestParam(required = false) UUID supplier,
            @RequestParam(required = false) UUID unit,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<PurchaseOrderResponse> result = service.findAll(status, supplier, unit, from, to,
                PageRequest.of(page, size));
        return ResponseEntity.ok(PageResponse.of(result.getContent(), page, size, result.getTotalElements()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<PurchaseOrderResponse>> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.of(service.findById(id)));
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<PurchaseOrderResponse>> create(
            @Valid @RequestBody CreatePurchaseOrderRequest request) {
        var response = service.create(request, AuthenticatedUser.currentId());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(response));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<PurchaseOrderResponse>> update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdatePurchaseOrderRequest request) {
        return ResponseEntity.ok(ApiResponse.of(service.update(id, request)));
    }

    @PostMapping("/{id}/receive")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<PurchaseOrderResponse>> receive(@PathVariable UUID id) {
        var response = service.receive(id, AuthenticatedUser.currentId());
        return ResponseEntity.ok(ApiResponse.of(response));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<PurchaseOrderResponse>> cancel(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.of(service.cancel(id)));
    }
}
```

Commit: `git commit -m "feat(sp2): add PurchaseOrderController with all 6 endpoints"`

---

## Task 17: Smoke verification (manual)

**Steps:**

1. `docker-compose up -d` — ensure Postgres running
2. `mvnw.cmd clean package -DskipTests` — confirm everything compiles
3. `mvnw.cmd spring-boot:run` — app starts cleanly, Flyway applies V9-V12
4. Open Swagger at `http://localhost:8080/swagger-ui.html` and verify all new endpoints appear:
   - `/stock`, `/stock/{id}`, `/stock/low`
   - `/stock-movements` (GET/POST), `/stock-movements/{id}`
   - `/purchase-orders` (GET/POST/PUT), `/purchase-orders/{id}`, `/purchase-orders/{id}/receive`, `/purchase-orders/{id}/cancel`
5. Login via `/auth/login` → click "Authorize" → paste access token
6. Quick end-to-end check:
   - `GET /stock` → empty list (paginated)
   - `POST /purchase-orders` with 2 items → 201, returns PO with total_cost computed
   - `POST /purchase-orders/{id}/receive` → 200, PO now RECEIVED
   - `GET /stock?unit={id}` → shows 2 stock rows with the received quantities
   - `GET /ingredients/{id}` → averageCost updated from the weighted-average formula
   - `GET /stock-movements` → shows 2 ENTRY movements with purchase_order_id populated
7. Stop app, no commit needed for smoke testing.

---

## Handoff to Testing

After Task 17 passes, hand off to Claude for integration tests. Expected test files:

- `src/test/java/.../stock/StockControllerTest.java` — list/byId/low-stock
- `src/test/java/.../movement/MovementControllerTest.java` — list/filter/create adjustment (INCREASE and DECREASE), reject when reason empty
- `src/test/java/.../purchase/PurchaseOrderControllerTest.java` — full CRUD + receive (verifies stock + average_cost update) + cancel + state-machine violations
- `src/test/java/.../stock/StockServiceConcurrencyTest.java` — spawn two threads both calling `applyEntry` on the same (ingredient, unit); verify final `stock.quantity` equals the sum and `ingredient.average_cost` matches the properly weighted formula.

**Do not create these files yourself.** The user's workflow is to hand them off so Claude writes them.
