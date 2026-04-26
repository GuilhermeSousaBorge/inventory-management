package br.com.easy_inventory.management.order;

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
class OrderStockDeductionTest {

    static final UUID MATRIZ_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;

    private String adminToken;
    private String cheeseId;
    private String flourId;
    private String sauceId;

    @BeforeEach
    void setUp() throws Exception {
        cleanupTestData();
        adminToken = loginAsAdmin();

        cheeseId = createTestIngredient("Test Deduct Cheese");
        flourId = createTestIngredient("Test Deduct Flour");
        sauceId = createTestIngredient("Test Deduct Sauce");

        seedStock(cheeseId, 10.0, 20.0);
        seedStock(flourId, 10.0, 5.0);
        seedStock(sauceId, 10.0, 8.0);
    }

    @Test
    void startOrder_aggregatesSharedIngredients() throws Exception {
        // Both products share cheese: Pizza A uses 0.3kg, Pizza B uses 0.2kg
        String productA = createTestProduct("Test Deduct Pizza A", "G", 45.0,
                List.of(
                        Map.of("ingredientId", cheeseId, "quantity", 0.300),
                        Map.of("ingredientId", sauceId, "quantity", 0.150)));

        String productB = createTestProduct("Test Deduct Pizza B", "M", 35.0,
                List.of(
                        Map.of("ingredientId", cheeseId, "quantity", 0.200),
                        Map.of("ingredientId", flourId, "quantity", 0.400)));

        // Order: 2x Pizza A + 1x Pizza B
        // Cheese needed: 2*0.3 + 1*0.2 = 0.8
        // Sauce needed:  2*0.150 = 0.3
        // Flour needed:  1*0.400 = 0.4
        String orderId = createOrder(List.of(
                Map.of("productId", productA, "quantity", 2),
                Map.of("productId", productB, "quantity", 1)));

        mockMvc.perform(post("/orders/" + orderId + "/start")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("IN_PROGRESS"));

        // Verify stock: 10.0 - 0.8 = 9.2
        mockMvc.perform(get("/stock").param("ingredient", cheeseId))
                .andExpect(jsonPath("$.data[0].quantity").value(9.2));

        // Verify stock: 10.0 - 0.3 = 9.7
        mockMvc.perform(get("/stock").param("ingredient", sauceId))
                .andExpect(jsonPath("$.data[0].quantity").value(9.7));

        // Verify stock: 10.0 - 0.4 = 9.6
        mockMvc.perform(get("/stock").param("ingredient", flourId))
                .andExpect(jsonPath("$.data[0].quantity").value(9.6));
    }

    @Test
    void startOrder_insufficientStock_rollsBackEntireTransaction() throws Exception {
        // Product needs 8kg cheese per unit — stock has 10kg
        String productBig = createTestProduct("Test Deduct Big Pizza", "GG", 80.0,
                List.of(Map.of("ingredientId", cheeseId, "quantity", 8.0)));

        // Order 2 units → needs 16kg, only 10kg available
        String orderId = createOrder(List.of(
                Map.of("productId", productBig, "quantity", 2)));

        mockMvc.perform(post("/orders/" + orderId + "/start")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());

        // Verify order still PENDING (rolled back)
        mockMvc.perform(get("/orders/" + orderId))
                .andExpect(jsonPath("$.data.status").value("PENDING"));

        // Verify stock unchanged at 10.0
        mockMvc.perform(get("/stock").param("ingredient", cheeseId))
                .andExpect(jsonPath("$.data[0].quantity").value(10.0));
    }

