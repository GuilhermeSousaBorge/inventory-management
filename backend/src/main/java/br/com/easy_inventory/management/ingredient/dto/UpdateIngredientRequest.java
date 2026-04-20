package br.com.easy_inventory.management.ingredient.dto;

import br.com.easy_inventory.management.ingredient.entity.UnitOfMeasure;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record UpdateIngredientRequest(
        @NotBlank @Size(max = 150) String name,
        @Size(max = 255) String description,
        UUID categoryId,
        @NotNull UnitOfMeasure unitOfMeasure,
        @NotNull @DecimalMin("0.001") BigDecimal minimumQty,
        LocalDate expiryDate,
        UUID defaultSupplierId,
        @NotNull Boolean active
) {}
