package br.com.easy_inventory.management.ingredient;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class IngredientControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;

    private String adminToken;

    @BeforeEach
    void setUp() throws Exception {
        cleanupTestData();

        String loginBody = objectMapper.writeValueAsString(
                Map.of("email", "admin@pizzaria.com", "password", "admin123"));
        String response = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody))
                .andReturn().getResponse().getContentAsString();
        adminToken = objectMapper.readTree(response).path("data").path("accessToken").asText();
    }

    @Test
    void createIngredient_asOwner_returns201() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "name", "Test Farinha de Trigo",
                "unitOfMeasure", "kg",
                "minimumQty", 10.0));

        mockMvc.perform(post("/ingredients")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.name").value("Test Farinha de Trigo"))
                .andExpect(jsonPath("$.data.unitOfMeasure").value("kg"))
                .andExpect(jsonPath("$.data.active").value(true));
    }

    @Test
    void listIngredients_withoutAuth_returns200() throws Exception {
        mockMvc.perform(get("/ingredients"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void createIngredient_missingRequiredFields_returns400() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of("name", "Test Incomplete"));

        mockMvc.perform(post("/ingredients")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void filterIngredients_byActive_returnsFiltered() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "name", "Test Active Ingredient",
                "unitOfMeasure", "un",
                "minimumQty", 5.0));
        mockMvc.perform(post("/ingredients")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/ingredients?active=true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    private void cleanupTestData() {
        jdbc.update("DELETE FROM stock_movements WHERE ingredient_id IN (SELECT id FROM ingredients WHERE name LIKE 'Test%')");
        jdbc.update("DELETE FROM stock WHERE ingredient_id IN (SELECT id FROM ingredients WHERE name LIKE 'Test%')");
        jdbc.update("DELETE FROM purchase_orders WHERE supplier_id IN (SELECT id FROM suppliers WHERE name LIKE 'Test%')");
        jdbc.update("DELETE FROM ingredients WHERE name LIKE 'Test%'");
        jdbc.update("UPDATE ingredients SET category_id = NULL WHERE category_id IN (SELECT id FROM categories WHERE name LIKE 'Test%')");
        jdbc.update("DELETE FROM categories WHERE name LIKE 'Test%'");
        jdbc.update("DELETE FROM suppliers WHERE name LIKE 'Test%'");
    }
}