    @Test
    void startOrder_multipleOrdersDeductCumulatively() throws Exception {
        String product = createTestProduct("Test Deduct Simple", "P", 25.0,
                List.of(Map.of("ingredientId", cheeseId, "quantity", 1.0)));

        // First order: 3 units → deducts 3kg
        String order1 = createOrder(List.of(Map.of("productId", product, "quantity", 3)));
        mockMvc.perform(post("/orders/" + order1 + "/start")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/stock").param("ingredient", cheeseId))
                .andExpect(jsonPath("$.data[0].quantity").value(7.0));

        // Second order: 4 units → deducts 4kg more
        String order2 = createOrder(List.of(Map.of("productId", product, "quantity", 4)));
        mockMvc.perform(post("/orders/" + order2 + "/start")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/stock").param("ingredient", cheeseId))
                .andExpect(jsonPath("$.data[0].quantity").value(3.0));
    }

    @Test
    void startOrder_exitMovementsHaveOrderReason() throws Exception {
        String product = createTestProduct("Test Deduct Reason", "M", 30.0,
                List.of(Map.of("ingredientId", cheeseId, "quantity", 0.5)));

        String orderId = createOrder(List.of(Map.of("productId", product, "quantity", 1)));
        mockMvc.perform(post("/orders/" + orderId + "/start")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/stock-movements")
                        .param("ingredient", cheeseId)
                        .param("type", "EXIT"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].type").value("EXIT"))
                .andExpect(jsonPath("$.data[0].reason").value("Order #" + orderId));
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

    private String createTestProduct(String name, String size, double price,
                                      List<Map<String, Object>> ingredients) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "name", name,
                "size", size,
                "price", price,
                "ingredients", ingredients));
        String resp = mockMvc.perform(post("/products")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(resp).path("data").path("id").asText();
    }

    private void seedStock(String ingredientId, double qty, double unitPrice) throws Exception {
        String supplierId = createTestSupplier("Test Supplier Ded " + ingredientId.substring(0, 8));
        String poBody = objectMapper.writeValueAsString(Map.of(
                "supplierId", supplierId,
                "unitId", MATRIZ_ID.toString(),
                "notes", "Test stock seed",
                "items", List.of(Map.of(
                        "ingredientId", ingredientId,
                        "quantity", qty,
                        "unitPrice", unitPrice))));
        String poResp = mockMvc.perform(post("/purchase-orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(poBody))
                .andReturn().getResponse().getContentAsString();
        String poId = objectMapper.readTree(poResp).path("data").path("id").asText();

        mockMvc.perform(post("/purchase-orders/" + poId + "/receive")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    private String createTestSupplier(String name) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of("name", name));
        String resp = mockMvc.perform(post("/suppliers")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(resp).path("data").path("id").asText();
    }

    private String createOrder(List<Map<String, Object>> items) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "unitId", MATRIZ_ID.toString(),
                "notes", "Test deduction order",
                "items", items));
        String resp = mockMvc.perform(post("/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(resp).path("data").path("id").asText();
    }

    private void cleanupTestData() {
        jdbc.update("DELETE FROM stock_movements WHERE reason LIKE 'Order #%' AND ingredient_id IN (SELECT id FROM ingredients WHERE name LIKE 'Test%')");
        jdbc.update("DELETE FROM stock_movements WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE supplier_id IN (SELECT id FROM suppliers WHERE name LIKE 'Test%'))");
        jdbc.update("DELETE FROM stock_movements WHERE ingredient_id IN (SELECT id FROM ingredients WHERE name LIKE 'Test%')");
        jdbc.update("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE notes LIKE 'Test%')");
        jdbc.update("DELETE FROM orders WHERE notes LIKE 'Test%'");
        jdbc.update("DELETE FROM purchase_orders WHERE supplier_id IN (SELECT id FROM suppliers WHERE name LIKE 'Test%')");
        jdbc.update("DELETE FROM stock WHERE ingredient_id IN (SELECT id FROM ingredients WHERE name LIKE 'Test%')");
        jdbc.update("DELETE FROM products WHERE name LIKE 'Test%'");
        jdbc.update("DELETE FROM ingredients WHERE name LIKE 'Test%'");
        jdbc.update("DELETE FROM suppliers WHERE name LIKE 'Test%'");
    }
}
