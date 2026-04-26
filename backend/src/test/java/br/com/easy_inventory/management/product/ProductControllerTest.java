package br.com.easy_inventory.management.product;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class ProductControllerTest {

    static final UUID MATRIZ_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;

    private String adminToken;
    private String testIngredientId;
    private String testIngredient2Id;
    private String testCategoryId;

    @BeforeEach
    void setUp() throws Exception {
        cleanupTestData();
        adminToken = loginAsAdmin();
        testCategoryId = createTestCategory("Test Pizzas");
        testIngredientId = createTestIngredient("Test Mozzarella");
        testIngredient2Id = createTestIngredient("Test Tomato Sauce");
    }

    // ---- GET list ----

    @Test
    void listProducts_withoutAuth_returns200() throws Exception {
        mockMvc.perform(get("/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void listProducts_filteredByCategory_returnsMatching() throws Exception {
        createProduct("Test Margherita", "G", testCategoryId, 45.90);

        mockMvc.perform(get("/products").param("category", testCategoryId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].categoryId").value(testCategoryId));
    }

    @Test
    void listProducts_filteredBySize_returnsMatching() throws Exception {
        createProduct("Test Margherita", "P", testCategoryId, 29.90);
        createProduct("Test Margherita", "G", testCategoryId, 45.90);

        mockMvc.perform(get("/products").param("size", "P"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].size").value("P"));
    }

    @Test
    void listProducts_filteredByActive_returnsOnlyActive() throws Exception {
        String productId = createProduct("Test Calabresa", "M", testCategoryId, 39.90);
        mockMvc.perform(delete("/products/" + productId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/products").param("active", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.id=='" + productId + "')]").isEmpty());
    }

    // ---- GET by ID ----

    @Test
    void findProduct_withValidId_returns200WithRecipeSheet() throws Exception {
        String productId = createProduct("Test Margherita", "G", testCategoryId, 45.90);

        mockMvc.perform(get("/products/" + productId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(productId))
                .andExpect(jsonPath("$.data.name").value("Test Margherita"))
                .andExpect(jsonPath("$.data.size").value("G"))
                .andExpect(jsonPath("$.data.price").value(45.90))
                .andExpect(jsonPath("$.data.categoryName").value("Test Pizzas"))
                .andExpect(jsonPath("$.data.ingredients").isArray())
                .andExpect(jsonPath("$.data.ingredients[0].ingredientId").value(testIngredientId))
                .andExpect(jsonPath("$.data.ingredients[0].unitOfMeasure").value("kg"));
    }

    @Test
    void findProduct_withInvalidId_returns404() throws Exception {
        mockMvc.perform(get("/products/" + UUID.randomUUID()))
                .andExpect(status().isNotFound());
    }

    // ---- POST create ----

    @Test
    void createProduct_asOwner_returns201WithRecipeSheet() throws Exception {
        String body = buildProductBody("Test Portuguesa", "G", testCategoryId, 49.90,
                List.of(
                        Map.of("ingredientId", testIngredientId, "quantity", 0.300),
                        Map.of("ingredientId", testIngredient2Id, "quantity", 0.200)));

        mockMvc.perform(post("/products")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.name").value("Test Portuguesa"))
                .andExpect(jsonPath("$.data.size").value("G"))
                .andExpect(jsonPath("$.data.price").value(49.90))
                .andExpect(jsonPath("$.data.active").value(true))
                .andExpect(jsonPath("$.data.ingredients.length()").value(2));
    }

    @Test
    void createProduct_withoutAuth_returns401() throws Exception {
        String body = buildProductBody("Test Margherita", "G", testCategoryId, 45.90,
                List.of(Map.of("ingredientId", testIngredientId, "quantity", 0.300)));

        mockMvc.perform(post("/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void createProduct_withEmptyIngredients_returns400() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "name", "Test Empty",
                "size", "G",
                "price", 30.0,
                "ingredients", List.of()));

        mockMvc.perform(post("/products")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createProduct_withDuplicateIngredient_returns400() throws Exception {
        String body = buildProductBody("Test Duplicate", "G", testCategoryId, 40.0,
                List.of(
                        Map.of("ingredientId", testIngredientId, "quantity", 0.300),
                        Map.of("ingredientId", testIngredientId, "quantity", 0.100)));

        mockMvc.perform(post("/products")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createProduct_duplicateNameAndSize_returns400() throws Exception {
        createProduct("Test Margherita", "G", testCategoryId, 45.90);

        String body = buildProductBody("Test Margherita", "G", testCategoryId, 50.0,
                List.of(Map.of("ingredientId", testIngredient2Id, "quantity", 0.100)));

        mockMvc.perform(post("/products")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createProduct_sameNameDifferentSize_returns201() throws Exception {
        createProduct("Test Margherita", "P", testCategoryId, 29.90);

        String body = buildProductBody("Test Margherita", "G", testCategoryId, 45.90,
                List.of(Map.of("ingredientId", testIngredientId, "quantity", 0.500)));

        mockMvc.perform(post("/products")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.size").value("G"));
    }

    @Test
    void createProduct_withoutCategory_returns201() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "name", "Test No Category",
                "size", "M",
                "price", 35.0,
                "ingredients", List.of(
                        Map.of("ingredientId", testIngredientId, "quantity", 0.200))));

        mockMvc.perform(post("/products")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.categoryId").isEmpty());
    }

    // ---- PUT update ----

    @Test
    void updateProduct_replacesRecipeSheet() throws Exception {
        String productId = createProduct("Test Margherita", "G", testCategoryId, 45.90);

        String updateBody = buildProductBody("Test Margherita", "G", testCategoryId, 49.90,
                List.of(Map.of("ingredientId", testIngredient2Id, "quantity", 0.400)));

        mockMvc.perform(put("/products/" + productId)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.price").value(49.90))
                .andExpect(jsonPath("$.data.ingredients.length()").value(1))
                .andExpect(jsonPath("$.data.ingredients[0].ingredientId").value(testIngredient2Id));
    }

    @Test
    void updateProduct_withoutAuth_returns401() throws Exception {
        String productId = createProduct("Test Margherita", "G", testCategoryId, 45.90);

        String updateBody = buildProductBody("Test Margherita", "G", testCategoryId, 50.0,
                List.of(Map.of("ingredientId", testIngredientId, "quantity", 0.300)));

        mockMvc.perform(put("/products/" + productId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody))
                .andExpect(status().isUnauthorized());
    }

    // ---- DELETE (soft) ----

    @Test
    void deactivateProduct_asOwner_returns204() throws Exception {
        String productId = createProduct("Test Calabresa", "M", testCategoryId, 39.90);

        mockMvc.perform(delete("/products/" + productId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/products/" + productId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.active").value(false));
    }

    @Test
    void deactivateProduct_withoutAuth_returns401() throws Exception {
        String productId = createProduct("Test Calabresa", "M", testCategoryId, 39.90);

        mockMvc.perform(delete("/products/" + productId))
                .andExpect(status().isUnauthorized());
    }

    // ---- Helpers ----

    private String loginAsAdmin() throws Exception {
        String body = objectMapper.writeValueAsString(
                Map.of("email", "admin@pizzaria.com", "password", "admin123"));
        String resp = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(resp).path("data").path("accessToken").asText();
    }

    private String createTestCategory(String name) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of("name", name));
        String resp = mockMvc.perform(post("/categories")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(resp).path("data").path("id").asText();
    }

    private String createTestIngredient(String name) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "name", name,
                "unitOfMeasure", "kg",
                "minimumQty", 1.0));
        String resp = mockMvc.perform(post("/ingredients")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(resp).path("data").path("id").asText();
    }

    private String createProduct(String name, String size, String categoryId,
                                  double price) throws Exception {
        String body = buildProductBody(name, size, categoryId, price,
                List.of(Map.of("ingredientId", testIngredientId, "quantity", 0.300)));
        String resp = mockMvc.perform(post("/products")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(resp).path("data").path("id").asText();
    }

    private String buildProductBody(String name, String size, String categoryId,
                                     double price, List<Map<String, Object>> ingredients) throws Exception {
        var map = new java.util.HashMap<>(Map.of(
                "name", name,
                "size", size,
                "price", price,
                "ingredients", ingredients));
        if (categoryId != null) {
            map.put("categoryId", categoryId);
        }
        return objectMapper.writeValueAsString(map);
    }

    private void cleanupTestData() {
        jdbc.update("DELETE FROM order_items WHERE product_id IN (SELECT id FROM products WHERE name LIKE 'Test%')");
        jdbc.update("DELETE FROM orders WHERE notes LIKE 'Test%' OR id IN (SELECT DISTINCT oi.order_id FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE p.name LIKE 'Test%')");
        jdbc.update("DELETE FROM stock_movements WHERE ingredient_id IN (SELECT id FROM ingredients WHERE name LIKE 'Test%')");
        jdbc.update("DELETE FROM purchase_orders WHERE supplier_id IN (SELECT id FROM suppliers WHERE name LIKE 'Test%')");
        jdbc.update("DELETE FROM stock WHERE ingredient_id IN (SELECT id FROM ingredients WHERE name LIKE 'Test%')");
        jdbc.update("DELETE FROM products WHERE name LIKE 'Test%'");
        jdbc.update("DELETE FROM ingredients WHERE name LIKE 'Test%'");
        jdbc.update("DELETE FROM categories WHERE name LIKE 'Test%'");
        jdbc.update("DELETE FROM suppliers WHERE name LIKE 'Test%'");
    }
}
