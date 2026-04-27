package br.com.easy_inventory.management.audit;

import br.com.easy_inventory.management.audit.entity.AuditAction;
import br.com.easy_inventory.management.ingredient.dto.CreateIngredientRequest;
import br.com.easy_inventory.management.ingredient.dto.UpdateIngredientRequest;
import br.com.easy_inventory.management.ingredient.entity.UnitOfMeasure;
import br.com.easy_inventory.management.ingredient.service.IngredientService;
import br.com.easy_inventory.management.product.dto.CreateProductRequest;
import br.com.easy_inventory.management.product.dto.ProductIngredientRequest;
import br.com.easy_inventory.management.product.dto.UpdateProductRequest;
import br.com.easy_inventory.management.product.entity.ProductSize;
import br.com.easy_inventory.management.product.service.ProductService;
import br.com.easy_inventory.management.user.dto.CreateUserRequest;
import br.com.easy_inventory.management.user.dto.UpdateUserRequest;
import br.com.easy_inventory.management.user.entity.Role;
import br.com.easy_inventory.management.user.service.UserService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class AuditDetailsTest {

    static final UUID ADMIN_USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Autowired UserService userService;
    @Autowired IngredientService ingredientService;
    @Autowired ProductService productService;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void setUp() { cleanup(); }

    @AfterEach
    void tearDown() { cleanup(); }

    // ---- INGREDIENT_MIN_UPDATED ----

    @Test
    void ingredientUpdate_minimumQtyUnchanged_doesNotEmitMinUpdated() {
        var ing = ingredientService.create(
                new CreateIngredientRequest("Test Audit Details Ing", null, null,
                        UnitOfMeasure.kg, new BigDecimal("5.000"), null, null),
                ADMIN_USER_ID);

        ingredientService.update(ing.id(),
                new UpdateIngredientRequest("Test Audit Details Ing Renamed", null, null,
                        UnitOfMeasure.kg, new BigDecimal("5.000"), null, null, true),
                ADMIN_USER_ID);

        long minUpdated = countAudit("Ingredient", ing.id(), AuditAction.INGREDIENT_MIN_UPDATED);
        long updated = countAudit("Ingredient", ing.id(), AuditAction.INGREDIENT_UPDATED);
        assertThat(minUpdated).as("INGREDIENT_MIN_UPDATED should NOT be emitted").isZero();
        assertThat(updated).as("INGREDIENT_UPDATED still emitted").isEqualTo(1L);
    }

    @Test
    void ingredientUpdate_minimumQtyChanged_emitsMinUpdatedOnce() {
        var ing = ingredientService.create(
                new CreateIngredientRequest("Test Audit Details Ing", null, null,
                        UnitOfMeasure.kg, new BigDecimal("5.000"), null, null),
                ADMIN_USER_ID);

        ingredientService.update(ing.id(),
                new UpdateIngredientRequest("Test Audit Details Ing", null, null,
                        UnitOfMeasure.kg, new BigDecimal("10.000"), null, null, true),
                ADMIN_USER_ID);

        long minUpdated = countAudit("Ingredient", ing.id(), AuditAction.INGREDIENT_MIN_UPDATED);
        assertThat(minUpdated).isEqualTo(1L);

        // Verify the details JSON contains both before (5) and after (10) values.
        String details = jdbc.queryForObject(
                "SELECT details::text FROM audit_logs WHERE entity_type = 'Ingredient' " +
                        "AND entity_id = ? AND action = 'INGREDIENT_MIN_UPDATED'",
                String.class, ing.id());
        assertThat(details).contains("5");
        assertThat(details).contains("10");
        assertThat(details).contains("before");
        assertThat(details).contains("after");
    }

    // ---- PRODUCT_PRICE_CHANGED ----

    @Test
    void productUpdate_priceUnchanged_doesNotEmitPriceChanged() {
        var ing = ingredientService.create(
                new CreateIngredientRequest("Test Audit Details Ing", null, null,
                        UnitOfMeasure.kg, new BigDecimal("1.000"), null, null),
                ADMIN_USER_ID);
        var product = productService.create(
                new CreateProductRequest("Test Audit Details Pizza", ProductSize.M, null,
                        new BigDecimal("39.90"), "desc",
                        List.of(new ProductIngredientRequest(ing.id(), new BigDecimal("0.500")))),
                ADMIN_USER_ID);

        productService.update(product.id(),
                new UpdateProductRequest("Test Audit Details Pizza Renamed", ProductSize.M, null,
                        new BigDecimal("39.90"), "desc",
                        List.of(new ProductIngredientRequest(ing.id(), new BigDecimal("0.500")))),
                ADMIN_USER_ID);

        long priceChanged = countAudit("Product", product.id(), AuditAction.PRODUCT_PRICE_CHANGED);
        long updated = countAudit("Product", product.id(), AuditAction.PRODUCT_UPDATED);
        assertThat(priceChanged).isZero();
        assertThat(updated).isEqualTo(1L);
    }

    @Test
    void productUpdate_priceChanged_emitsPriceChangedOnce() {
        var ing = ingredientService.create(
                new CreateIngredientRequest("Test Audit Details Ing", null, null,
                        UnitOfMeasure.kg, new BigDecimal("1.000"), null, null),
                ADMIN_USER_ID);
        var product = productService.create(
                new CreateProductRequest("Test Audit Details Pizza", ProductSize.M, null,
                        new BigDecimal("39.90"), "desc",
                        List.of(new ProductIngredientRequest(ing.id(), new BigDecimal("0.500")))),
                ADMIN_USER_ID);

        productService.update(product.id(),
                new UpdateProductRequest("Test Audit Details Pizza", ProductSize.M, null,
                        new BigDecimal("49.90"), "desc",
                        List.of(new ProductIngredientRequest(ing.id(), new BigDecimal("0.500")))),
                ADMIN_USER_ID);

        long priceChanged = countAudit("Product", product.id(), AuditAction.PRODUCT_PRICE_CHANGED);
        assertThat(priceChanged).isEqualTo(1L);

        String details = jdbc.queryForObject(
                "SELECT details::text FROM audit_logs WHERE entity_type = 'Product' " +
                        "AND entity_id = ? AND action = 'PRODUCT_PRICE_CHANGED'",
                String.class, product.id());
        assertThat(details).contains("39.90");
        assertThat(details).contains("49.90");
    }

    // ---- PRODUCT_RECIPE_CHANGED ----

    @Test
    void productUpdate_recipeUnchanged_doesNotEmitRecipeChanged() {
        var ing = ingredientService.create(
                new CreateIngredientRequest("Test Audit Details Ing", null, null,
                        UnitOfMeasure.kg, new BigDecimal("1.000"), null, null),
                ADMIN_USER_ID);
        var product = productService.create(
                new CreateProductRequest("Test Audit Details Pizza", ProductSize.M, null,
                        new BigDecimal("39.90"), "desc",
                        List.of(new ProductIngredientRequest(ing.id(), new BigDecimal("0.500")))),
                ADMIN_USER_ID);

        productService.update(product.id(),
                new UpdateProductRequest("Test Audit Details Pizza", ProductSize.M, null,
                        new BigDecimal("39.90"), "desc",
                        List.of(new ProductIngredientRequest(ing.id(), new BigDecimal("0.500")))),
                ADMIN_USER_ID);

        long recipeChanged = countAudit("Product", product.id(), AuditAction.PRODUCT_RECIPE_CHANGED);
        assertThat(recipeChanged).isZero();
    }

    @Test
    void productUpdate_recipeChanged_emitsRecipeChangedOnce() {
        var ing1 = ingredientService.create(
                new CreateIngredientRequest("Test Audit Details Ing One", null, null,
                        UnitOfMeasure.kg, new BigDecimal("1.000"), null, null),
                ADMIN_USER_ID);
        var ing2 = ingredientService.create(
                new CreateIngredientRequest("Test Audit Details Ing Two", null, null,
                        UnitOfMeasure.kg, new BigDecimal("1.000"), null, null),
                ADMIN_USER_ID);
        var product = productService.create(
                new CreateProductRequest("Test Audit Details Pizza", ProductSize.M, null,
                        new BigDecimal("39.90"), "desc",
                        List.of(new ProductIngredientRequest(ing1.id(), new BigDecimal("0.500")))),
                ADMIN_USER_ID);

        // Different ingredient list => recipe changed
        productService.update(product.id(),
                new UpdateProductRequest("Test Audit Details Pizza", ProductSize.M, null,
                        new BigDecimal("39.90"), "desc",
                        List.of(new ProductIngredientRequest(ing2.id(), new BigDecimal("0.700")))),
                ADMIN_USER_ID);

        long recipeChanged = countAudit("Product", product.id(), AuditAction.PRODUCT_RECIPE_CHANGED);
        assertThat(recipeChanged).isEqualTo(1L);
    }

    // ---- USER_ROLE_CHANGED ----

    @Test
    void userUpdate_roleUnchanged_doesNotEmitRoleChanged() {
        String email = "audit-details-" + UUID.randomUUID() + "@test";
        var user = userService.create(
                new CreateUserRequest("Test Audit Details User", email, "pass1234", Role.EMPLOYEE),
                ADMIN_USER_ID);

        userService.update(user.id(),
                new UpdateUserRequest("Test Audit Details User Renamed", email, Role.EMPLOYEE, true),
                ADMIN_USER_ID);

        long roleChanged = countAudit("User", user.id(), AuditAction.USER_ROLE_CHANGED);
        long updated = countAudit("User", user.id(), AuditAction.USER_UPDATED);
        assertThat(roleChanged).as("USER_ROLE_CHANGED should NOT be emitted").isZero();
        assertThat(updated).as("USER_UPDATED still emitted").isEqualTo(1L);
    }

    @Test
    void userUpdate_roleChanged_emitsRoleChangedOnce() {
        String email = "audit-details-" + UUID.randomUUID() + "@test";
        var user = userService.create(
                new CreateUserRequest("Test Audit Details User", email, "pass1234", Role.EMPLOYEE),
                ADMIN_USER_ID);

        userService.update(user.id(),
                new UpdateUserRequest("Test Audit Details User", email, Role.OWNER, true),
                ADMIN_USER_ID);

        long roleChanged = countAudit("User", user.id(), AuditAction.USER_ROLE_CHANGED);
        assertThat(roleChanged).isEqualTo(1L);

        String details = jdbc.queryForObject(
                "SELECT details::text FROM audit_logs WHERE entity_type = 'User' " +
                        "AND entity_id = ? AND action = 'USER_ROLE_CHANGED'",
                String.class, user.id());
        assertThat(details).contains("EMPLOYEE");
        assertThat(details).contains("OWNER");
    }

    // ---- Helpers ----

    private long countAudit(String entityType, UUID entityId, AuditAction action) {
        return jdbc.queryForObject(
                "SELECT COUNT(*) FROM audit_logs WHERE entity_type = ? AND entity_id = ? AND action = ?",
                Long.class, entityType, entityId, action.name());
    }

    private void cleanup() {
        jdbc.update("DELETE FROM audit_logs WHERE entity_type = 'User' AND entity_id IN " +
                "(SELECT id FROM users WHERE email LIKE 'audit-details-%@test')");
        jdbc.update("DELETE FROM audit_logs WHERE actor_id IN " +
                "(SELECT id FROM users WHERE email LIKE 'audit-details-%@test')");
        jdbc.update("DELETE FROM audit_logs WHERE entity_type = 'Ingredient' AND entity_id IN " +
                "(SELECT id FROM ingredients WHERE name LIKE 'Test Audit Details%')");
        jdbc.update("DELETE FROM audit_logs WHERE entity_type = 'Product' AND entity_id IN " +
                "(SELECT id FROM products WHERE name LIKE 'Test Audit Details%')");

        jdbc.update("DELETE FROM product_ingredients WHERE product_id IN " +
                "(SELECT id FROM products WHERE name LIKE 'Test Audit Details%')");
        jdbc.update("DELETE FROM products WHERE name LIKE 'Test Audit Details%'");

        jdbc.update("DELETE FROM stock_movements WHERE ingredient_id IN " +
                "(SELECT id FROM ingredients WHERE name LIKE 'Test Audit Details%')");
        jdbc.update("DELETE FROM stock WHERE ingredient_id IN " +
                "(SELECT id FROM ingredients WHERE name LIKE 'Test Audit Details%')");
        jdbc.update("DELETE FROM ingredients WHERE name LIKE 'Test Audit Details%'");

        jdbc.update("DELETE FROM refresh_tokens WHERE user_id IN " +
                "(SELECT id FROM users WHERE email LIKE 'audit-details-%@test')");
        jdbc.update("DELETE FROM users WHERE email LIKE 'audit-details-%@test' AND id <> ?", ADMIN_USER_ID);
    }
}
