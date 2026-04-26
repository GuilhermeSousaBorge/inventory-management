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
class OrderControllerTest {

    static final UUID MATRIZ_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;

    private String adminToken;
    private String testProductId;
    private String testProduct2Id;
    private String testIngredientId;
    private String testIngredient2Id;

    @BeforeEach
    void setUp() throws Exception {
        cleanupTestData();
        adminToken = loginAsAdmin();

        testIngredientId = createTestIngredient("Test Order Cheese");
        testIngredient2Id = createTestIngredient("Test Order Flour");
        testProductId = createTestProduct("Test Pizza A", "G", 45.90,
                List.of(Map.of("ingredientId", testIngredientId, "quantity", 0.300)));
        testProduct2Id = createTestProduct("Test Pizza B", "M", 35.90,
                List.of(Map.of("ingredientId", testIngredient2Id, "quantity", 0.200)));

        seedStock(testIngredientId, 50.0, 10.0);
        seedStock(testIngredient2Id, 50.0, 8.0);
    }

    // ---- GET list ----

    @Test
    void listOrders_withoutAuth_returns200() throws Exception {
        mockMvc.perform(get("/orders"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void listOrders_filteredByStatus_returnsPending() throws Exception {
        createOrder(testProductId, 1);

        mockMvc.perform(get("/orders").param("status", "PENDING"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].status").value("PENDING"));
    }

    // ---- GET by ID ----

    @Test
    void findOrder_withValidId_returns200WithItems() throws Exception {
        String orderId = createOrder(testProductId, 2);

        mockMvc.perform(get("/orders/" + orderId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(orderId))
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.totalPrice").value(91.80))
                .andExpect(jsonPath("$.data.items").isArray())
                .andExpect(jsonPath("$.data.items[0].productId").value(testProductId))
                .andExpect(jsonPath("$.data.items[0].quantity").value(2))
                .andExpect(jsonPath("$.data.items[0].unitPrice").value(45.90))
                .andExpect(jsonPath("$.data.items[0].subtotal").value(91.80));
    }

    @Test
    void findOrder_withInvalidId_returns404() throws Exception {
        mockMvc.perform(get("/orders/" + UUID.randomUUID()))
                .andExpect(status().isNotFound());
    }

    // ---- POST create ----

    @Test
    void createOrder_asOwner_returns201WithPendingStatus() throws Exception {
        String body = buildOrderBody(List.of(
                Map.of("productId", testProductId, "quantity", 1),
                Map.of("productId", testProduct2Id, "quantity", 2)));

        mockMvc.perform(post("/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.totalPrice").value(117.70))
                .andExpect(jsonPath("$.data.items.length()").value(2));
    }

    @Test
    void createOrder_withoutAuth_returns401() throws Exception {
        String body = buildOrderBody(List.of(
                Map.of("productId", testProductId, "quantity", 1)));

        mockMvc.perform(post("/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void createOrder_withEmptyItems_returns400() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "unitId", MATRIZ_ID.toString(),
                "items", List.of()));

        mockMvc.perform(post("/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createOrder_withDuplicateProduct_returns400() throws Exception {
        String body = buildOrderBody(List.of(
                Map.of("productId", testProductId, "quantity", 1),
                Map.of("productId", testProductId, "quantity", 2)));

        mockMvc.perform(post("/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createOrder_withInactiveProduct_returns400() throws Exception {
        mockMvc.perform(delete("/products/" + testProduct2Id)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());

        String body = buildOrderBody(List.of(
                Map.of("productId", testProduct2Id, "quantity", 1)));

        mockMvc.perform(post("/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    // ---- PUT update ----

    @Test
    void updateOrder_pending_replacesItems() throws Exception {
        String orderId = createOrder(testProductId, 1);

        String updateBody = buildOrderBody(List.of(
                Map.of("productId", testProduct2Id, "quantity", 3)));

        mockMvc.perform(put("/orders/" + orderId)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalPrice").value(107.70))
                .andExpect(jsonPath("$.data.items[0].productId").value(testProduct2Id))
                .andExpect(jsonPath("$.data.items[0].quantity").value(3));
    }

    @Test
    void updateOrder_notPending_returns400() throws Exception {
        String orderId = createOrder(testProductId, 1);
        startOrder(orderId);

        String updateBody = buildOrderBody(List.of(
                Map.of("productId", testProduct2Id, "quantity", 1)));

        mockMvc.perform(put("/orders/" + orderId)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody))
                .andExpect(status().isBadRequest());
    }

    // ---- POST start ----

    @Test
    void startOrder_pending_returns200AndSetsInProgress() throws Exception {
        String orderId = createOrder(testProductId, 2);

        mockMvc.perform(post("/orders/" + orderId + "/start")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.data.startedAt").isNotEmpty());
    }

    @Test
    void startOrder_createsExitMovements() throws Exception {
        String orderId = createOrder(testProductId, 2);
        startOrder(orderId);

        mockMvc.perform(get("/stock-movements")
                        .param("ingredient", testIngredientId)
                        .param("type", "EXIT"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].type").value("EXIT"))
                .andExpect(jsonPath("$.data[0].quantity").value(0.600));
    }

    @Test
    void startOrder_deductsStock() throws Exception {
        String orderId = createOrder(testProductId, 2);
        startOrder(orderId);

        mockMvc.perform(get("/stock").param("ingredient", testIngredientId))
                .andExpect(jsonPath("$.data[0].quantity").value(49.4));
    }

    @Test
    void startOrder_notPending_returns400() throws Exception {
        String orderId = createOrder(testProductId, 1);
        startOrder(orderId);

        mockMvc.perform(post("/orders/" + orderId + "/start")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void startOrder_canceledOrder_returns400() throws Exception {
        String orderId = createOrder(testProductId, 1);
        cancelOrder(orderId);

        mockMvc.perform(post("/orders/" + orderId + "/start")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void startOrder_withoutAuth_returns401() throws Exception {
        String orderId = createOrder(testProductId, 1);

        mockMvc.perform(post("/orders/" + orderId + "/start"))
                .andExpect(status().isUnauthorized());
    }

    // ---- POST complete ----

    @Test
    void completeOrder_inProgress_returns200() throws Exception {
        String orderId = createOrder(testProductId, 1);
        startOrder(orderId);

        mockMvc.perform(post("/orders/" + orderId + "/complete")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.completedAt").isNotEmpty());
    }

    @Test
    void completeOrder_pending_returns400() throws Exception {
        String orderId = createOrder(testProductId, 1);

        mockMvc.perform(post("/orders/" + orderId + "/complete")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void completeOrder_canceled_returns400() throws Exception {
        String orderId = createOrder(testProductId, 1);
        cancelOrder(orderId);

        mockMvc.perform(post("/orders/" + orderId + "/complete")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // ---- POST cancel ----

    @Test
    void cancelOrder_pending_returns200() throws Exception {
        String orderId = createOrder(testProductId, 1);

        mockMvc.perform(post("/orders/" + orderId + "/cancel")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CANCELED"))
                .andExpect(jsonPath("$.data.canceledAt").isNotEmpty());
    }

    @Test
    void cancelOrder_inProgress_returns400() throws Exception {
        String orderId = createOrder(testProductId, 1);
        startOrder(orderId);

        mockMvc.perform(post("/orders/" + orderId + "/cancel")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void cancelOrder_withoutAuth_returns401() throws Exception {
        String orderId = createOrder(testProductId, 1);

        mockMvc.perform(post("/orders/" + orderId + "/cancel"))
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
        String supplierId = createTestSupplier("Test Supplier Ord " + ingredientId.substring(0, 8));
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

    private String createOrder(String productId, int quantity) throws Exception {
        String body = buildOrderBody(List.of(
                Map.of("productId", productId, "quantity", quantity)));
        String resp = mockMvc.perform(post("/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(resp).path("data").path("id").asText();
    }

    private void startOrder(String orderId) throws Exception {
        mockMvc.perform(post("/orders/" + orderId + "/start")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    private void cancelOrder(String orderId) throws Exception {
        mockMvc.perform(post("/orders/" + orderId + "/cancel")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    private String buildOrderBody(List<Map<String, Object>> items) throws Exception {
        return objectMapper.writeValueAsString(Map.of(
                "unitId", MATRIZ_ID.toString(),
                "notes", "Test order",
                "items", items));
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
