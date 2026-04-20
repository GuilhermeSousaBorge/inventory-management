package br.com.easy_inventory.management.category.dto;

import br.com.easy_inventory.management.category.entity.Category;
import java.time.LocalDateTime;
import java.util.UUID;

public record CategoryResponse(UUID id, String name, String description, LocalDateTime createdAt) {
    public static CategoryResponse from(Category c) {
        return new CategoryResponse(c.getId(), c.getName(), c.getDescription(), c.getCreatedAt());
    }
}
