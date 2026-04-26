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