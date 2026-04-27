package br.com.easy_inventory.management.notification;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class NotificationControllerTest {

    static final UUID MATRIZ_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;

    private String adminToken;
    private UUID ingredientId;
    private UUID notificationId;

    @BeforeEach
    void setUp() throws Exception {
        cleanup();
        adminToken = loginAs("admin@pizzaria.com", "admin123");
        ingredientId = createIngredient("Test Notif HTTP Ing");
        notificationId = insertActiveNotificationDirectly(ingredientId, MATRIZ_ID);
    }

    @AfterEach
    void tearDown() { cleanup(); }

    // ---- Tests ----

    @Test
    void list_returnsActiveNotifications_filteredByStatus() throws Exception {
        // ACTIVE filter should include our notification
        mockMvc.perform(get("/notifications")
                        .param("status", "ACTIVE")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.id == '" + notificationId + "')]").exists())
                .andExpect(jsonPath("$.data[?(@.id == '" + notificationId + "')].status").value("ACTIVE"));

        // RESOLVED filter should NOT include our ACTIVE notification
        String resolvedResp = mockMvc.perform(get("/notifications")
                        .param("status", "RESOLVED")
                        .header("Authorization", "Bearer " + adminToken))
                .andReturn().getResponse().getContentAsString();
        com.fasterxml.jackson.databind.JsonNode data = objectMapper.readTree(resolvedResp).path("data");
        for (com.fasterxml.jackson.databind.JsonNode node : data) {
            org.assertj.core.api.Assertions.assertThat(node.path("id").asText())
                    .isNotEqualTo(notificationId.toString());
        }
    }

    @Test
    void findById_returnsNotificationDetails() throws Exception {
        mockMvc.perform(get("/notifications/" + notificationId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(notificationId.toString()))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.ingredientId").value(ingredientId.toString()));
    }

    @Test
    void findById_unknown_returns404() throws Exception {
        mockMvc.perform(get("/notifications/" + UUID.randomUUID())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void resolve_asAdmin_returnsResolvedWithActor() throws Exception {
        String adminUserId = "00000000-0000-0000-0000-000000000001";

        mockMvc.perform(post("/notifications/" + notificationId + "/resolve")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("RESOLVED"))
                .andExpect(jsonPath("$.data.resolvedBy").value(adminUserId));
    }

    @Test
    void resolve_alreadyResolved_returns400() throws Exception {
        // First resolve
        mockMvc.perform(post("/notifications/" + notificationId + "/resolve")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        // Second resolve on already-resolved notification => 400
        mockMvc.perform(post("/notifications/" + notificationId + "/resolve")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void resolve_withoutOwnerRole_returns403() throws Exception {
        // Create an EMPLOYEE user with a unique email so cleanup catches it
        String employeeEmail = "notif-emp-" + UUID.randomUUID() + "@test";
        String createBody = objectMapper.writeValueAsString(Map.of(
                "name", "Test Notif Employee",
                "email", employeeEmail,
                "password", "pass1234",
                "role", "EMPLOYEE"));

        mockMvc.perform(post("/users")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(status().isCreated());

        String employeeToken = loginAs(employeeEmail, "pass1234");

        mockMvc.perform(post("/notifications/" + notificationId + "/resolve")
                        .header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isForbidden());
    }

    // ---- Helpers ----

    private String loginAs(String email, String password) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of("email", email, "password", password));
        String resp = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(resp).path("data").path("accessToken").asText();
    }

    private UUID createIngredient(String name) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "name", name,
                "unitOfMeasure", "kg",
                "minimumQty", 5.0));
        String resp = mockMvc.perform(post("/ingredients")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(objectMapper.readTree(resp).path("data").path("id").asText());
    }

    private UUID insertActiveNotificationDirectly(UUID ing, UUID unit) {
        UUID id = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO notifications (id, type, status, ingredient_id, unit_id, message, triggered_quantity, min_quantity, created_at) " +
                "VALUES (?, 'LOW_STOCK', 'ACTIVE', ?, ?, ?, 2.000, 5.000, NOW())",
                id, ing, unit, "Test Notif HTTP Ing abaixo do mínimo na unidade Matriz: 2 kg ≤ 5 kg");
        return id;
    }

    private void cleanup() {
        jdbc.update("DELETE FROM audit_logs WHERE entity_type = 'User' AND entity_id IN (SELECT id FROM users WHERE email LIKE 'notif-emp-%@test')");
        jdbc.update("DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'notif-emp-%@test')");
        jdbc.update("DELETE FROM users WHERE email LIKE 'notif-emp-%@test'");
        jdbc.update("DELETE FROM notifications WHERE message LIKE 'Test Notif HTTP%' OR ingredient_id IN (SELECT id FROM ingredients WHERE name LIKE 'Test Notif HTTP%')");
        jdbc.update("DELETE FROM stock_movements WHERE ingredient_id IN (SELECT id FROM ingredients WHERE name LIKE 'Test Notif HTTP%')");
        jdbc.update("DELETE FROM stock WHERE ingredient_id IN (SELECT id FROM ingredients WHERE name LIKE 'Test Notif HTTP%')");
        jdbc.update("DELETE FROM ingredients WHERE name LIKE 'Test Notif HTTP%'");
    }
}
