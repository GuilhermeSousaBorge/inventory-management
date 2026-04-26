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
