package br.com.easy_inventory.management.movement.dto;

import br.com.easy_inventory.management.movement.entity.AdjustmentDirection;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.UUID;

public record CreateAdjustmentRequest(
        @NotNull UUID ingredientId,
        @NotNull UUID unitId,
        @NotNull @DecimalMin("0.001") BigDecimal quantity,
        @NotNull AdjustmentDirection direction,
        @NotBlank @Size(max = 255) String reason
) {}
