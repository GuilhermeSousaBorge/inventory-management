package br.com.easy_inventory.management.supplier;

import br.com.easy_inventory.management.auth.repository.RefreshTokenRepository;
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
class SupplierControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired RefreshTokenRepository refreshTokenRepository;
    @Autowired JdbcTemplate jdbc;

    private String adminToken;

    @BeforeEach
    void setUp() throws Exception {
        refreshTokenRepository.deleteAll();
        // Clear rows that reference Test suppliers before deleting the suppliers
        // themselves — other test classes (e.g. PurchaseOrderControllerTest) may
        // leave purchase_orders pointing at a "Test%" supplier, and the FK
        // purchase_orders_supplier_id_fkey would otherwise block the delete.
        jdbc.update("DELETE FROM stock_movements WHERE purchase_order_id IN "
                + "(SELECT id FROM purchase_orders WHERE supplier_id IN "
                + "(SELECT id FROM suppliers WHERE name LIKE 'Test%'))");
        jdbc.update("DELETE FROM purchase_orders WHERE supplier_id IN "
                + "(SELECT id FROM suppliers WHERE name LIKE 'Test%')");
        jdbc.update("DELETE FROM suppliers WHERE name LIKE 'Test%'");

        String loginBody = objectMapper.writeValueAsString(
                Map.of("email", "admin@pizzaria.com", "password", "admin123"));
        String response = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody))
                .andReturn().getResponse().getContentAsString();
        adminToken = objectMapper.readTree(response).path("data").path("accessToken").asText();
    }

    @Test
    void createSupplier_asOwner_returns201() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "name", "Test Distribuidora XYZ",
                "contactName", "João",
                "phone", "11999999999",
                "email", "joao@xyz.com",
                "address", "Av. B, 456"));

        mockMvc.perform(post("/suppliers")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.name").value("Test Distribuidora XYZ"))
                .andExpect(jsonPath("$.data.active").value(true));
    }

    @Test
    void listSuppliers_withoutAuth_returns200() throws Exception {
        mockMvc.perform(get("/suppliers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void deactivateSupplier_asOwner_returns204() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of("name", "Test Temp Supplier"));
        String created = mockMvc.perform(post("/suppliers")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andReturn().getResponse().getContentAsString();
        String supplierId = objectMapper.readTree(created).path("data").path("id").asText();

        mockMvc.perform(delete("/suppliers/" + supplierId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/suppliers/" + supplierId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.active").value(false));
    }
}
