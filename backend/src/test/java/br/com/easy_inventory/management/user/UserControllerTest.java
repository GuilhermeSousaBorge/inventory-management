package br.com.easy_inventory.management.user;

import br.com.easy_inventory.management.auth.repository.RefreshTokenRepository;
import br.com.easy_inventory.management.user.repository.UserRepository;
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
class UserControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;
    @Autowired RefreshTokenRepository refreshTokenRepository;

    private String adminToken;

    @BeforeEach
    void setUp() throws Exception {
        refreshTokenRepository.deleteAll();
        userRepository.findAll().stream()
                .filter(u -> !u.getEmail().equals("admin@pizzaria.com"))
                .forEach(u -> userRepository.delete(u));

        String loginBody = objectMapper.writeValueAsString(
                Map.of("email", "admin@pizzaria.com", "password", "admin123"));
        String response = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody))
                .andReturn().getResponse().getContentAsString();
        adminToken = objectMapper.readTree(response).path("data").path("accessToken").asText();
    }

    @Test
    void getMe_returnsCurrentUser() throws Exception {
        mockMvc.perform(get("/users/me")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value("admin@pizzaria.com"))
                .andExpect(jsonPath("$.data.role").value("OWNER"));
    }

    @Test
    void listUsers_asOwner_returns200() throws Exception {
        mockMvc.perform(get("/users")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void createUser_asOwner_returns201() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "name", "Test Employee",
                "email", "employee@test.com",
                "password", "pass123",
                "role", "EMPLOYEE"));

        mockMvc.perform(post("/users")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.email").value("employee@test.com"))
                .andExpect(jsonPath("$.data.role").value("EMPLOYEE"));
    }

    @Test
    void createUser_withDuplicateEmail_returns400() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "name", "Dup", "email", "admin@pizzaria.com",
                "password", "pass123", "role", "EMPLOYEE"));

        mockMvc.perform(post("/users")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void listUsers_withoutAuth_returns401() throws Exception {
        mockMvc.perform(get("/users"))
                .andExpect(status().isUnauthorized());
    }
}
