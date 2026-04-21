package br.com.easy_inventory.management.unit;

import br.com.easy_inventory.management.auth.repository.RefreshTokenRepository;
import br.com.easy_inventory.management.unit.repository.UnitRepository;
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
class UnitControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UnitRepository unitRepository;
    @Autowired RefreshTokenRepository refreshTokenRepository;

    private String adminToken;

    @BeforeEach
    void setUp() throws Exception {
        refreshTokenRepository.deleteAll();
        unitRepository.findAll().stream()
                .filter(u -> u.getName().startsWith("Test"))
                .forEach(unitRepository::delete);

        String loginBody = objectMapper.writeValueAsString(
                Map.of("email", "admin@pizzaria.com", "password", "admin123"));
        String response = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody))
                .andReturn().getResponse().getContentAsString();
        adminToken = objectMapper.readTree(response).path("data").path("accessToken").asText();
    }

    @Test
    void listUnits_withoutAuth_returns200() throws Exception {
        mockMvc.perform(get("/units"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void createUnit_asOwner_returns201() throws Exception {
        String body = objectMapper.writeValueAsString(
                Map.of("name", "Test Filial Norte", "address", "Rua A, 123"));

        mockMvc.perform(post("/units")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.name").value("Test Filial Norte"));
    }

    @Test
    void createUnit_withoutAuth_returns401() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of("name", "Test Filial"));

        mockMvc.perform(post("/units")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deactivateUnit_asOwner_returns204() throws Exception {
        String createBody = objectMapper.writeValueAsString(Map.of("name", "Test Temp Unit"));
        String created = mockMvc.perform(post("/units")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andReturn().getResponse().getContentAsString();
        String unitId = objectMapper.readTree(created).path("data").path("id").asText();

        mockMvc.perform(delete("/units/" + unitId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/units/" + unitId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.active").value(false));
    }
}
