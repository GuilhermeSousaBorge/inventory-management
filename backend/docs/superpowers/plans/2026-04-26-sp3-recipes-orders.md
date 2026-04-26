# SP3 Recipes & Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement SP3 — product catalog with recipe sheets (fichas técnicas), customer orders with state machine workflow, and automatic stock deduction when the kitchen starts preparation.

**Architecture:** Two new domain packages (`product/`, `order/`) extending SP1+SP2. Each product is a flavor+size combination with its own recipe sheet. `OrderService.start()` orchestrates automatic stock deduction by aggregating ingredient quantities from recipe sheets and calling `StockService.applyExit()` per ingredient — reusing SP2's pessimistic-lock invariant.

**Tech Stack:** Java 21, Spring Boot 4.0.5, Spring Security 6, JJWT 0.12.6, Spring Data JPA, PostgreSQL 16, Flyway, SpringDoc 3.0.3.

**Note on tests:** this project is a learning exercise. The user implements the code; Claude writes integration tests afterward. This plan does **not** include test tasks. Once tasks 1-16 are done, hand off for testing.

---

## File Map

```
src/main/resources/db/migration/
  V13__create_products.sql                  (new)
  V14__create_product_ingredients.sql       (new)
  V15__create_orders.sql                    (new)
  V16__create_order_items.sql               (new)

src/main/java/br/com/easy_inventory/management/
  shared/security/SecurityConfig.java       (modify: add permits for GETs)

  product/
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

  order/
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

---

## Task 1: V13 — products table

**Files:** Create `src/main/resources/db/migration/V13__create_products.sql`

```sql
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    size VARCHAR(20) NOT NULL CHECK (size IN ('P', 'M', 'G', 'GG')),
    category_id UUID REFERENCES categories(id),
    price DECIMAL(10,2) NOT NULL,
    description VARCHAR(255),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_product_name_size UNIQUE (name, size)
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(active);
```

Commit: `git commit -m "feat(sp3): add V13 products migration"`

---

## Task 2: V14 — product_ingredients table

**Files:** Create `src/main/resources/db/migration/V14__create_product_ingredients.sql`

```sql
CREATE TABLE product_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    quantity DECIMAL(10,3) NOT NULL CHECK (quantity > 0),
    CONSTRAINT uq_product_ingredient UNIQUE (product_id, ingredient_id)
);

CREATE INDEX idx_product_ingredients_product ON product_ingredients(product_id);
```

Commit: `git commit -m "feat(sp3): add V14 product_ingredients migration"`

---

## Task 3: V15 — orders table

**Files:** Create `src/main/resources/db/migration/V15__create_orders.sql`

```sql
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES units(id),
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELED')),
    total_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    notes VARCHAR(500),
    created_by UUID NOT NULL REFERENCES users(id),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    canceled_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_unit ON orders(unit_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
```

Commit: `git commit -m "feat(sp3): add V15 orders migration"`

---

## Task 4: V16 — order_items table

**Files:** Create `src/main/resources/db/migration/V16__create_order_items.sql`

```sql
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL,
    CONSTRAINT uq_order_item_product UNIQUE (order_id, product_id)
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
```

Commit: `git commit -m "feat(sp3): add V16 order_items migration"`

---

## Task 5: ProductSize enum + Product entity + ProductIngredient entity

**Files:**
- Create `src/main/java/br/com/easy_inventory/management/product/entity/ProductSize.java`
- Create `src/main/java/br/com/easy_inventory/management/product/entity/Product.java`
- Create `src/main/java/br/com/easy_inventory/management/product/entity/ProductIngredient.java`

**ProductSize.java:**
```java
package br.com.easy_inventory.management.product.entity;

public enum ProductSize { P, M, G, GG }
```

**Product.java:**
```java
package br.com.easy_inventory.management.product.entity;

import br.com.easy_inventory.management.category.entity.Category;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "products",
       uniqueConstraints = @UniqueConstraint(name = "uq_product_name_size",
                                             columnNames = {"name", "size"}))
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 150)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ProductSize size;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Column(length = 255)
    private String description;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "product",
               cascade = CascadeType.ALL, orphanRemoval = true,
               fetch = FetchType.LAZY)
    private List<ProductIngredient> ingredients = new ArrayList<>();

    @PrePersist
    void prePersist() { this.createdAt = LocalDateTime.now(); }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public ProductSize getSize() { return size; }
    public void setSize(ProductSize size) { this.size = size; }
    public Category getCategory() { return category; }
    public void setCategory(Category category) { this.category = category; }
    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public List<ProductIngredient> getIngredients() { return ingredients; }

    public void addIngredient(ProductIngredient pi) {
        ingredients.add(pi);
        pi.setProduct(this);
    }
    public void clearIngredients() { ingredients.clear(); }
}
```

**ProductIngredient.java:**
```java
package br.com.easy_inventory.management.product.entity;

