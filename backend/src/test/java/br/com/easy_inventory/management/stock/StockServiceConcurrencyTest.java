package br.com.easy_inventory.management.stock;

import br.com.easy_inventory.management.ingredient.entity.Ingredient;
import br.com.easy_inventory.management.ingredient.entity.UnitOfMeasure;
import br.com.easy_inventory.management.ingredient.repository.IngredientRepository;
import br.com.easy_inventory.management.stock.repository.StockRepository;
import br.com.easy_inventory.management.stock.service.StockService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class StockServiceConcurrencyTest {

    static final UUID MATRIZ_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    static final UUID ADMIN_USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Autowired StockService stockService;
    @Autowired StockRepository stockRepository;
    @Autowired IngredientRepository ingredientRepository;
    @Autowired PlatformTransactionManager txm;
    @Autowired JdbcTemplate jdbc;

    private UUID testIngredientId;

    @BeforeEach
    void setUp() {
        cleanupTestData();
        testIngredientId = new TransactionTemplate(txm).execute(status -> {
            Ingredient ing = new Ingredient();
            ing.setName("Test Ingredient Concurrency");
            ing.setUnitOfMeasure(UnitOfMeasure.kg);
            ing.setMinimumQty(BigDecimal.ONE);
            return ingredientRepository.save(ing).getId();
        });
    }

    @Test
    void concurrentApplyEntry_twoThreads_finalQuantityEqualsSum() throws InterruptedException {
        BigDecimal qty1 = new BigDecimal("10.000");
        BigDecimal price1 = new BigDecimal("15.0000");
        BigDecimal qty2 = new BigDecimal("5.000");
        BigDecimal price2 = new BigDecimal("20.0000");

        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(2);

        ExecutorService executor = Executors.newFixedThreadPool(2);
        executor.submit(() -> {
            try {
                startLatch.await();
                stockService.applyEntry(testIngredientId, MATRIZ_ID,
                        qty1, price1, null, ADMIN_USER_ID);
            } catch (Exception e) {
                throw new RuntimeException(e);
            } finally {
                doneLatch.countDown();
            }
        });
        executor.submit(() -> {
            try {
                startLatch.await();
                stockService.applyEntry(testIngredientId, MATRIZ_ID,
                        qty2, price2, null, ADMIN_USER_ID);
            } catch (Exception e) {
                throw new RuntimeException(e);
            } finally {
                doneLatch.countDown();
            }
        });

        startLatch.countDown();
        boolean completed = doneLatch.await(10, TimeUnit.SECONDS);
        executor.shutdown();

        assertThat(completed).as("Both threads must finish within 10s").isTrue();

        BigDecimal expectedQty = qty1.add(qty2);
        // Weighted avg: (10*15 + 5*20) / 15 = 250/15 = 16.6667
        BigDecimal expectedAvg = qty1.multiply(price1)
                .add(qty2.multiply(price2))
                .divide(expectedQty, 4, RoundingMode.HALF_UP);

        new TransactionTemplate(txm).execute(status -> {
            var stockOpt = stockRepository.findByIngredientIdAndUnitId(testIngredientId, MATRIZ_ID);
            assertThat(stockOpt).isPresent();
            assertThat(stockOpt.get().getQuantity().setScale(3, RoundingMode.HALF_UP))
                    .isEqualByComparingTo(expectedQty);

            var ing = ingredientRepository.findById(testIngredientId).orElseThrow();
            assertThat(ing.getAverageCost().setScale(4, RoundingMode.HALF_UP))
                    .isEqualByComparingTo(expectedAvg);

            long movementCount = (long) jdbc.queryForObject(
                    "SELECT COUNT(*) FROM stock_movements WHERE ingredient_id = ?",
                    Long.class, testIngredientId);
            assertThat(movementCount).isEqualTo(2);
            return null;
        });
    }

    private void cleanupTestData() {
        jdbc.update("DELETE FROM stock_movements WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE supplier_id IN (SELECT id FROM suppliers WHERE name LIKE 'Test%'))");
        jdbc.update("DELETE FROM stock_movements WHERE ingredient_id IN (SELECT id FROM ingredients WHERE name LIKE 'Test%')");
        jdbc.update("DELETE FROM purchase_orders WHERE supplier_id IN (SELECT id FROM suppliers WHERE name LIKE 'Test%')");
        jdbc.update("DELETE FROM stock WHERE ingredient_id IN (SELECT id FROM ingredients WHERE name LIKE 'Test%')");
        jdbc.update("DELETE FROM ingredients WHERE name LIKE 'Test%'");
        jdbc.update("DELETE FROM suppliers WHERE name LIKE 'Test%'");
    }
}
