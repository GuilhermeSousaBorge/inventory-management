package br.com.easy_inventory.management.product.service;

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

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class ProductService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final IngredientRepository ingredientRepository;

    public ProductService(ProductRepository productRepository,
                          CategoryRepository categoryRepository,
                          IngredientRepository ingredientRepository) {
        this.productRepository = productRepository;
        this.categoryRepository = categoryRepository;
        this.ingredientRepository = ingredientRepository;
    }

    public Page<ProductResponse> findAll(UUID categoryId, ProductSize size, Boolean active, Pageable pageable) {
        return productRepository.search(categoryId, size, active, pageable)
                .map(ProductResponse::from);
    }

    public ProductResponse findById(UUID id) {
        return ProductResponse.from(getOrThrow(id));
    }

    @Transactional
    public ProductResponse create(CreateProductRequest req) {
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
            return ProductResponse.from(productRepository.saveAndFlush(product));
        } catch (DataIntegrityViolationException e) {
            throw new BusinessException("Product '" + req.name() + "' size " + req.size() + " already exists");
        }
    }

    @Transactional
    public ProductResponse update(UUID id, UpdateProductRequest req) {
        Product product = getOrThrow(id);
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
            return ProductResponse.from(productRepository.saveAndFlush(product));
        } catch (DataIntegrityViolationException e) {
            throw new BusinessException("Product '" + req.name() + "' size " + req.size() + " already exists");
        }
    }

    @Transactional
    public void deactivate(UUID id) {
        Product product = getOrThrow(id);
        product.setActive(false);
        productRepository.save(product);
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