import br.com.easy_inventory.management.ingredient.entity.Ingredient;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "product_ingredients",
       uniqueConstraints = @UniqueConstraint(name = "uq_product_ingredient",
                                             columnNames = {"product_id", "ingredient_id"}))
public class ProductIngredient {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ingredient_id", nullable = false)
    private Ingredient ingredient;

    @Column(nullable = false, precision = 10, scale = 3)
    private BigDecimal quantity;

    public UUID getId() { return id; }
    public Product getProduct() { return product; }
    public void setProduct(Product product) { this.product = product; }
    public Ingredient getIngredient() { return ingredient; }
    public void setIngredient(Ingredient ingredient) { this.ingredient = ingredient; }
    public BigDecimal getQuantity() { return quantity; }
    public void setQuantity(BigDecimal quantity) { this.quantity = quantity; }
}
```

Commit: `git commit -m "feat(sp3): add Product, ProductIngredient, ProductSize entities"`

---

## Task 6: ProductRepository

**Files:** Create `src/main/java/br/com/easy_inventory/management/product/repository/ProductRepository.java`

```java
package br.com.easy_inventory.management.product.repository;

import br.com.easy_inventory.management.product.entity.Product;
import br.com.easy_inventory.management.product.entity.ProductSize;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface ProductRepository extends JpaRepository<Product, UUID> {

    @Query("select p from Product p where " +
           "(:categoryId is null or p.category.id = :categoryId) and " +
           "(:size is null or p.size = :size) and " +
           "(:active is null or p.active = :active) " +
           "order by p.name, p.size")
    Page<Product> search(@Param("categoryId") UUID categoryId,
                         @Param("size") ProductSize size,
                         @Param("active") Boolean active,
                         Pageable pageable);
}
```

Commit: `git commit -m "feat(sp3): add ProductRepository with search query"`

---

## Task 7: Product DTOs

**Files:**
- Create `src/main/java/br/com/easy_inventory/management/product/dto/ProductIngredientRequest.java`
- Create `src/main/java/br/com/easy_inventory/management/product/dto/ProductIngredientResponse.java`
- Create `src/main/java/br/com/easy_inventory/management/product/dto/CreateProductRequest.java`
- Create `src/main/java/br/com/easy_inventory/management/product/dto/UpdateProductRequest.java`
- Create `src/main/java/br/com/easy_inventory/management/product/dto/ProductResponse.java`

**ProductIngredientRequest.java:**
```java
package br.com.easy_inventory.management.product.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.UUID;

public record ProductIngredientRequest(
        @NotNull UUID ingredientId,
        @NotNull @DecimalMin("0.001") BigDecimal quantity
) {}
```

**ProductIngredientResponse.java:**
```java
package br.com.easy_inventory.management.product.dto;

import br.com.easy_inventory.management.ingredient.entity.UnitOfMeasure;
import br.com.easy_inventory.management.product.entity.ProductIngredient;

import java.math.BigDecimal;
import java.util.UUID;

public record ProductIngredientResponse(
        UUID id,
        UUID ingredientId,
        String ingredientName,
        BigDecimal quantity,
        UnitOfMeasure unitOfMeasure
) {
    public static ProductIngredientResponse from(ProductIngredient pi) {
        var ing = pi.getIngredient();
        return new ProductIngredientResponse(
                pi.getId(),
                ing.getId(),
                ing.getName(),
                pi.getQuantity(),
                ing.getUnitOfMeasure()
        );
    }
}
```

**CreateProductRequest.java:**
```java
package br.com.easy_inventory.management.product.dto;

import br.com.easy_inventory.management.product.entity.ProductSize;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record CreateProductRequest(
        @NotBlank @Size(max = 150) String name,
        @NotNull ProductSize size,
        UUID categoryId,
        @NotNull @DecimalMin("0.01") BigDecimal price,
        @Size(max = 255) String description,
        @NotEmpty @Valid List<ProductIngredientRequest> ingredients
) {}
```

**UpdateProductRequest.java:**
```java
package br.com.easy_inventory.management.product.dto;

