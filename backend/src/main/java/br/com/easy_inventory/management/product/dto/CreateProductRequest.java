package br.com.easy_inventory.management.product.dto;

import br.com.easy_inventory.management.product.entity.ProductSize;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record CreateProductRequest(
        @NotBlank @Size(max = 150) String name,
        @NotNull ProductSize size,
        UUID categoryId,
        @NotNull @DecimalMin("0.01") BigDecimal price,
        @Size(max = 255) String description,
        @NotEmpty @Valid List<ProductIngredientRequest> ingredients
) {
}
