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