import br.com.easy_inventory.management.product.entity.ProductSize;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record UpdateProductRequest(
        @NotBlank @Size(max = 150) String name,
        @NotNull ProductSize size,
        UUID categoryId,
        @NotNull @DecimalMin("0.01") BigDecimal price,
        @Size(max = 255) String description,
        @NotEmpty @Valid List<ProductIngredientRequest> ingredients
) {}
```

**ProductResponse.java:**
```java
package br.com.easy_inventory.management.product.dto;

import br.com.easy_inventory.management.product.entity.Product;
import br.com.easy_inventory.management.product.entity.ProductSize;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record ProductResponse(
        UUID id,
        String name,
        ProductSize size,
        UUID categoryId,
        String categoryName,
        BigDecimal price,
        String description,
        boolean active,
        LocalDateTime createdAt,
        List<ProductIngredientResponse> ingredients
) {
    public static ProductResponse from(Product p) {
        var cat = p.getCategory();
        return new ProductResponse(
                p.getId(),
                p.getName(),
                p.getSize(),
                cat != null ? cat.getId() : null,
                cat != null ? cat.getName() : null,
                p.getPrice(),
                p.getDescription(),
                p.isActive(),
                p.getCreatedAt(),
                p.getIngredients().stream().map(ProductIngredientResponse::from).toList()
        );
    }
}
```

Commit: `git commit -m "feat(sp3): add Product DTOs (request and response records)"`

---

## Task 8: ProductService

**Files:** Create `src/main/java/br/com/easy_inventory/management/product/service/ProductService.java`

```java
package br.com.easy_inventory.management.product.service;

import br.com.easy_inventory.management.category.entity.Category;
import br.com.easy_inventory.management.category.repository.CategoryRepository;
import br.com.easy_inventory.management.ingredient.entity.Ingredient;
import br.com.easy_inventory.management.ingredient.repository.IngredientRepository;
import br.com.easy_inventory.management.product.dto.*;
import br.com.easy_inventory.management.product.entity.Product;
import br.com.easy_inventory.management.product.entity.ProductIngredient;
import br.com.easy_inventory.management.product.entity.ProductSize;
import br.com.easy_inventory.management.product.repository.ProductRepository;
import br.com.easy_inventory.management.shared.exception.BusinessException;
import br.com.easy_inventory.management.shared.exception.ResourceNotFoundException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class ProductService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final IngredientRepository ingredientRepository;

    public ProductService(ProductRepository productRepository,
                          CategoryRepository categoryRepository,
                          IngredientRepository ingredientRepository) {
        this.productRepository = productRepository;
        this.categoryRepository = categoryRepository;
        this.ingredientRepository = ingredientRepository;
    }

    public Page<ProductResponse> findAll(UUID categoryId, ProductSize size, Boolean active, Pageable pageable) {
        return productRepository.search(categoryId, size, active, pageable)
                .map(ProductResponse::from);
    }

    public ProductResponse findById(UUID id) {
        return ProductResponse.from(getOrThrow(id));
    }

    @Transactional
    public ProductResponse create(CreateProductRequest req) {
        Product product = new Product();
        product.setName(req.name());
        product.setSize(req.size());
        product.setPrice(req.price());
        product.setDescription(req.description());

        if (req.categoryId() != null) {
            Category cat = categoryRepository.findById(req.categoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("Category not found: " + req.categoryId()));
            product.setCategory(cat);
        }

        attachIngredients(product, req.ingredients());

        try {
            return ProductResponse.from(productRepository.save(product));
        } catch (DataIntegrityViolationException e) {
            throw new BusinessException("Product '" + req.name() + "' size " + req.size() + " already exists");
        }
    }

    @Transactional
    public ProductResponse update(UUID id, UpdateProductRequest req) {
        Product product = getOrThrow(id);
        product.setName(req.name());
        product.setSize(req.size());
        product.setPrice(req.price());
        product.setDescription(req.description());

        if (req.categoryId() != null) {
            Category cat = categoryRepository.findById(req.categoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("Category not found: " + req.categoryId()));
            product.setCategory(cat);
        } else {
            product.setCategory(null);
        }

        product.clearIngredients();
        attachIngredients(product, req.ingredients());

        try {
            return ProductResponse.from(productRepository.save(product));
        } catch (DataIntegrityViolationException e) {
            throw new BusinessException("Product '" + req.name() + "' size " + req.size() + " already exists");
        }
    }

    @Transactional
    public void deactivate(UUID id) {
        Product product = getOrThrow(id);
        product.setActive(false);
        productRepository.save(product);
    }

    private void attachIngredients(Product product, List<ProductIngredientRequest> ingredients) {
        Set<UUID> seen = new HashSet<>();
        for (ProductIngredientRequest it : ingredients) {
            if (!seen.add(it.ingredientId())) {
                throw new BusinessException("Duplicate ingredient in recipe: " + it.ingredientId());
            }
            Ingredient ing = ingredientRepository.findById(it.ingredientId())
                    .orElseThrow(() -> new ResourceNotFoundException("Ingredient not found: " + it.ingredientId()));
            if (!ing.isActive()) {
                throw new BusinessException("Ingredient is inactive: " + ing.getName());
            }
            ProductIngredient pi = new ProductIngredient();
            pi.setIngredient(ing);
            pi.setQuantity(it.quantity());
            product.addIngredient(pi);
        }
    }

    Product getOrThrow(UUID id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + id));
    }
}
```

Commit: `git commit -m "feat(sp3): add ProductService with CRUD and recipe management"`

---

## Task 9: ProductController + SecurityConfig update

**Files:**
- Create `src/main/java/br/com/easy_inventory/management/product/controller/ProductController.java`
- Modify `src/main/java/br/com/easy_inventory/management/shared/security/SecurityConfig.java`

**ProductController.java:**
```java
package br.com.easy_inventory.management.product.controller;

