package br.com.easy_inventory.management.movement;

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
class MovementControllerTest {

    static final UUID MATRIZ_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;

    private String adminToken;
    private String testSupplierId;
    private String testIngredientId;

    @BeforeEach
    void setUp() throws Exception {
        cleanupTestData();
        adminToken = loginAsAdmin();
        testSupplierId = createTestSupplier("Test Supplier Mvt");
        testIngredientId = createTestIngredient("Test Cheese", 2.0);
        createAndReceivePO(testSupplierId, testIngredientId, 20.0, 10.0);
    }

    // ---- GET list ----

    @Test
    void listMovements_withoutAuth_returns200() throws Exception {
        mockMvc.perform(get("/stock-movements"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void listMovements_filteredByIngredient_returnsMatching() throws Exception {
        mockMvc.perform(get("/stock-movements").param("ingredient", testIngredientId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].ingredientId").value(testIngredientId));
    }

    @Test
    void listMovements_filteredByType_returnsOnlyEntry() throws Exception {
        mockMvc.perform(get("/stock-movements")
                        .param("ingredient", testIngredientId)
                        .param("type", "ENTRY"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].type").value("ENTRY"));
    }

    // ---- GET by ID ----

    @Test
    void findMovement_withValidId_returns200() throws Exception {
        String resp = mockMvc.perform(get("/stock-movements")
                        .param("ingredient", testIngredientId))
                .andReturn().getResponse().getContentAsString();
        String mvId = objectMapper.readTree(resp).path("data").get(0).path("id").asText();

        mockMvc.perform(get("/stock-movements/" + mvId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(mvId));
    }

    @Test
    void findMovement_withInvalidId_returns404() throws Exception {
        mockMvc.perform(get("/stock-movements/" + UUID.randomUUID()))
                .andExpect(status().isNotFound());
    }

    // ---- POST adjustment ----

    @Test
    void createAdjustmentIncrease_returns201AndUpdatesStock() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "ingredientId", testIngredientId,
                "unitId", MATRIZ_ID.toString(),
                "quantity", 5.0,
                "direction", "INCREASE",
                "reason", "Test manual correction"));

        mockMvc.perform(post("/stock-movements")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.type").value("ADJUSTMENT"))
                .andExpect(jsonPath("$.data.quantity").value(5.0));

        mockMvc.perform(get("/stock").param("ingredient", testIngredientId))
                .andExpect(jsonPath("$.data[0].quantity").value(25.0));
    }

    @Test
    void createAdjustmentDecrease_returns201AndDecreasesStock() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "ingredientId", testIngredientId,
                "unitId", MATRIZ_ID.toString(),
                "quantity", 3.0,
                "direction", "DECREASE",
                "reason", "Test waste correction"));

        mockMvc.perform(post("/stock-movements")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.type").value("ADJUSTMENT"));

        mockMvc.perform(get("/stock").param("ingredient", testIngredientId))
                .andExpect(jsonPath("$.data[0].quantity").value(17.0));
    }

    @Test
    void createAdjustment_withoutAuth_returns401() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "ingredientId", testIngredientId,
                "unitId", MATRIZ_ID.toString(),
                "quantity", 1.0,
                "direction", "INCREASE",
                "reason", "Test unauthorized"));

        mockMvc.perform(post("/stock-movements")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void createAdjustment_withBlankReason_returns400() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "ingredientId", testIngredientId,
                "unitId", MATRIZ_ID.toString(),
                "quantity", 1.0,
                "direction", "INCREASE",
                "reason", ""));

        mockMvc.perform(post("/stock-movements")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createAdjustmentDecrease_belowZero_returns400() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "ingredientId", testIngredientId,
                "unitId", MATRIZ_ID.toString(),
                "quantity", 50.0,
                "direction", "DECREASE",
                "reason", "Test overdraw"));

        mockMvc.perform(post("/stock-movements")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
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

    private String createTestIngredient(String name, double minimumQty) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "name", name,
                "unitOfMeasure", "kg",
                "minimumQty", minimumQty));
        String resp = mockMvc.perform(post("/ingredients")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(resp).path("data").path("id").asText();
    }

    private void createAndReceivePO(String supplierId, String ingredientId,
                                     double qty, double unitPrice) throws Exception {
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

    private void cleanupTestData() {
        jdbc.update("DELETE FROM stock_movements WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE supplier_id IN (SELECT id FROM suppliers WHERE name LIKE 'Test%'))");
        jdbc.update("DELETE FROM stock_movements WHERE ingredient_id IN (SELECT id FROM ingredients WHERE name LIKE 'Test%')");
        jdbc.update("DELETE FROM purchase_orders WHERE supplier_id IN (SELECT id FROM suppliers WHERE name LIKE 'Test%')");
        jdbc.update("DELETE FROM stock WHERE ingredient_id IN (SELECT id FROM ingredients WHERE name LIKE 'Test%')");
        jdbc.update("DELETE FROM ingredients WHERE name LIKE 'Test%'");
        jdbc.update("DELETE FROM suppliers WHERE name LIKE 'Test%'");
    }
}
