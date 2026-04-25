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