import br.com.easy_inventory.management.product.dto.CreateProductRequest;
import br.com.easy_inventory.management.product.dto.ProductResponse;
import br.com.easy_inventory.management.product.dto.UpdateProductRequest;
import br.com.easy_inventory.management.product.entity.ProductSize;
import br.com.easy_inventory.management.product.service.ProductService;
import br.com.easy_inventory.management.shared.dto.ApiResponse;
import br.com.easy_inventory.management.shared.dto.PageResponse;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/products")
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @GetMapping
    public ResponseEntity<PageResponse<ProductResponse>> list(
            @RequestParam(required = false) UUID category,
            @RequestParam(required = false) ProductSize size,
            @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        Page<ProductResponse> result = productService.findAll(category, size, active,
                PageRequest.of(page, pageSize));
        return ResponseEntity.ok(PageResponse.of(result.getContent(), page, pageSize, result.getTotalElements()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ProductResponse>> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.of(productService.findById(id)));
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<ProductResponse>> create(
            @Valid @RequestBody CreateProductRequest request) {
        var response = productService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(response));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<ProductResponse>> update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateProductRequest request) {
        return ResponseEntity.ok(ApiResponse.of(productService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<Void> deactivate(@PathVariable UUID id) {
        productService.deactivate(id);
        return ResponseEntity.noContent().build();
    }
}
```

**SecurityConfig.java — add to the existing `securityFilterChain` bean, inside `authorizeHttpRequests`:**

Locate the existing line:
```java
.requestMatchers(HttpMethod.GET, "/purchase-orders", "/purchase-orders/**").permitAll()
```

Add below it:
```java
.requestMatchers(HttpMethod.GET, "/products", "/products/**").permitAll()
```

Commit: `git commit -m "feat(sp3): add ProductController and open GET permits"`

---

## Task 10: OrderStatus enum + Order entity + OrderItem entity

**Files:**
- Create `src/main/java/br/com/easy_inventory/management/order/entity/OrderStatus.java`
- Create `src/main/java/br/com/easy_inventory/management/order/entity/Order.java`
- Create `src/main/java/br/com/easy_inventory/management/order/entity/OrderItem.java`

**OrderStatus.java:**
```java
package br.com.easy_inventory.management.order.entity;

public enum OrderStatus { PENDING, IN_PROGRESS, COMPLETED, CANCELED }
```

**Order.java:**
```java
package br.com.easy_inventory.management.order.entity;

import br.com.easy_inventory.management.unit.entity.Unit;
import br.com.easy_inventory.management.user.entity.User;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "orders")
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "unit_id", nullable = false)
    private Unit unit;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OrderStatus status = OrderStatus.PENDING;

    @Column(name = "total_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalPrice = BigDecimal.ZERO;

    @Column(length = 500)
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "canceled_at")
    private LocalDateTime canceledAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "order",
               cascade = CascadeType.ALL, orphanRemoval = true,
               fetch = FetchType.LAZY)
    private List<OrderItem> items = new ArrayList<>();

    @PrePersist
    void prePersist() { this.createdAt = LocalDateTime.now(); }

    public UUID getId() { return id; }
    public Unit getUnit() { return unit; }
    public void setUnit(Unit unit) { this.unit = unit; }
    public OrderStatus getStatus() { return status; }
    public void setStatus(OrderStatus status) { this.status = status; }
    public BigDecimal getTotalPrice() { return totalPrice; }
    public void setTotalPrice(BigDecimal totalPrice) { this.totalPrice = totalPrice; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public User getCreatedBy() { return createdBy; }
    public void setCreatedBy(User createdBy) { this.createdBy = createdBy; }
    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
    public LocalDateTime getCanceledAt() { return canceledAt; }
    public void setCanceledAt(LocalDateTime canceledAt) { this.canceledAt = canceledAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public List<OrderItem> getItems() { return items; }

    public void addItem(OrderItem item) {
        items.add(item);
        item.setOrder(this);
    }
    public void clearItems() { items.clear(); }
}
```

**OrderItem.java:**
```java
package br.com.easy_inventory.management.order.entity;

import br.com.easy_inventory.management.product.entity.Product;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "order_items",
       uniqueConstraints = @UniqueConstraint(name = "uq_order_item_product",
                                             columnNames = {"order_id", "product_id"}))
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false)
    private int quantity;

    @Column(name = "unit_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal unitPrice;

    public UUID getId() { return id; }
    public Order getOrder() { return order; }
    public void setOrder(Order order) { this.order = order; }
    public Product getProduct() { return product; }
    public void setProduct(Product product) { this.product = product; }
    public int getQuantity() { return quantity; }
    public void setQuantity(int quantity) { this.quantity = quantity; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public void setUnitPrice(BigDecimal unitPrice) { this.unitPrice = unitPrice; }
}
```

Commit: `git commit -m "feat(sp3): add Order, OrderItem, OrderStatus entities"`

---

## Task 11: OrderRepository

**Files:** Create `src/main/java/br/com/easy_inventory/management/order/repository/OrderRepository.java`

```java
package br.com.easy_inventory.management.order.repository;

import br.com.easy_inventory.management.order.entity.Order;
import br.com.easy_inventory.management.order.entity.OrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID> {

    @Query("select o from Order o where " +
           "(:unitId is null or o.unit.id = :unitId) and " +
           "(:status is null or o.status = :status) and " +
           "(:from is null or o.createdAt >= :from) and " +
           "(:to is null or o.createdAt <= :to) " +
           "order by o.createdAt desc")
    Page<Order> search(@Param("unitId") UUID unitId,
                       @Param("status") OrderStatus status,
                       @Param("from") LocalDateTime from,
                       @Param("to") LocalDateTime to,
                       Pageable pageable);
}
```

Commit: `git commit -m "feat(sp3): add OrderRepository with search query"`

---

## Task 12: Order DTOs

**Files:**
- Create `src/main/java/br/com/easy_inventory/management/order/dto/OrderItemRequest.java`
- Create `src/main/java/br/com/easy_inventory/management/order/dto/OrderItemResponse.java`
- Create `src/main/java/br/com/easy_inventory/management/order/dto/CreateOrderRequest.java`
- Create `src/main/java/br/com/easy_inventory/management/order/dto/UpdateOrderRequest.java`
- Create `src/main/java/br/com/easy_inventory/management/order/dto/OrderResponse.java`

**OrderItemRequest.java:**
```java
package br.com.easy_inventory.management.order.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record OrderItemRequest(
        @NotNull UUID productId,
        @NotNull @Min(1) Integer quantity
) {}
```

**OrderItemResponse.java:**
```java
package br.com.easy_inventory.management.order.dto;

import br.com.easy_inventory.management.order.entity.OrderItem;
import br.com.easy_inventory.management.product.entity.Product;

import java.math.BigDecimal;
import java.util.UUID;

public record OrderItemResponse(
        UUID id,
        UUID productId,
        String productName,
        int quantity,
        BigDecimal unitPrice,
        BigDecimal subtotal
) {
    public static OrderItemResponse from(OrderItem item) {
        Product p = item.getProduct();
        return new OrderItemResponse(
                item.getId(),
                p.getId(),
                p.getName() + " " + p.getSize(),
                item.getQuantity(),
                item.getUnitPrice(),
                item.getUnitPrice().multiply(BigDecimal.valueOf(item.getQuantity()))
        );
    }
}
```

**CreateOrderRequest.java:**
```java
package br.com.easy_inventory.management.order.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record CreateOrderRequest(
        @NotNull UUID unitId,
        @Size(max = 500) String notes,
        @NotEmpty @Valid List<OrderItemRequest> items
) {}
```

**UpdateOrderRequest.java:**
```java
package br.com.easy_inventory.management.order.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record UpdateOrderRequest(
        @NotNull UUID unitId,
        @Size(max = 500) String notes,
        @NotEmpty @Valid List<OrderItemRequest> items
) {}
```

**OrderResponse.java:**
```java
package br.com.easy_inventory.management.order.dto;

import br.com.easy_inventory.management.order.entity.Order;
import br.com.easy_inventory.management.order.entity.OrderStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record OrderResponse(
        UUID id,
        UUID unitId,
        String unitName,
        OrderStatus status,
        BigDecimal totalPrice,
        String notes,
        UUID createdById,
        LocalDateTime startedAt,
        LocalDateTime completedAt,
        LocalDateTime canceledAt,
        LocalDateTime createdAt,
        List<OrderItemResponse> items
) {
    public static OrderResponse from(Order o) {
        return new OrderResponse(
                o.getId(),
                o.getUnit().getId(),
                o.getUnit().getName(),
                o.getStatus(),
                o.getTotalPrice(),
                o.getNotes(),
                o.getCreatedBy().getId(),
                o.getStartedAt(),
                o.getCompletedAt(),
                o.getCanceledAt(),
                o.getCreatedAt(),
                o.getItems().stream().map(OrderItemResponse::from).toList()
        );
    }
}
```

Commit: `git commit -m "feat(sp3): add Order DTOs (request and response records)"`

---

## Task 13: OrderService — read + create + update

**Files:** Create `src/main/java/br/com/easy_inventory/management/order/service/OrderService.java`

```java
package br.com.easy_inventory.management.order.service;

import br.com.easy_inventory.management.order.dto.*;
import br.com.easy_inventory.management.order.entity.Order;
import br.com.easy_inventory.management.order.entity.OrderItem;
import br.com.easy_inventory.management.order.entity.OrderStatus;
import br.com.easy_inventory.management.order.repository.OrderRepository;
import br.com.easy_inventory.management.product.entity.Product;
import br.com.easy_inventory.management.product.repository.ProductRepository;
import br.com.easy_inventory.management.shared.exception.BusinessException;
import br.com.easy_inventory.management.shared.exception.ResourceNotFoundException;
import br.com.easy_inventory.management.stock.service.StockService;
import br.com.easy_inventory.management.unit.entity.Unit;
import br.com.easy_inventory.management.unit.repository.UnitRepository;
import br.com.easy_inventory.management.user.entity.User;
import br.com.easy_inventory.management.user.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final UnitRepository unitRepository;
    private final UserRepository userRepository;
    private final StockService stockService;

    public OrderService(OrderRepository orderRepository,
                        ProductRepository productRepository,
                        UnitRepository unitRepository,
                        UserRepository userRepository,
                        StockService stockService) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.unitRepository = unitRepository;
        this.userRepository = userRepository;
        this.stockService = stockService;
    }

    // ----- READ -----

    public Page<OrderResponse> findAll(UUID unitId, OrderStatus status,
                                       LocalDateTime from, LocalDateTime to, Pageable pageable) {
        return orderRepository.search(unitId, status, from, to, pageable)
                .map(OrderResponse::from);
    }

    public OrderResponse findById(UUID id) {
        return OrderResponse.from(getOrThrow(id));
    }

    // ----- CREATE -----

    @Transactional
    public OrderResponse create(CreateOrderRequest req, UUID actorUserId) {
        Unit unit = unitRepository.findById(req.unitId())
                .orElseThrow(() -> new ResourceNotFoundException("Unit not found: " + req.unitId()));
        User actor = userRepository.findById(actorUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + actorUserId));

        Order order = new Order();
        order.setUnit(unit);
        order.setNotes(req.notes());
        order.setCreatedBy(actor);

        attachItems(order, req.items());

        return OrderResponse.from(orderRepository.save(order));
    }

    // ----- UPDATE -----

    @Transactional
    public OrderResponse update(UUID id, UpdateOrderRequest req) {
        Order order = getOrThrow(id);
        if (order.getStatus() != OrderStatus.PENDING) {
            throw new BusinessException("Only pending orders can be edited");
        }
        Unit unit = unitRepository.findById(req.unitId())
                .orElseThrow(() -> new ResourceNotFoundException("Unit not found: " + req.unitId()));

        order.setUnit(unit);
        order.setNotes(req.notes());
        order.clearItems();
        attachItems(order, req.items());

        return OrderResponse.from(orderRepository.save(order));
    }

    // ----- STATE TRANSITIONS -----

    @Transactional
    public OrderResponse start(UUID id, UUID actorUserId) {
        Order order = getOrThrow(id);
        if (order.getStatus() != OrderStatus.PENDING) {
            throw new BusinessException("Only pending orders can be started");
        }

        Map<UUID, BigDecimal> ingredientTotals = new HashMap<>();
        for (OrderItem item : order.getItems()) {
            Product product = item.getProduct();
            for (var pi : product.getIngredients()) {
                UUID ingredientId = pi.getIngredient().getId();
                BigDecimal needed = pi.getQuantity().multiply(BigDecimal.valueOf(item.getQuantity()));
                ingredientTotals.merge(ingredientId, needed, BigDecimal::add);
            }
        }

        UUID unitId = order.getUnit().getId();
        for (Map.Entry<UUID, BigDecimal> entry : ingredientTotals.entrySet()) {
            stockService.applyExit(
                    entry.getKey(),
                    unitId,
                    entry.getValue(),
                    "Order #" + order.getId(),
                    actorUserId
            );
        }

        order.setStatus(OrderStatus.IN_PROGRESS);
        order.setStartedAt(LocalDateTime.now());
        return OrderResponse.from(orderRepository.save(order));
    }

    @Transactional
    public OrderResponse complete(UUID id) {
        Order order = getOrThrow(id);
        if (order.getStatus() != OrderStatus.IN_PROGRESS) {
            throw new BusinessException("Only in-progress orders can be completed");
        }
        order.setStatus(OrderStatus.COMPLETED);
        order.setCompletedAt(LocalDateTime.now());
        return OrderResponse.from(orderRepository.save(order));
    }

    @Transactional
    public OrderResponse cancel(UUID id) {
        Order order = getOrThrow(id);
        if (order.getStatus() != OrderStatus.PENDING) {
            throw new BusinessException("Only pending orders can be canceled");
        }
        order.setStatus(OrderStatus.CANCELED);
        order.setCanceledAt(LocalDateTime.now());
        return OrderResponse.from(orderRepository.save(order));
    }

    // ----- PRIVATE -----

    private void attachItems(Order order, List<OrderItemRequest> items) {
        Set<UUID> seen = new HashSet<>();
        BigDecimal total = BigDecimal.ZERO;
        for (OrderItemRequest it : items) {
            if (!seen.add(it.productId())) {
                throw new BusinessException("Duplicate product in order: " + it.productId());
            }
            Product product = productRepository.findById(it.productId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + it.productId()));
            if (!product.isActive()) {
                throw new BusinessException("Product is inactive: " + product.getName());
            }
            OrderItem oi = new OrderItem();
            oi.setProduct(product);
            oi.setQuantity(it.quantity());
            oi.setUnitPrice(product.getPrice());
            order.addItem(oi);
            total = total.add(product.getPrice().multiply(BigDecimal.valueOf(it.quantity())));
        }
        order.setTotalPrice(total);
    }

    Order getOrThrow(UUID id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + id));
    }
}
```

Commit: `git commit -m "feat(sp3): add OrderService with CRUD and automatic stock deduction"`

---

## Task 14: OrderController + SecurityConfig update

**Files:**
- Create `src/main/java/br/com/easy_inventory/management/order/controller/OrderController.java`
- Modify `src/main/java/br/com/easy_inventory/management/shared/security/SecurityConfig.java`

**OrderController.java:**
```java
package br.com.easy_inventory.management.order.controller;

