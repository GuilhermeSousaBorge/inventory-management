package br.com.easy_inventory.management.ingredient.dto;

import br.com.easy_inventory.management.ingredient.entity.Ingredient;
import br.com.easy_inventory.management.ingredient.entity.UnitOfMeasure;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record IngredientResponse(
        UUID id, String name, String description,
        UUID categoryId, String categoryName,
        UnitOfMeasure unitOfMeasure,
        BigDecimal minimumQty, BigDecimal averageCost,
        LocalDate expiryDate,
        UUID defaultSupplierId, String defaultSupplierName,
        boolean active, LocalDateTime createdAt
) {
    public static IngredientResponse from(Ingredient i) {
        return new IngredientResponse(
                i.getId(), i.getName(), i.getDescription(),
                i.getCategory() != null ? i.getCategory().getId() : null,
                i.getCategory() != null ? i.getCategory().getName() : null,
                i.getUnitOfMeasure(),
                i.getMinimumQty(), i.getAverageCost(),
                i.getExpiryDate(),
                i.getDefaultSupplier() != null ? i.getDefaultSupplier().getId() : null,
                i.getDefaultSupplier() != null ? i.getDefaultSupplier().getName() : null,
                i.isActive(), i.getCreatedAt()
        );
    }
}
