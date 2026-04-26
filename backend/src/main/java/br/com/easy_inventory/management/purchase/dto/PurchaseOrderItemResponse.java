package br.com.easy_inventory.management.purchase.dto;

import br.com.easy_inventory.management.purchase.entity.PurchaseOrderItem;

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