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