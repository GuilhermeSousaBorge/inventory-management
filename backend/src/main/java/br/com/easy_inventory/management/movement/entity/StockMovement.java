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
