package br.com.easy_inventory.management.supplier;

import br.com.easy_inventory.management.auth.repository.RefreshTokenRepository;
import br.com.easy_inventory.management.supplier.repository.SupplierRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class SupplierControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired SupplierRepository supplierRepository;
    @Autowired RefreshTokenRepository refreshTokenRepository;

    private String adminToken;

    @BeforeEach
    void setUp() throws Exception {
        refreshTokenRepository.deleteAll();
        supplierRepository.findAll().stream()
                .filter(s -> s.getName().startsWith("Test"))
                .forEach(supplierRepository::delete);

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
