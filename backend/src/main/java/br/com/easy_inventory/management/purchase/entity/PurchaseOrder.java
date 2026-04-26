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