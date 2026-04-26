package br.com.easy_inventory.management.product.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.UUID;

public record ProductIngredientRequest(
        @NotNull UUID ingredientId,
        @NotNull @DecimalMin("0.001")BigDecimal quantity
        ) {
}
