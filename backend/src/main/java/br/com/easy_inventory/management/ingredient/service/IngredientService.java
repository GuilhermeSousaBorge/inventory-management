package br.com.easy_inventory.management.ingredient.service;

import br.com.easy_inventory.management.audit.entity.AuditAction;
import br.com.easy_inventory.management.audit.service.AuditService;
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

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class IngredientService {

    private final IngredientRepository ingredientRepository;
    private final CategoryRepository categoryRepository;
    private final SupplierRepository supplierRepository;
    private final AuditService auditService;

    public IngredientService(IngredientRepository ingredientRepository,
                              CategoryRepository categoryRepository,
                              SupplierRepository supplierRepository,
                              AuditService auditService) {
        this.ingredientRepository = ingredientRepository;
        this.categoryRepository = categoryRepository;
        this.supplierRepository = supplierRepository;
        this.auditService = auditService;
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
    public IngredientResponse create(CreateIngredientRequest request, UUID actorUserId) {
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
        Ingredient saved = ingredientRepository.save(ingredient);

        auditService.log(AuditAction.INGREDIENT_CREATED, "Ingredient", saved.getId(), actorUserId,
                Map.of("name", saved.getName(), "minimumQty", saved.getMinimumQty()));
        return IngredientResponse.from(saved);
    }

    @Transactional
    public IngredientResponse update(UUID id, UpdateIngredientRequest request, UUID actorUserId) {
        Ingredient ingredient = getOrThrow(id);

        Map<String, Object> before = new HashMap<>();
        before.put("name", ingredient.getName());
        before.put("categoryId", ingredient.getCategory() != null ? ingredient.getCategory().getId() : null);
        before.put("minimumQty", ingredient.getMinimumQty());
        before.put("unitOfMeasure", ingredient.getUnitOfMeasure().name());
        before.put("active", ingredient.isActive());

        boolean minChanged = ingredient.getMinimumQty().compareTo(request.minimumQty()) != 0;

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
        Ingredient saved = ingredientRepository.save(ingredient);

        Map<String, Object> after = new HashMap<>();
        after.put("name", saved.getName());
        after.put("categoryId", saved.getCategory() != null ? saved.getCategory().getId() : null);
        after.put("minimumQty", saved.getMinimumQty());
        after.put("unitOfMeasure", saved.getUnitOfMeasure().name());
        after.put("active", saved.isActive());

        auditService.log(AuditAction.INGREDIENT_UPDATED, "Ingredient", saved.getId(), actorUserId,
                Map.of("before", before, "after", after));
        if (minChanged) {
            auditService.log(AuditAction.INGREDIENT_MIN_UPDATED, "Ingredient", saved.getId(), actorUserId,
                    Map.of("before", before.get("minimumQty"), "after", after.get("minimumQty")));
        }
        return IngredientResponse.from(saved);
    }

    @Transactional
    public void deactivate(UUID id, UUID actorUserId) {
        Ingredient ingredient = getOrThrow(id);
        ingredient.setActive(false);
        ingredientRepository.save(ingredient);
        auditService.log(AuditAction.INGREDIENT_DEACTIVATED, "Ingredient", id, actorUserId, null);
    }

    private Ingredient getOrThrow(UUID id) {
        return ingredientRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ingredient not found: " + id));
    }
}
