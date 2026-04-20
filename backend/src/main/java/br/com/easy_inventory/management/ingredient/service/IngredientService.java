package br.com.easy_inventory.management.ingredient.service;

import br.com.easy_inventory.management.category.entity.Category;
import br.com.easy_inventory.management.category.repository.CategoryRepository;
import br.com.easy_inventory.management.ingredient.dto.*;
import br.com.easy_inventory.management.ingredient.entity.Ingredient;
import br.com.easy_inventory.management.ingredient.repository.IngredientRepository;
import br.com.easy_inventory.management.shared.exception.ResourceNotFoundException;
import br.com.easy_inventory.management.supplier.entity.Supplier;
import br.com.easy_inventory.management.supplier.repository.SupplierRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class IngredientService {

    private final IngredientRepository ingredientRepository;
    private final CategoryRepository categoryRepository;
    private final SupplierRepository supplierRepository;

    public IngredientService(IngredientRepository ingredientRepository,
                              CategoryRepository categoryRepository,
                              SupplierRepository supplierRepository) {
        this.ingredientRepository = ingredientRepository;
        this.categoryRepository = categoryRepository;
        this.supplierRepository = supplierRepository;
    }

    public Page<IngredientResponse> findAll(UUID categoryId, Boolean active, Pageable pageable) {
        if (categoryId != null && active != null) {
            return ingredientRepository.findByCategoryIdAndActive(categoryId, active, pageable)
                    .map(IngredientResponse::from);
        } else if (categoryId != null) {
            return ingredientRepository.findByCategoryId(categoryId, pageable).map(IngredientResponse::from);
        } else if (active != null) {
            return ingredientRepository.findByActive(active, pageable).map(IngredientResponse::from);
        }
        return ingredientRepository.findAll(pageable).map(IngredientResponse::from);
    }

    public IngredientResponse findById(UUID id) {
        return IngredientResponse.from(getOrThrow(id));
    }

    @Transactional
    public IngredientResponse create(CreateIngredientRequest request) {
        Ingredient ingredient = new Ingredient();
        ingredient.setName(request.name());
        ingredient.setDescription(request.description());
        ingredient.setUnitOfMeasure(request.unitOfMeasure());
        ingredient.setMinimumQty(request.minimumQty());
        ingredient.setExpiryDate(request.expiryDate());
        if (request.categoryId() != null) {
            Category cat = categoryRepository.findById(request.categoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("Category not found"));
            ingredient.setCategory(cat);
        }
        if (request.defaultSupplierId() != null) {
            Supplier sup = supplierRepository.findById(request.defaultSupplierId())
                    .orElseThrow(() -> new ResourceNotFoundException("Supplier not found"));
            ingredient.setDefaultSupplier(sup);
        }
        return IngredientResponse.from(ingredientRepository.save(ingredient));
    }

    @Transactional
    public IngredientResponse update(UUID id, UpdateIngredientRequest request) {
        Ingredient ingredient = getOrThrow(id);
        ingredient.setName(request.name());
        ingredient.setDescription(request.description());
        ingredient.setUnitOfMeasure(request.unitOfMeasure());
        ingredient.setMinimumQty(request.minimumQty());
        ingredient.setExpiryDate(request.expiryDate());
        ingredient.setActive(request.active());
        ingredient.setCategory(request.categoryId() != null
                ? categoryRepository.findById(request.categoryId())
                        .orElseThrow(() -> new ResourceNotFoundException("Category not found"))
                : null);
        ingredient.setDefaultSupplier(request.defaultSupplierId() != null
                ? supplierRepository.findById(request.defaultSupplierId())
                        .orElseThrow(() -> new ResourceNotFoundException("Supplier not found"))
                : null);
        return IngredientResponse.from(ingredientRepository.save(ingredient));
    }

    @Transactional
    public void deactivate(UUID id) {
        Ingredient ingredient = getOrThrow(id);
        ingredient.setActive(false);
        ingredientRepository.save(ingredient);
    }

    private Ingredient getOrThrow(UUID id) {
        return ingredientRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ingredient not found: " + id));
    }
}
