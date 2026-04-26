package br.com.easy_inventory.management.purchase;

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
class PurchaseOrderControllerTest {

    static final UUID MATRIZ_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;

    private String adminToken;
    private String testSupplierId;
    private String testIngredientId;
    private String testIngredient2Id;

    @BeforeEach
    void setUp() throws Exception {
        cleanupTestData();
        adminToken = loginAsAdmin();
        testSupplierId = createTestSupplier("Test Supplier PO");
        testIngredientId = createTestIngredient("Test Flour");
        testIngredient2Id = createTestIngredient("Test Oil");
    }

    // ---- GET list ----

    @Test
    void listPurchaseOrders_withoutAuth_returns200() throws Exception {
        mockMvc.perform(get("/purchase-orders"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void listPurchaseOrders_filteredByStatus_returnsPending() throws Exception {
        createPO(testSupplierId, testIngredientId, 10.0, 5.0);

        mockMvc.perform(get("/purchase-orders").param("status", "PENDING"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].status").value("PENDING"));
    }

    // ---- GET by ID ----

    @Test
    void findPurchaseOrder_withValidId_returns200WithItems() throws Exception {
        String poId = createPO(testSupplierId, testIngredientId, 10.0, 5.0);

        mockMvc.perform(get("/purchase-orders/" + poId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(poId))
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.items").isArray())
                .andExpect(jsonPath("$.data.items[0].ingredientId").value(testIngredientId));
    }

    @Test
    void findPurchaseOrder_withInvalidId_returns404() throws Exception {
        mockMvc.perform(get("/purchase-orders/" + UUID.randomUUID()))
                .andExpect(status().isNotFound());
    }

    // ---- POST create ----

    @Test
    void createPurchaseOrder_asOwner_returns201WithPendingStatus() throws Exception {
        String body = buildPOBody(testSupplierId, List.of(
                Map.of("ingredientId", testIngredientId, "quantity", 20.0, "unitPrice", 3.50)));

        mockMvc.perform(post("/purchase-orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.supplierId").value(testSupplierId))
                .andExpect(jsonPath("$.data.totalCost").value(70.0));
    }

    @Test
    void createPurchaseOrder_withoutAuth_returns401() throws Exception {
        String body = buildPOBody(testSupplierId, List.of(
                Map.of("ingredientId", testIngredientId, "quantity", 5.0, "unitPrice", 2.0)));

        mockMvc.perform(post("/purchase-orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void createPurchaseOrder_withEmptyItems_returns400() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "supplierId", testSupplierId,
                "unitId", MATRIZ_ID.toString(),
                "items", List.of()));

        mockMvc.perform(post("/purchase-orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createPurchaseOrder_withDuplicateIngredient_returns400() throws Exception {
        String body = buildPOBody(testSupplierId, List.of(
                Map.of("ingredientId", testIngredientId, "quantity", 5.0, "unitPrice", 2.0),
                Map.of("ingredientId", testIngredientId, "quantity", 3.0, "unitPrice", 2.0)));

        mockMvc.perform(post("/purchase-orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    // ---- PUT update ----

    @Test
    void updatePurchaseOrder_PENDING_returns200() throws Exception {
        String poId = createPO(testSupplierId, testIngredientId, 5.0, 2.0);

        String updateBody = objectMapper.writeValueAsString(Map.of(
                "supplierId", testSupplierId,
                "unitId", MATRIZ_ID.toString(),
                "notes", "Test updated notes",
                "items", List.of(
                        Map.of("ingredientId", testIngredient2Id, "quantity", 8.0, "unitPrice", 4.0))));

        mockMvc.perform(put("/purchase-orders/" + poId)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].ingredientId").value(testIngredient2Id))
                .andExpect(jsonPath("$.data.notes").value("Test updated notes"));
    }

    @Test
    void updatePurchaseOrder_notPending_returns400() throws Exception {
        String poId = createPO(testSupplierId, testIngredientId, 5.0, 2.0);
        cancelPO(poId);

        String updateBody = objectMapper.writeValueAsString(Map.of(
                "supplierId", testSupplierId,
                "unitId", MATRIZ_ID.toString(),
                "items", List.of(
                        Map.of("ingredientId", testIngredientId, "quantity", 3.0, "unitPrice", 1.0))));

        mockMvc.perform(put("/purchase-orders/" + poId)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody))
                .andExpect(status().isBadRequest());
    }

    // ---- POST receive ----

    @Test
    void receivePurchaseOrder_PENDING_returns200AndCreatesStockEntry() throws Exception {
        String poId = createPO(testSupplierId, testIngredientId, 15.0, 12.0);

        mockMvc.perform(post("/purchase-orders/" + poId + "/receive")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("RECEIVED"))
                .andExpect(jsonPath("$.data.receivedAt").isNotEmpty());

        mockMvc.perform(get("/stock").param("ingredient", testIngredientId))
                .andExpect(jsonPath("$.data[0].quantity").value(15.0))
                .andExpect(jsonPath("$.data[0].averageCost").value(12.0));
    }

    @Test
    void receivePurchaseOrder_recalculatesWeightedAverageCost() throws Exception {
        // First receive: 10 units @ $10 → avg = 10
        String po1Id = createPO(testSupplierId, testIngredient2Id, 10.0, 10.0);
        mockMvc.perform(post("/purchase-orders/" + po1Id + "/receive")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        // Second receive: 10 units @ $20 → avg = (10*10 + 10*20) / 20 = 15
        String po2Id = createPO(testSupplierId, testIngredient2Id, 10.0, 20.0);
        mockMvc.perform(post("/purchase-orders/" + po2Id + "/receive")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/stock").param("ingredient", testIngredient2Id))
                .andExpect(jsonPath("$.data[0].quantity").value(20.0))
                .andExpect(jsonPath("$.data[0].averageCost").value(15.0));
    }

    @Test
    void receivePurchaseOrder_notPending_returns400() throws Exception {
        String poId = createPO(testSupplierId, testIngredientId, 5.0, 3.0);
        cancelPO(poId);

        mockMvc.perform(post("/purchase-orders/" + poId + "/receive")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // ---- POST cancel ----

    @Test
    void cancelPurchaseOrder_PENDING_returns200() throws Exception {
        String poId = createPO(testSupplierId, testIngredientId, 5.0, 3.0);

        mockMvc.perform(post("/purchase-orders/" + poId + "/cancel")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CANCELED"))
                .andExpect(jsonPath("$.data.canceledAt").isNotEmpty());
    }

    @Test
    void cancelPurchaseOrder_alreadyReceived_returns400() throws Exception {
        String poId = createPO(testSupplierId, testIngredientId, 5.0, 3.0);
        mockMvc.perform(post("/purchase-orders/" + poId + "/receive")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(post("/purchase-orders/" + poId + "/cancel")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void cancelPurchaseOrder_withoutAuth_returns401() throws Exception {
        String poId = createPO(testSupplierId, testIngredientId, 5.0, 3.0);

        mockMvc.perform(post("/purchase-orders/" + poId + "/cancel"))
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

    private String createTestSupplier(String name) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of("name", name));
        String resp = mockMvc.perform(post("/suppliers")
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

    private String createPO(String supplierId, String ingredientId,
                              double qty, double unitPrice) throws Exception {
        String body = buildPOBody(supplierId, List.of(
                Map.of("ingredientId", ingredientId, "quantity", qty, "unitPrice", unitPrice)));
        String resp = mockMvc.perform(post("/purchase-orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(resp).path("data").path("id").asText();
    }

    private void cancelPO(String poId) throws Exception {
        mockMvc.perform(post("/purchase-orders/" + poId + "/cancel")
                .header("Authorization", "Bearer " + adminToken));
    }

    private String buildPOBody(String supplierId, List<Map<String, Object>> items) throws Exception {
        return objectMapper.writeValueAsString(Map.of(
                "supplierId", supplierId,
                "unitId", MATRIZ_ID.toString(),
                "notes", "Test PO",
                "items", items));
    }

    private void cleanupTestData() {
        jdbc.update("DELETE FROM stock_movements WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE supplier_id IN (SELECT id FROM suppliers WHERE name LIKE 'Test%'))");
        jdbc.update("DELETE FROM stock_movements WHERE ingredient_id IN (SELECT id FROM ingredients WHERE name LIKE 'Test%')");
        jdbc.update("DELETE FROM purchase_orders WHERE supplier_id IN (SELECT id FROM suppliers WHERE name LIKE 'Test%')");
        jdbc.update("DELETE FROM stock WHERE ingredient_id IN (SELECT id FROM ingredients WHERE name LIKE 'Test%')");
        jdbc.update("DELETE FROM ingredients WHERE name LIKE 'Test%'");
        jdbc.update("DELETE FROM suppliers WHERE name LIKE 'Test%'");
    }
}
