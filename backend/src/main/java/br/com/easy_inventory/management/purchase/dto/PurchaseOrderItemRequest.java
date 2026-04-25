package br.com.easy_inventory.management.purchase.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.UUID;

public record PurchaseOrderItemRequest(
        @NotNull UUID ingredientId,
        @NotNull @DecimalMin("0.001") BigDecimal quantity,
        @NotNull @DecimalMin("0.0000") BigDecimal unitPrice
) {}
