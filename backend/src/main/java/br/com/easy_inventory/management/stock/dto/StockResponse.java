package br.com.easy_inventory.management.stock.dto;

import br.com.easy_inventory.management.stock.entity.Stock;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record StockResponse(
        UUID id,
        UUID ingredientId, String ingredientName,
        UUID unitId, String unitName,
        BigDecimal quantity,
        BigDecimal minimumQty,
        boolean belowMinimum,
        BigDecimal averageCost,
        LocalDateTime updatedAt
) {
    public static StockResponse from(Stock s) {
        var ing = s.getIngredient();
        var unit = s.getUnit();
        boolean below = s.getQuantity().compareTo(ing.getMinimumQty()) < 0;
        return new StockResponse(
                s.getId(),
                ing.getId(), ing.getName(),
                unit.getId(), unit.getName(),
                s.getQuantity(),
                ing.getMinimumQty(),
                below,
                ing.getAverageCost(),
                s.getUpdatedAt()
        );
    }
}
