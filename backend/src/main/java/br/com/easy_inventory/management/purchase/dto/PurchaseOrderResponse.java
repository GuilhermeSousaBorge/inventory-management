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