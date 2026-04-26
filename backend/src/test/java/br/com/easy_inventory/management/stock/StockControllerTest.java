package br.com.easy_inventory.management.stock;

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

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class StockControllerTest {

    static final UUID MATRIZ_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;

    private String adminToken;

    @BeforeEach
    void setUp() throws Exception {
        cleanupTestData();
        adminToken = loginAsAdmin();
    }

    @Test
    void listStock_withoutAuth_returns200() throws Exception {
        mockMvc.perform(get("/stock"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void findStockById_withValidId_returns200() throws Exception {
        String supplierId = createTestSupplier("Test Supplier Stock");
        String ingredientId = createTestIngredient("Test Mozzarella", 5.0);
        String stockId = createStockViaReceive(supplierId, ingredientId, 10.0, 20.0);

        mockMvc.perform(get("/stock/" + stockId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(stockId))
                .andExpect(jsonPath("$.data.ingredientName").value("Test Mozzarella"))
                .andExpect(jsonPath("$.data.quantity").value(10.0));
    }

    @Test
    void findStockById_withInvalidId_returns404() throws Exception {
        mockMvc.perform(get("/stock/" + UUID.randomUUID()))
                .andExpect(status().isNotFound());
    }

    @Test
    void listStock_withIngredientFilter_returnsFiltered() throws Exception {
        String supplierId = createTestSupplier("Test Supplier Stock2");
        String ingredientId = createTestIngredient("Test Ham", 2.0);
        createStockViaReceive(supplierId, ingredientId, 8.0, 15.0);

        mockMvc.perform(get("/stock").param("ingredient", ingredientId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].ingredientId").value(ingredientId));
    }

    @Test
    void listLowStock_returnsStockBelowMinimum() throws Exception {
        // minimumQty=10, we receive only 3 → below minimum
        String supplierId = createTestSupplier("Test Supplier Low");
        String ingredientId = createTestIngredient("Test Tomato", 10.0);
        createStockViaReceive(supplierId, ingredientId, 3.0, 5.0);

        mockMvc.perform(get("/stock/low"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].ingredientId", hasItem(ingredientId)));
    }

    @Test
    void listLowStock_excludesStockAboveMinimum() throws Exception {
        // minimumQty=5, we receive 10 → not below minimum
        String supplierId = createTestSupplier("Test Supplier AboveMin");
        String ingredientId = createTestIngredient("Test Basil", 5.0);
        createStockViaReceive(supplierId, ingredientId, 10.0, 8.0);

        mockMvc.perform(get("/stock/low"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].ingredientId", not(hasItem(ingredientId))));
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

    private String createStockViaReceive(String supplierId, String ingredientId,
                                          double qty, double unitPrice) throws Exception {
        String poBody = objectMapper.writeValueAsString(Map.of(
                "supplierId", supplierId,
                "unitId", MATRIZ_ID.toString(),
                "notes", "Test stock setup",
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

        String stockResp = mockMvc.perform(get("/stock").param("ingredient", ingredientId))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(stockResp).path("data").get(0).path("id").asText();
    }

    private void cleanupTestData() {
        // Delete by PO first to handle movements created by receive workflows
        jdbc.update("DELETE FROM stock_movements WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE supplier_id IN (SELECT id FROM suppliers WHERE name LIKE 'Test%'))");
        // Delete standalone movements (adjustments/exits with no PO)
        jdbc.update("DELETE FROM stock_movements WHERE ingredient_id IN (SELECT id FROM ingredients WHERE name LIKE 'Test%')");
        jdbc.update("DELETE FROM purchase_orders WHERE supplier_id IN (SELECT id FROM suppliers WHERE name LIKE 'Test%')");
        jdbc.update("DELETE FROM stock WHERE ingredient_id IN (SELECT id FROM ingredients WHERE name LIKE 'Test%')");
        jdbc.update("DELETE FROM ingredients WHERE name LIKE 'Test%'");
        jdbc.update("DELETE FROM suppliers WHERE name LIKE 'Test%'");
    }
}
