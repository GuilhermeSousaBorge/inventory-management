package br.com.easy_inventory.management.product.dto;

import br.com.easy_inventory.management.ingredient.entity.UnitOfMeasure;
import br.com.easy_inventory.management.product.entity.ProductIngredient;

import java.math.BigDecimal;
import java.util.UUID;

public record ProductIngredientResponse(
        UUID id,
        UUID ingredientId,
        String ingredientName,
        BigDecimal quantity,
        UnitOfMeasure unitOfMeasure
) {
    public static ProductIngredientResponse from(ProductIngredient pi) {
        var ing = pi.getIngredient();
        return new ProductIngredientResponse(
                pi.getId(),
                ing.getId(),
                ing.getName(),
                pi.getQuantity(),
                ing.getUnitOfMeasure()
        );
    }
}
