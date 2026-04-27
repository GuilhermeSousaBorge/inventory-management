package br.com.easy_inventory.management.audit;

import br.com.easy_inventory.management.audit.entity.AuditAction;
import br.com.easy_inventory.management.ingredient.dto.CreateIngredientRequest;
import br.com.easy_inventory.management.ingredient.entity.Ingredient;
import br.com.easy_inventory.management.ingredient.entity.UnitOfMeasure;
import br.com.easy_inventory.management.ingredient.repository.IngredientRepository;
import br.com.easy_inventory.management.ingredient.service.IngredientService;
import br.com.easy_inventory.management.product.dto.CreateProductRequest;
import br.com.easy_inventory.management.product.dto.ProductIngredientRequest;
import br.com.easy_inventory.management.product.entity.ProductSize;
import br.com.easy_inventory.management.product.service.ProductService;
import br.com.easy_inventory.management.purchase.dto.CreatePurchaseOrderRequest;
import br.com.easy_inventory.management.purchase.dto.PurchaseOrderItemRequest;
import br.com.easy_inventory.management.purchase.service.PurchaseOrderService;
import br.com.easy_inventory.management.shared.exception.BusinessException;
import br.com.easy_inventory.management.stock.service.StockService;
import br.com.easy_inventory.management.supplier.entity.Supplier;
import br.com.easy_inventory.management.supplier.repository.SupplierRepository;
import br.com.easy_inventory.management.unit.dto.CreateUnitRequest;
import br.com.easy_inventory.management.unit.service.UnitService;
import br.com.easy_inventory.management.user.dto.CreateUserRequest;
import br.com.easy_inventory.management.user.entity.Role;
import br.com.easy_inventory.management.user.service.UserService;
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
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AuditLogIntegrationTest {

    static final UUID MATRIZ_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    static final UUID ADMIN_USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Autowired UserService userService;
    @Autowired IngredientService ingredientService;
    @Autowired UnitService unitService;
    @Autowired ProductService productService;
    @Autowired PurchaseOrderService purchaseOrderService;
    @Autowired StockService stockService;
    @Autowired IngredientRepository ingredientRepository;
    @Autowired SupplierRepository supplierRepository;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager txm;
    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @BeforeEach
    void setUp() { cleanup(); }

    @AfterEach
    void tearDown() { cleanup(); }

    // ---- Service-level: instrumented methods write audit rows ----

    @Test
    void userServiceCreate_writesUserCreatedAuditRow() {
        long before = countAudit("User", null, null);

        var resp = userService.create(
                new CreateUserRequest("Test Audit User",
                        "audit-" + UUID.randomUUID() + "@test", "pass1234", Role.EMPLOYEE),
                ADMIN_USER_ID);

        long after = countAudit("User", resp.id(), null);
        assertThat(after).isEqualTo(1L);
        assertThat(countAudit("User", resp.id(), AuditAction.USER_CREATED)).isEqualTo(1L);
        assertActor(resp.id(), "User", ADMIN_USER_ID);
        assertThat(countAudit("User", null, null)).isGreaterThan(before);
    }

    @Test
    void ingredientServiceCreate_writesIngredientCreatedAuditRow() {
        var resp = ingredientService.create(
                new CreateIngredientRequest("Test Audit Ingredient", "desc", null,
                        UnitOfMeasure.kg, new BigDecimal("5.000"), null, null),
                ADMIN_USER_ID);

        assertThat(countAudit("Ingredient", resp.id(), AuditAction.INGREDIENT_CREATED))
                .isEqualTo(1L);
        assertActor(resp.id(), "Ingredient", ADMIN_USER_ID);
    }

    @Test
    void unitServiceCreate_writesUnitCreatedAuditRow() {
        var resp = unitService.create(
                new CreateUnitRequest("Test Audit Unit", "addr"),
                ADMIN_USER_ID);

        assertThat(countAudit("Unit", resp.id(), AuditAction.UNIT_CREATED)).isEqualTo(1L);
        assertActor(resp.id(), "Unit", ADMIN_USER_ID);
    }

    @Test
    void productServiceCreate_writesProductCreatedAuditRow() {
        // Need an ingredient for the recipe
        var ing = ingredientService.create(
                new CreateIngredientRequest("Test Audit Ingredient",
                        null, null, UnitOfMeasure.kg, new BigDecimal("1.000"), null, null),
                ADMIN_USER_ID);

        var resp = productService.create(
                new CreateProductRequest("Test Audit Pizza", ProductSize.M, null,
                        new BigDecimal("39.90"), "desc",
                        List.of(new ProductIngredientRequest(ing.id(), new BigDecimal("0.500")))),
                ADMIN_USER_ID);

        assertThat(countAudit("Product", resp.id(), AuditAction.PRODUCT_CREATED))
                .isEqualTo(1L);
        assertActor(resp.id(), "Product", ADMIN_USER_ID);
    }

    @Test
    void purchaseOrderServiceCreate_writesPurchaseOrderCreatedAuditRow() {
        // Inline create supplier and ingredient
        UUID supplierId = createTestSupplier();
        var ing = ingredientService.create(
                new CreateIngredientRequest("Test Audit Ingredient",
                        null, null, UnitOfMeasure.kg, new BigDecimal("1.000"), null, null),
                ADMIN_USER_ID);

        var resp = purchaseOrderService.create(
                new CreatePurchaseOrderRequest(supplierId, MATRIZ_ID, "test notes", null,
                        List.of(new PurchaseOrderItemRequest(ing.id(),
                                new BigDecimal("10.000"), new BigDecimal("5.0000")))),
                ADMIN_USER_ID);

        assertThat(countAudit("PurchaseOrder", resp.id(), AuditAction.PURCHASE_ORDER_CREATED))
                .isEqualTo(1L);
        assertActor(resp.id(), "PurchaseOrder", ADMIN_USER_ID);
    }

    @Test
    void stockServiceApplyEntry_writesStockEntryAuditRow() {
        // Create ingredient
        UUID ingredientId = new TransactionTemplate(txm).execute(s -> {
            Ingredient ing = new Ingredient();
            ing.setName("Test Audit Ingredient Stock");
            ing.setUnitOfMeasure(UnitOfMeasure.kg);
            ing.setMinimumQty(new BigDecimal("5.000"));
            return ingredientRepository.save(ing).getId();
        });

        var movement = stockService.applyEntry(ingredientId, MATRIZ_ID,
                new BigDecimal("10.000"), new BigDecimal("5.0000"), null, ADMIN_USER_ID);

        Long count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM audit_logs WHERE entity_type = 'StockMovement' " +
                        "AND entity_id = ? AND action = 'STOCK_ENTRY'",
                Long.class, movement.getId());
        assertThat(count).isEqualTo(1L);
        assertActor(movement.getId(), "StockMovement", ADMIN_USER_ID);
    }

    // ---- Caller rollback rolls back audit row ----

    @Test
    void userServiceCreate_failingDueToDuplicateEmail_rollsBackAuditRow() {
        String email = "audit-" + UUID.randomUUID() + "@test";

        // First create succeeds
        userService.create(
                new CreateUserRequest("Test Audit User One", email, "pass1234", Role.EMPLOYEE),
                ADMIN_USER_ID);

        long before = countAudit("User", null, null);

        // Second create with same email throws BusinessException
        assertThatThrownBy(() -> userService.create(
                new CreateUserRequest("Test Audit User Two", email, "pass1234", Role.EMPLOYEE),
                ADMIN_USER_ID))
                .isInstanceOf(BusinessException.class);

        long after = countAudit("User", null, null);
        assertThat(after)
                .as("no orphan audit row should be left from failed create")
                .isEqualTo(before);
    }

    // ---- HTTP filter tests ----

    @Test
    void httpListEndpoint_filtersByEntityType() throws Exception {
        seedAuditRows();
        String token = loginAsAdmin();

        mockMvc.perform(get("/audit-logs")
                        .param("entityType", "Ingredient")
                        .param("size", "100")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.entityType != 'Ingredient')]").doesNotExist())
                .andExpect(jsonPath("$.data[?(@.entityType == 'Ingredient')]").exists());
    }

    @Test
    void httpListEndpoint_filtersByAction() throws Exception {
        seedAuditRows();
        String token = loginAsAdmin();

        mockMvc.perform(get("/audit-logs")
                        .param("action", "USER_CREATED")
                        .param("size", "100")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.action != 'USER_CREATED')]").doesNotExist())
                .andExpect(jsonPath("$.data[?(@.action == 'USER_CREATED')]").exists());
    }

    @Test
    void httpListEndpoint_filtersByActorId() throws Exception {
        UUID otherActorId = createTestUser("audit-actor-" + UUID.randomUUID() + "@test");
        seedAuditRowsWithActors(ADMIN_USER_ID, otherActorId);
        String token = loginAsAdmin();

        mockMvc.perform(get("/audit-logs")
                        .param("actorId", ADMIN_USER_ID.toString())
                        .param("size", "100")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.actorId != '" + ADMIN_USER_ID + "')]").doesNotExist())
                .andExpect(jsonPath("$.data[?(@.actorId == '" + ADMIN_USER_ID + "')]").exists());
    }

    @Test
    void httpListEndpoint_filtersByDateRange() throws Exception {
        UUID oldId = UUID.randomUUID();
        UUID recentId = UUID.randomUUID();
        LocalDateTime oldTs = LocalDateTime.now().minusDays(30);
        LocalDateTime recentTs = LocalDateTime.now().minusMinutes(1);
        insertAuditRowAt(oldId, "Ingredient", UUID.randomUUID(),
                ADMIN_USER_ID, AuditAction.INGREDIENT_CREATED, oldTs);
        insertAuditRowAt(recentId, "Ingredient", UUID.randomUUID(),
                ADMIN_USER_ID, AuditAction.INGREDIENT_CREATED, recentTs);

        String token = loginAsAdmin();
        DateTimeFormatter f = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

        // Narrow window includes only recent
        LocalDateTime from = LocalDateTime.now().minusHours(1);
        LocalDateTime to = LocalDateTime.now().plusHours(1);

        mockMvc.perform(get("/audit-logs")
                        .param("from", from.format(f))
                        .param("to", to.format(f))
                        .param("size", "200")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.id == '" + recentId + "')]").exists())
                .andExpect(jsonPath("$.data[?(@.id == '" + oldId + "')]").doesNotExist());
    }

    // ---- OWNER-only access ----

    @Test
    void httpListEndpoint_asAdminOwner_returns200() throws Exception {
        String token = loginAsAdmin();
        mockMvc.perform(get("/audit-logs")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void httpListEndpoint_asEmployee_returns403() throws Exception {
        String adminToken = loginAsAdmin();

        // Create EMPLOYEE via API so password hashing matches login
        String employeeEmail = "audit-emp-" + UUID.randomUUID() + "@test";
        String createBody = objectMapper.writeValueAsString(Map.of(
                "name", "Test Audit Employee",
                "email", employeeEmail,
                "password", "pass1234",
                "role", "EMPLOYEE"));
        mockMvc.perform(post("/users")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(status().isCreated());

        String employeeToken = loginAs(employeeEmail, "pass1234");
        mockMvc.perform(get("/audit-logs")
                        .header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isForbidden());
    }

    // ---- Helpers ----

    private long countAudit(String entityType, UUID entityId, AuditAction action) {
        StringBuilder sql = new StringBuilder("SELECT COUNT(*) FROM audit_logs WHERE 1=1");
        java.util.List<Object> params = new java.util.ArrayList<>();
        if (entityType != null) {
            sql.append(" AND entity_type = ?");
            params.add(entityType);
        }
        if (entityId != null) {
            sql.append(" AND entity_id = ?");
            params.add(entityId);
        }
        if (action != null) {
            sql.append(" AND action = ?");
            params.add(action.name());
        }
        return jdbc.queryForObject(sql.toString(), Long.class, params.toArray());
    }

    private void assertActor(UUID entityId, String entityType, UUID expectedActor) {
        UUID actual = jdbc.queryForObject(
                "SELECT actor_id FROM audit_logs WHERE entity_type = ? AND entity_id = ? " +
                        "ORDER BY created_at DESC LIMIT 1",
                UUID.class, entityType, entityId);
        assertThat(actual).isEqualTo(expectedActor);
    }

    private UUID createTestSupplier() {
        return new TransactionTemplate(txm).execute(s -> {
            Supplier sup = new Supplier();
            sup.setName("Test Audit Supplier");
            return supplierRepository.save(sup).getId();
        });
    }

    private UUID createTestUser(String email) {
        var resp = userService.create(
                new CreateUserRequest("Test Audit Other Actor", email, "pass1234", Role.EMPLOYEE),
                ADMIN_USER_ID);
        return resp.id();
    }

    private String loginAsAdmin() throws Exception {
        return loginAs("admin@pizzaria.com", "admin123");
    }

    private String loginAs(String email, String password) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of("email", email, "password", password));
        String resp = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(resp).path("data").path("accessToken").asText();
    }

    private void seedAuditRows() {
        insertAuditRowAt(UUID.randomUUID(), "Ingredient", UUID.randomUUID(),
                ADMIN_USER_ID, AuditAction.INGREDIENT_CREATED, LocalDateTime.now());
        insertAuditRowAt(UUID.randomUUID(), "User", UUID.randomUUID(),
                ADMIN_USER_ID, AuditAction.USER_CREATED, LocalDateTime.now());
    }

    private void seedAuditRowsWithActors(UUID adminId, UUID otherId) {
        insertAuditRowAt(UUID.randomUUID(), "Ingredient", UUID.randomUUID(),
                adminId, AuditAction.INGREDIENT_CREATED, LocalDateTime.now());
        insertAuditRowAt(UUID.randomUUID(), "Ingredient", UUID.randomUUID(),
                otherId, AuditAction.INGREDIENT_CREATED, LocalDateTime.now());
    }

    private void insertAuditRowAt(UUID id, String entityType, UUID entityId,
                                   UUID actorId, AuditAction action, LocalDateTime ts) {
        jdbc.update(
                "INSERT INTO audit_logs (id, action, entity_type, entity_id, actor_id, created_at) " +
                        "VALUES (?, ?, ?, ?, ?, ?)",
                id, action.name(), entityType, entityId, actorId, ts);
    }

    private void cleanup() {
        // 1) Clean audit rows that target test entities or test actors. Be permissive
        //    so leftover rows from previous failed runs don't pollute counts.
        jdbc.update("DELETE FROM audit_logs WHERE entity_type = 'User' AND entity_id IN " +
                "(SELECT id FROM users WHERE email LIKE 'audit-%@test')");
        jdbc.update("DELETE FROM audit_logs WHERE actor_id IN " +
                "(SELECT id FROM users WHERE email LIKE 'audit-%@test')");
        jdbc.update("DELETE FROM audit_logs WHERE entity_type = 'Ingredient' AND entity_id IN " +
                "(SELECT id FROM ingredients WHERE name LIKE 'Test Audit%')");
        jdbc.update("DELETE FROM audit_logs WHERE entity_type = 'Unit' AND entity_id IN " +
                "(SELECT id FROM units WHERE name LIKE 'Test Audit%')");
        jdbc.update("DELETE FROM audit_logs WHERE entity_type = 'Product' AND entity_id IN " +
                "(SELECT id FROM products WHERE name LIKE 'Test Audit%')");
        jdbc.update("DELETE FROM audit_logs WHERE entity_type = 'PurchaseOrder' AND entity_id IN " +
                "(SELECT id FROM purchase_orders WHERE supplier_id IN " +
                "(SELECT id FROM suppliers WHERE name LIKE 'Test Audit%'))");
        jdbc.update("DELETE FROM audit_logs WHERE entity_type = 'StockMovement' AND entity_id IN " +
                "(SELECT id FROM stock_movements WHERE ingredient_id IN " +
                "(SELECT id FROM ingredients WHERE name LIKE 'Test Audit%'))");
        // Audit rows seeded directly via JDBC for filter tests use random entity_ids; clean those up
        // by deleting any audit rows whose action belongs to seed actions and whose entity_type
        // points at no real row. Simpler: nothing else to do — filter tests assert on what they see,
        // and date-range test is window-bounded.

        // 2) Movements / stock for test ingredients
        jdbc.update("DELETE FROM stock_movements WHERE ingredient_id IN " +
                "(SELECT id FROM ingredients WHERE name LIKE 'Test Audit%')");
        jdbc.update("DELETE FROM stock WHERE ingredient_id IN " +
                "(SELECT id FROM ingredients WHERE name LIKE 'Test Audit%')");

        // 3) Purchase orders for test suppliers
        jdbc.update("DELETE FROM purchase_order_items WHERE purchase_order_id IN " +
                "(SELECT id FROM purchase_orders WHERE supplier_id IN " +
                "(SELECT id FROM suppliers WHERE name LIKE 'Test Audit%'))");
        jdbc.update("DELETE FROM purchase_orders WHERE supplier_id IN " +
                "(SELECT id FROM suppliers WHERE name LIKE 'Test Audit%')");

        // 4) Products and recipes
        jdbc.update("DELETE FROM product_ingredients WHERE product_id IN " +
                "(SELECT id FROM products WHERE name LIKE 'Test Audit%')");
        jdbc.update("DELETE FROM products WHERE name LIKE 'Test Audit%'");

        // 5) Ingredients
        jdbc.update("DELETE FROM ingredients WHERE name LIKE 'Test Audit%'");

        // 6) Suppliers and Units (never delete the seeded Matriz unit)
        jdbc.update("DELETE FROM suppliers WHERE name LIKE 'Test Audit%'");
        jdbc.update("DELETE FROM units WHERE name LIKE 'Test Audit%' AND id <> ?", MATRIZ_ID);

        // 7) Users — refresh tokens first; never delete admin
        jdbc.update("DELETE FROM refresh_tokens WHERE user_id IN " +
                "(SELECT id FROM users WHERE email LIKE 'audit-%@test')");
        jdbc.update("DELETE FROM users WHERE email LIKE 'audit-%@test' AND id <> ?", ADMIN_USER_ID);
    }
}
