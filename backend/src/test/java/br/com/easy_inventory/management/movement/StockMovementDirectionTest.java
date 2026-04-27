package br.com.easy_inventory.management.movement;

import br.com.easy_inventory.management.ingredient.entity.Ingredient;
import br.com.easy_inventory.management.ingredient.entity.UnitOfMeasure;
import br.com.easy_inventory.management.ingredient.repository.IngredientRepository;
import br.com.easy_inventory.management.movement.entity.AdjustmentDirection;
import br.com.easy_inventory.management.movement.entity.StockMovement;
import br.com.easy_inventory.management.movement.repository.StockMovementRepository;
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
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class StockMovementDirectionTest {

    static final UUID MATRIZ_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    static final UUID ADMIN_USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Autowired StockService stockService;
    @Autowired StockMovementRepository movementRepository;
    @Autowired IngredientRepository ingredientRepository;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager txm;

    private UUID ingredientId;

    @BeforeEach
    void setUp() {
        cleanup();
        ingredientId = new TransactionTemplate(txm).execute(s -> {
            Ingredient ing = new Ingredient();
            ing.setName("Test Direction Ing");
            ing.setUnitOfMeasure(UnitOfMeasure.kg);
            ing.setMinimumQty(new BigDecimal("0.001"));
            return ingredientRepository.save(ing).getId();
        });
    }

    @AfterEach
    void tearDown() { cleanup(); }

    @Test
    void applyAdjustment_increase_persistsDirectionIncrease() {
        StockMovement saved = stockService.applyAdjustment(ingredientId, MATRIZ_ID,
                new BigDecimal("5.000"), AdjustmentDirection.INCREASE,
                "found extra", ADMIN_USER_ID);

        StockMovement reloaded = movementRepository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getDirection()).isEqualTo(AdjustmentDirection.INCREASE);

        String dbValue = jdbc.queryForObject(
                "SELECT direction FROM stock_movements WHERE id = ?",
                String.class, saved.getId());
        assertThat(dbValue).isEqualTo("INCREASE");
    }

    @Test
    void applyAdjustment_decrease_persistsDirectionDecrease() {
        // Seed stock first so DECREASE doesn't go negative
        stockService.applyEntry(ingredientId, MATRIZ_ID,
                new BigDecimal("10.000"), new BigDecimal("1.0000"), null, ADMIN_USER_ID);

        StockMovement saved = stockService.applyAdjustment(ingredientId, MATRIZ_ID,
                new BigDecimal("3.000"), AdjustmentDirection.DECREASE,
                "spoiled", ADMIN_USER_ID);

        StockMovement reloaded = movementRepository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getDirection()).isEqualTo(AdjustmentDirection.DECREASE);

        String dbValue = jdbc.queryForObject(
                "SELECT direction FROM stock_movements WHERE id = ?",
                String.class, saved.getId());
        assertThat(dbValue).isEqualTo("DECREASE");
    }

    @Test
    void applyEntry_leavesDirectionNull() {
        StockMovement saved = stockService.applyEntry(ingredientId, MATRIZ_ID,
                new BigDecimal("10.000"), new BigDecimal("1.0000"), null, ADMIN_USER_ID);

        StockMovement reloaded = movementRepository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getDirection()).isNull();

        String dbValue = jdbc.queryForObject(
                "SELECT direction FROM stock_movements WHERE id = ?",
                String.class, saved.getId());
        assertThat(dbValue).isNull();
    }

    @Test
    void applyExit_leavesDirectionNull() {
        // Seed stock first so EXIT doesn't fail
        stockService.applyEntry(ingredientId, MATRIZ_ID,
                new BigDecimal("10.000"), new BigDecimal("1.0000"), null, ADMIN_USER_ID);

        StockMovement saved = stockService.applyExit(ingredientId, MATRIZ_ID,
                new BigDecimal("3.000"), "test exit", ADMIN_USER_ID);

        StockMovement reloaded = movementRepository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getDirection()).isNull();

        String dbValue = jdbc.queryForObject(
                "SELECT direction FROM stock_movements WHERE id = ?",
                String.class, saved.getId());
        assertThat(dbValue).isNull();
    }

    private void cleanup() {
        // 1) audit_logs for our test stock_movements
        jdbc.update("DELETE FROM audit_logs WHERE entity_type = 'StockMovement' AND entity_id IN " +
                "(SELECT id FROM stock_movements WHERE ingredient_id IN " +
                "(SELECT id FROM ingredients WHERE name LIKE 'Test Direction%'))");

        // 2) notifications for test ingredients
        jdbc.update("DELETE FROM notifications WHERE ingredient_id IN " +
                "(SELECT id FROM ingredients WHERE name LIKE 'Test Direction%')");

        // 3) stock_movements for test ingredients
        jdbc.update("DELETE FROM stock_movements WHERE ingredient_id IN " +
                "(SELECT id FROM ingredients WHERE name LIKE 'Test Direction%')");

        // 4) stock for test ingredients
        jdbc.update("DELETE FROM stock WHERE ingredient_id IN " +
                "(SELECT id FROM ingredients WHERE name LIKE 'Test Direction%')");

        // 5) ingredients
        jdbc.update("DELETE FROM ingredients WHERE name LIKE 'Test Direction%'");
    }
}
