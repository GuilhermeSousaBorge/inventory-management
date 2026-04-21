package br.com.easy_inventory.management.ingredient.repository;

import br.com.easy_inventory.management.ingredient.entity.Ingredient;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface IngredientRepository extends JpaRepository<Ingredient, UUID> {
    Page<Ingredient> findByCategoryId(UUID categoryId, Pageable pageable);
    Page<Ingredient> findByActive(boolean active, Pageable pageable);
    Page<Ingredient> findByCategoryIdAndActive(UUID categoryId, boolean active, Pageable pageable);
}
