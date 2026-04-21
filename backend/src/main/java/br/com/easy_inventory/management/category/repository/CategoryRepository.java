package br.com.easy_inventory.management.category.repository;

import br.com.easy_inventory.management.category.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.UUID;

public interface CategoryRepository extends JpaRepository<Category, UUID> {
    boolean existsByName(String name);

    // Native query avoids JPQL dependency on Ingredient entity (created in Task 16)
    @Query(value = "SELECT COUNT(*) > 0 FROM ingredients WHERE category_id = :categoryId", nativeQuery = true)
    boolean hasIngredients(UUID categoryId);
}
