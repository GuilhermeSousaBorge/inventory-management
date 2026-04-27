package br.com.easy_inventory.management.notification;

import br.com.easy_inventory.management.ingredient.entity.Ingredient;
import br.com.easy_inventory.management.ingredient.entity.UnitOfMeasure;
import br.com.easy_inventory.management.ingredient.repository.IngredientRepository;
import br.com.easy_inventory.management.notification.entity.Notification;
import br.com.easy_inventory.management.notification.entity.NotificationStatus;
import br.com.easy_inventory.management.notification.entity.NotificationType;
import br.com.easy_inventory.management.notification.repository.NotificationRepository;
import br.com.easy_inventory.management.notification.service.NotificationService;
import br.com.easy_inventory.management.shared.exception.BusinessException;
import br.com.easy_inventory.management.stock.service.StockService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
class NotificationListenerTest {

    static final UUID MATRIZ_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    static final UUID ADMIN_USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Autowired StockService stockService;
    @Autowired NotificationService notificationService;
    @Autowired NotificationRepository notificationRepository;
    @Autowired IngredientRepository ingredientRepository;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager txm;

    private UUID ingredientId;

    @BeforeEach
    void setUp() {
        cleanup();
        ingredientId = new TransactionTemplate(txm).execute(s -> {
            Ingredient ing = new Ingredient();
            ing.setName("Test Notif Cheese");
            ing.setUnitOfMeasure(UnitOfMeasure.kg);
            ing.setMinimumQty(new BigDecimal("5.000"));
            return ingredientRepository.save(ing).getId();
        });
    }

    @AfterEach
    void tearDown() { cleanup(); }

    private void cleanup() {
        jdbc.update("DELETE FROM notifications WHERE ingredient_id IN (SELECT id FROM ingredients WHERE name LIKE 'Test Notif%')");
        jdbc.update("DELETE FROM audit_logs WHERE entity_type = 'StockMovement' AND entity_id IN (SELECT id FROM stock_movements WHERE ingredient_id IN (SELECT id FROM ingredients WHERE name LIKE 'Test Notif%'))");
        jdbc.update("DELETE FROM stock_movements WHERE ingredient_id IN (SELECT id FROM ingredients WHERE name LIKE 'Test Notif%')");
        jdbc.update("DELETE FROM stock WHERE ingredient_id IN (SELECT id FROM ingredients WHERE name LIKE 'Test Notif%')");
        jdbc.update("DELETE FROM ingredients WHERE name LIKE 'Test Notif%'");
    }

    @Test
    void applyExit_pushingStockBelowMin_raisesActiveNotification() {
        // Entry: stock = 10, min = 5  =>  above min, no notification yet
        stockService.applyEntry(ingredientId, MATRIZ_ID,
                new BigDecimal("10.000"), new BigDecimal("5.0000"), null, ADMIN_USER_ID);

        // Exit: stock = 10 - 8 = 2, min = 5  =>  below min
        stockService.applyExit(ingredientId, MATRIZ_ID,
                new BigDecimal("8.000"), "test", ADMIN_USER_ID);

        Optional<Notification> opt = notificationRepository.findActive(
                ingredientId, MATRIZ_ID, NotificationType.LOW_STOCK);

        assertThat(opt).isPresent();
        Notification n = opt.get();
        assertThat(n.getStatus()).isEqualTo(NotificationStatus.ACTIVE);
        assertThat(n.getTriggeredQuantity()).isEqualByComparingTo(new BigDecimal("2.000"));
        assertThat(n.getMinQuantity()).isEqualByComparingTo(new BigDecimal("5.000"));
        assertThat(n.getMessage()).contains("Test Notif Cheese");
        assertThat(n.getMessage()).contains("Matriz");
    }

    @Test
    void secondExitBelowMin_doesNotDuplicateNotification() {
        // Set up: stock below min
        stockService.applyEntry(ingredientId, MATRIZ_ID,
                new BigDecimal("10.000"), new BigDecimal("5.0000"), null, ADMIN_USER_ID);
        stockService.applyExit(ingredientId, MATRIZ_ID,
                new BigDecimal("8.000"), "test", ADMIN_USER_ID);

        // Second exit: still below min — should not create a second notification
        stockService.applyExit(ingredientId, MATRIZ_ID,
                new BigDecimal("1.000"), "test again", ADMIN_USER_ID);

        Long count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM notifications WHERE ingredient_id = ? AND unit_id = ? AND status = 'ACTIVE'",
                Long.class, ingredientId, MATRIZ_ID);
        assertThat(count).isEqualTo(1L);
    }

    @Test
    void applyEntryAboveMin_autoResolvesActiveNotification() {
        // Create ACTIVE notification by pushing below min
        stockService.applyEntry(ingredientId, MATRIZ_ID,
                new BigDecimal("10.000"), new BigDecimal("5.0000"), null, ADMIN_USER_ID);
        stockService.applyExit(ingredientId, MATRIZ_ID,
                new BigDecimal("8.000"), "test", ADMIN_USER_ID);

        UUID notificationId = notificationRepository
                .findActive(ingredientId, MATRIZ_ID, NotificationType.LOW_STOCK)
                .orElseThrow().getId();

        // Entry above min: stock = 2 + 20 = 22 > 5 => auto-resolve
        stockService.applyEntry(ingredientId, MATRIZ_ID,
                new BigDecimal("20.000"), new BigDecimal("5.0000"), null, ADMIN_USER_ID);

        Notification resolved = notificationRepository.findById(notificationId).orElseThrow();
        assertThat(resolved.getStatus()).isEqualTo(NotificationStatus.RESOLVED);
        assertThat(resolved.getResolvedAt()).isNotNull();
        assertThat(resolved.getResolvedBy()).isNull();
    }

    @Test
    void applyExitInsufficientStock_rollsBack_doesNotCreateNotification() {
        // Ingredient has no stock at all — applyExit should throw (stock=0, quantity=1)
        assertThatThrownBy(() ->
                stockService.applyExit(ingredientId, MATRIZ_ID,
                        new BigDecimal("1.000"), "test", ADMIN_USER_ID))
                .isInstanceOf(RuntimeException.class);

        Long count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM notifications WHERE ingredient_id = ?",
                Long.class, ingredientId);
        assertThat(count).isEqualTo(0L);
    }

    @Test
    void resolveManually_setsResolvedByActor_andRejectsAlreadyResolved() {
        // Create ACTIVE notification
        stockService.applyEntry(ingredientId, MATRIZ_ID,
                new BigDecimal("10.000"), new BigDecimal("5.0000"), null, ADMIN_USER_ID);
        stockService.applyExit(ingredientId, MATRIZ_ID,
                new BigDecimal("8.000"), "test", ADMIN_USER_ID);

        UUID notificationId = notificationRepository
                .findActive(ingredientId, MATRIZ_ID, NotificationType.LOW_STOCK)
                .orElseThrow().getId();

        // Manual resolve
        var response = notificationService.resolveManually(notificationId, ADMIN_USER_ID);
        assertThat(response.resolvedBy()).isEqualTo(ADMIN_USER_ID);

        // Second resolve should throw BusinessException
        assertThatThrownBy(() ->
                notificationService.resolveManually(notificationId, ADMIN_USER_ID))
                .isInstanceOf(BusinessException.class);
    }
}