import br.com.easy_inventory.management.order.dto.CreateOrderRequest;
import br.com.easy_inventory.management.order.dto.OrderResponse;
import br.com.easy_inventory.management.order.dto.UpdateOrderRequest;
import br.com.easy_inventory.management.order.entity.OrderStatus;
import br.com.easy_inventory.management.order.service.OrderService;
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
@RequestMapping("/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @GetMapping
    public ResponseEntity<PageResponse<OrderResponse>> list(
            @RequestParam(required = false) UUID unit,
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<OrderResponse> result = orderService.findAll(unit, status, from, to,
                PageRequest.of(page, size));
        return ResponseEntity.ok(PageResponse.of(result.getContent(), page, size, result.getTotalElements()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<OrderResponse>> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.of(orderService.findById(id)));
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<OrderResponse>> create(
            @Valid @RequestBody CreateOrderRequest request) {
        var response = orderService.create(request, AuthenticatedUser.currentId());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(response));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<OrderResponse>> update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateOrderRequest request) {
        return ResponseEntity.ok(ApiResponse.of(orderService.update(id, request)));
    }

    @PostMapping("/{id}/start")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<OrderResponse>> start(@PathVariable UUID id) {
        var response = orderService.start(id, AuthenticatedUser.currentId());
        return ResponseEntity.ok(ApiResponse.of(response));
    }

    @PostMapping("/{id}/complete")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<OrderResponse>> complete(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.of(orderService.complete(id)));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<OrderResponse>> cancel(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.of(orderService.cancel(id)));
    }
}
```

**SecurityConfig.java — add to the existing `securityFilterChain` bean, inside `authorizeHttpRequests`:**

Locate the line added in Task 9:
```java
.requestMatchers(HttpMethod.GET, "/products", "/products/**").permitAll()
```

Add below it:
```java
.requestMatchers(HttpMethod.GET, "/orders", "/orders/**").permitAll()
```

Commit: `git commit -m "feat(sp3): add OrderController with all 7 endpoints"`

---

## Task 15: Smoke verification (manual)

**Steps:**

1. `docker-compose up -d` — ensure Postgres running
2. `mvnw.cmd clean package -DskipTests` — confirm everything compiles
3. `mvnw.cmd spring-boot:run` — app starts cleanly, Flyway applies V13-V16
4. Open Swagger at `http://localhost:8080/swagger-ui.html` and verify all new endpoints appear:
   - `/products` (GET/POST), `/products/{id}` (GET/PUT/DELETE)
   - `/orders` (GET/POST), `/orders/{id}` (GET/PUT), `/orders/{id}/start`, `/orders/{id}/complete`, `/orders/{id}/cancel`
