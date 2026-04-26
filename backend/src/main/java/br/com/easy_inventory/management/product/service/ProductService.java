package br.com.easy_inventory.management.product.service;

import br.com.easy_inventory.management.audit.entity.AuditAction;
import br.com.easy_inventory.management.audit.service.AuditService;
import br.com.easy_inventory.management.category.entity.Category;
import br.com.easy_inventory.management.category.repository.CategoryRepository;
import br.com.easy_inventory.management.ingredient.entity.Ingredient;
import br.com.easy_inventory.management.ingredient.repository.IngredientRepository;
import br.com.easy_inventory.management.product.dto.*;
import br.com.easy_inventory.management.product.entity.Product;
import br.com.easy_inventory.management.product.entity.ProductIngredient;
import br.com.easy_inventory.management.product.entity.ProductSize;
import br.com.easy_inventory.management.product.repository.ProductRepository;
import br.com.easy_inventory.management.shared.exception.BusinessException;
import br.com.easy_inventory.management.shared.exception.ResourceNotFoundException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ProductService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final IngredientRepository ingredientRepository;
    private final AuditService auditService;

    public ProductService(ProductRepository productRepository,
                          CategoryRepository categoryRepository,
                          IngredientRepository ingredientRepository,
                          AuditService auditService) {
        this.productRepository = productRepository;
        this.categoryRepository = categoryRepository;
        this.ingredientRepository = ingredientRepository;
        this.auditService = auditService;
    }

    public Page<ProductResponse> findAll(UUID categoryId, ProductSize size, Boolean active, Pageable pageable) {
        return productRepository.search(categoryId, size, active, pageable)
                .map(ProductResponse::from);
    }

    public ProductResponse findById(UUID id) {
        return ProductResponse.from(getOrThrow(id));
    }

    @Transactional
    public ProductResponse create(CreateProductRequest req, UUID actorUserId) {
        Product product = new Product();
        product.setName(req.name());
        product.setSize(req.size());
        product.setPrice(req.price());
        product.setDescription(req.description());

        if (req.categoryId() != null) {
            Category cat = categoryRepository.findById(req.categoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("Category not found: " + req.categoryId()));
            product.setCategory(cat);
        }

        attachIngredients(product, req.ingredients());

        try {
            Product saved = productRepository.saveAndFlush(product);
            auditService.log(AuditAction.PRODUCT_CREATED, "Product", saved.getId(), actorUserId,
                    Map.of("name", saved.getName(), "size", saved.getSize().name(),
                           "price", saved.getPrice(), "ingredientCount", saved.getIngredients().size()));
            return ProductResponse.from(saved);
        } catch (DataIntegrityViolationException e) {
            throw new BusinessException("Product '" + req.name() + "' size " + req.size() + " already exists");
        }
    }

    @Transactional
    public ProductResponse update(UUID id, UpdateProductRequest req, UUID actorUserId) {
        Product product = getOrThrow(id);

        Map<UUID, BigDecimal> oldRecipe = product.getIngredients().stream()
                .collect(Collectors.toMap(pi -> pi.getIngredient().getId(), ProductIngredient::getQuantity));
        BigDecimal oldPrice = product.getPrice();
        Map<String, Object> before = new HashMap<>();
        before.put("name", product.getName());
        before.put("size", product.getSize().name());
        before.put("price", product.getPrice());
        before.put("active", product.isActive());

        product.setName(req.name());
        product.setSize(req.size());
        product.setPrice(req.price());
        product.setDescription(req.description());

        if (req.categoryId() != null) {
            Category cat = categoryRepository.findById(req.categoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("Category not found: " + req.categoryId()));
            product.setCategory(cat);
        } else {
            product.setCategory(null);
        }

        product.clearIngredients();
        attachIngredients(product, req.ingredients());

        try {
            Product saved = productRepository.saveAndFlush(product);

            Map<UUID, BigDecimal> newRecipe = saved.getIngredients().stream()
                    .collect(Collectors.toMap(pi -> pi.getIngredient().getId(), ProductIngredient::getQuantity));
            Map<String, Object> after = new HashMap<>();
            after.put("name", saved.getName());
            after.put("size", saved.getSize().name());
            after.put("price", saved.getPrice());
            after.put("active", saved.isActive());

            boolean priceChanged = oldPrice.compareTo(saved.getPrice()) != 0;
            boolean recipeChanged = !oldRecipe.equals(newRecipe);

            auditService.log(AuditAction.PRODUCT_UPDATED, "Product", saved.getId(), actorUserId,
                    Map.of("before", before, "after", after));
            if (priceChanged) {
                auditService.log(AuditAction.PRODUCT_PRICE_CHANGED, "Product", saved.getId(), actorUserId,
                        Map.of("before", oldPrice, "after", saved.getPrice()));
            }
            if (recipeChanged) {
                Map<String, BigDecimal> oldRecipeStr = oldRecipe.entrySet().stream()
                        .collect(Collectors.toMap(e -> e.getKey().toString(), Map.Entry::getValue));
                Map<String, BigDecimal> newRecipeStr = newRecipe.entrySet().stream()
                        .collect(Collectors.toMap(e -> e.getKey().toString(), Map.Entry::getValue));
                auditService.log(AuditAction.PRODUCT_RECIPE_CHANGED, "Product", saved.getId(), actorUserId,
                        Map.of("before", oldRecipeStr, "after", newRecipeStr));
            }
            return ProductResponse.from(saved);
        } catch (DataIntegrityViolationException e) {
            throw new BusinessException("Product '" + req.name() + "' size " + req.size() + " already exists");
        }
    }

    @Transactional
    public void deactivate(UUID id, UUID actorUserId) {
        Product product = getOrThrow(id);
        product.setActive(false);
        productRepository.save(product);
        auditService.log(AuditAction.PRODUCT_DEACTIVATED, "Product", id, actorUserId, null);
    }

    private void attachIngredients(Product product, List<ProductIngredientRequest> ingredients) {
        Set<UUID> seen = new HashSet<>();
        for (ProductIngredientRequest it : ingredients) {
            if (!seen.add(it.ingredientId())) {
                throw new BusinessException("Duplicate ingredient in recipe: " + it.ingredientId());
            }
            Ingredient ing = ingredientRepository.findById(it.ingredientId())
                    .orElseThrow(() -> new ResourceNotFoundException("Ingredient not found: " + it.ingredientId()));
            if (!ing.isActive()) {
                throw new BusinessException("Ingredient is inactive: " + ing.getName());
            }
            ProductIngredient pi = new ProductIngredient();
            pi.setIngredient(ing);
            pi.setQuantity(it.quantity());
            product.addIngredient(pi);
        }
    }

    Product getOrThrow(UUID id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + id));
    }
}