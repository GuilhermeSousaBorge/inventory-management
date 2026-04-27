package br.com.easy_inventory.management.report.dto;

import br.com.easy_inventory.management.ingredient.entity.UnitOfMeasure;

import java.math.BigDecimal;
import java.util.UUID;

public record StockStatusRow(
        UUID ingredientId,
        String ingredientName,
        UnitOfMeasure unitOfMeasure,
        BigDecimal currentQuantity,
        BigDecimal minQuantity,
        String level
) {}