5. Login via `/auth/login` → click "Authorize" → paste access token
6. Quick end-to-end check:
   - `POST /products` with 2 ingredients in the recipe → 201, returns product with recipe sheet
   - `GET /products/{id}` → shows product with ingredients, quantities, and unitOfMeasure
   - `POST /products` again with same name+size → 400 (unique constraint)
   - `POST /orders` with 2 items → 201, returns order in PENDING with totalPrice computed
   - `PUT /orders/{id}` with different items → 200, items replaced
   - `POST /orders/{id}/start` → 200, order now IN_PROGRESS, `startedAt` set
   - `GET /stock-movements?type=EXIT` → shows EXIT movements with reason "Order #..."
   - `GET /stock` → quantities decreased by the recipe amounts × order quantities
   - `POST /orders/{id}/complete` → 200, order now COMPLETED, `completedAt` set
   - Create another order, try `POST /orders/{id}/cancel` while PENDING → 200, CANCELED
   - Try `POST /orders/{id}/start` on CANCELED order → 400
7. Stop app, no commit needed for smoke testing.

---

## Handoff to Testing

After Task 15 passes, hand off to Claude for integration tests. Expected test files:

- `src/test/java/.../product/ProductControllerTest.java` — CRUD, recipe sheet create/update/replace, duplicate name+size rejection, soft delete, filter by category/size/active
- `src/test/java/.../order/OrderControllerTest.java` — full CRUD + start (verifies stock deduction via EXIT movements + stock quantity decrease) + complete + cancel + state-machine violations (start non-pending, complete non-in-progress, cancel non-pending) + duplicate product in order rejection + inactive product rejection
- `src/test/java/.../order/OrderStockDeductionTest.java` — create order with multiple products sharing ingredients, start it, verify aggregated ingredient quantities are correctly deducted from stock; verify insufficient stock rolls back entire transaction

**Do not create these files yourself.** The user's workflow is to hand them off so Claude writes them.
