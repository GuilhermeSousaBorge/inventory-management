package br.com.easy_inventory.management.report.dto;

import br.com.easy_inventory.management.ingredient.entity.UnitOfMeasure;

import java.math.BigDecimal;
import java.util.UUID;

public record ConsumptionReportRow(
        UUID ingredientId,
        String ingredientName,
        UnitOfMeasure unitOfMeasure,
        BigDecimal totalQuantity,
        long movementCount
) {}
