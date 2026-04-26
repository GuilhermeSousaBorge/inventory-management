package br.com.easy_inventory.management.product.dto;

import br.com.easy_inventory.management.product.entity.Product;
import br.com.easy_inventory.management.product.entity.ProductSize;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record ProductResponse(
        UUID id,
        String name,
        ProductSize size,
        UUID categoryId,
        String categoryName,
        BigDecimal price,
        String description,
        Boolean active,
        LocalDateTime createdAt,
        List<ProductIngredientResponse> ingredients
) {
    public static ProductResponse from(Product p) {
        var cat = p.getCategory();
        return new ProductResponse(
                p.getId(),
                p.getName(),
                p.getSize(),
                cat != null ? cat.getId() : null,
                cat != null ? cat.getName() : null,
                p.getPrice(),
                p.getDescription(),
                p.isActive(),
                p.getCreatedAt(),
                p.getIngredients().stream().map(ProductIngredientResponse::from).toList()
        );
    }
}
