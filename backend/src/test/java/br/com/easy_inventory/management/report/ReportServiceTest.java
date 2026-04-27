package br.com.easy_inventory.management.report;

import br.com.easy_inventory.management.ingredient.entity.Ingredient;
import br.com.easy_inventory.management.ingredient.entity.UnitOfMeasure;
import br.com.easy_inventory.management.ingredient.repository.IngredientRepository;
import br.com.easy_inventory.management.movement.entity.AdjustmentDirection;
import br.com.easy_inventory.management.report.dto.ConsumptionReportRow;
import br.com.easy_inventory.management.report.dto.SalesReportRow;
import br.com.easy_inventory.management.report.dto.StockStatusRow;
import br.com.easy_inventory.management.report.dto.WasteReportRow;
import br.com.easy_inventory.management.report.service.ReportService;
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
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
class ReportServiceTest {

    static final UUID MATRIZ_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    static final UUID ADMIN_USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Autowired ReportService reportService;
    @Autowired StockService stockService;
    @Autowired IngredientRepository ingredientRepository;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager txm;

    @BeforeEach
    void setUp() { cleanup(); }

    @AfterEach
    void tearDown() { cleanup(); }

    // ---- consumption ----

    @Test
    void consumption_aggregatesExitMovementsCorrectly() {
        UUID ingA = createIngredient("Test Report Ing A", new BigDecimal("0.001"));
        UUID ingB = createIngredient("Test Report Ing B", new BigDecimal("0.001"));

        LocalDateTime from = LocalDateTime.now().minusMinutes(5);

        // Seed stock so EXITs don't fail
        stockService.applyEntry(ingA, MATRIZ_ID, new BigDecimal("100.000"),
                new BigDecimal("1.0000"), null, ADMIN_USER_ID);
        stockService.applyEntry(ingB, MATRIZ_ID, new BigDecimal("100.000"),
                new BigDecimal("1.0000"), null, ADMIN_USER_ID);

        // 2 exits on ingA: 5 + 3 = 8, count=2
        stockService.applyExit(ingA, MATRIZ_ID, new BigDecimal("5.000"), "test", ADMIN_USER_ID);
        stockService.applyExit(ingA, MATRIZ_ID, new BigDecimal("3.000"), "test", ADMIN_USER_ID);
        // 1 exit on ingB: 4, count=1
        stockService.applyExit(ingB, MATRIZ_ID, new BigDecimal("4.000"), "test", ADMIN_USER_ID);

        LocalDateTime to = LocalDateTime.now().plusMinutes(5);

        List<ConsumptionReportRow> rows = reportService.consumption(from, to, MATRIZ_ID, null);

        // Filter to only rows for our test ingredients (other tests/seed data may also produce EXITs)
        List<ConsumptionReportRow> mine = rows.stream()
                .filter(r -> r.ingredientId().equals(ingA) || r.ingredientId().equals(ingB))
                .toList();
        assertThat(mine).hasSize(2);

        ConsumptionReportRow rowA = mine.stream().filter(r -> r.ingredientId().equals(ingA)).findFirst().orElseThrow();
        ConsumptionReportRow rowB = mine.stream().filter(r -> r.ingredientId().equals(ingB)).findFirst().orElseThrow();

        assertThat(rowA.totalQuantity()).isEqualByComparingTo(new BigDecimal("8.000"));
        assertThat(rowA.movementCount()).isEqualTo(2L);
        assertThat(rowB.totalQuantity()).isEqualByComparingTo(new BigDecimal("4.000"));
        assertThat(rowB.movementCount()).isEqualTo(1L);

        // Order: total_qty DESC -> ingA (8) before ingB (4) within our subset
        int idxA = mine.indexOf(rowA);
        int idxB = mine.indexOf(rowB);
        assertThat(idxA).isLessThan(idxB);
    }

    @Test
    void consumption_ingredientIdFilter_narrowsToOneIngredient() {
        UUID ingA = createIngredient("Test Report Ing A", new BigDecimal("0.001"));
        UUID ingB = createIngredient("Test Report Ing B", new BigDecimal("0.001"));

        LocalDateTime from = LocalDateTime.now().minusMinutes(5);

        stockService.applyEntry(ingA, MATRIZ_ID, new BigDecimal("100.000"),
                new BigDecimal("1.0000"), null, ADMIN_USER_ID);
        stockService.applyEntry(ingB, MATRIZ_ID, new BigDecimal("100.000"),
                new BigDecimal("1.0000"), null, ADMIN_USER_ID);

        stockService.applyExit(ingA, MATRIZ_ID, new BigDecimal("5.000"), "test", ADMIN_USER_ID);
        stockService.applyExit(ingB, MATRIZ_ID, new BigDecimal("4.000"), "test", ADMIN_USER_ID);

        LocalDateTime to = LocalDateTime.now().plusMinutes(5);

        List<ConsumptionReportRow> rows = reportService.consumption(from, to, MATRIZ_ID, ingA);

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).ingredientId()).isEqualTo(ingA);
        assertThat(rows.get(0).totalQuantity()).isEqualByComparingTo(new BigDecimal("5.000"));
    }

    @Test
    void consumption_badRange_throwsBusinessException() {
        LocalDateTime from = LocalDateTime.now();
        LocalDateTime to = from.minusMinutes(10);

        assertThatThrownBy(() -> reportService.consumption(from, to, MATRIZ_ID, null))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void consumption_nullBounds_throwBusinessException() {
        assertThatThrownBy(() ->
                reportService.consumption(null, LocalDateTime.now(), MATRIZ_ID, null))
                .isInstanceOf(BusinessException.class);

        assertThatThrownBy(() ->
                reportService.consumption(LocalDateTime.now(), null, MATRIZ_ID, null))
                .isInstanceOf(BusinessException.class);
    }

    // ---- sales ----

    // NOTE: Sales tests insert orders directly via JDBC (with status=COMPLETED and
    // completed_at set inside the test window). We use this approach because the
    // natural OrderService completion flow consumes ingredient stock via the recipe,
    // and the test target here is the SQL aggregation in ReportService.sales(),
    // not the order workflow. Order workflow correctness lives in OrderService tests.

    @Test
    void sales_sumsRevenueAndUnitsOfCompletedOrders() {
        UUID prodA = createProduct("Test Report Pizza A", "M", new BigDecimal("39.90"));
        UUID prodB = createProduct("Test Report Pizza B", "G", new BigDecimal("49.90"));

        LocalDateTime from = LocalDateTime.now().minusMinutes(5);
        LocalDateTime middle = LocalDateTime.now().minusMinutes(1);

        // Order 1 COMPLETED: 2x prodA @ 39.90, 1x prodB @ 49.90
        UUID order1 = insertOrder(MATRIZ_ID, "COMPLETED", middle);
        insertOrderItem(order1, prodA, 2, new BigDecimal("39.90"));
        insertOrderItem(order1, prodB, 1, new BigDecimal("49.90"));

        // Order 2 COMPLETED: 3x prodA @ 39.90
        UUID order2 = insertOrder(MATRIZ_ID, "COMPLETED", middle);
        insertOrderItem(order2, prodA, 3, new BigDecimal("39.90"));

        // Order 3 CANCELED: should NOT count
        UUID order3 = insertOrder(MATRIZ_ID, "CANCELED", middle);
        insertOrderItem(order3, prodA, 100, new BigDecimal("39.90"));

        LocalDateTime to = LocalDateTime.now().plusMinutes(5);

        List<SalesReportRow> rows = reportService.sales(from, to, MATRIZ_ID, null);
        List<SalesReportRow> mine = rows.stream()
                .filter(r -> r.productId().equals(prodA) || r.productId().equals(prodB))
                .toList();
        assertThat(mine).hasSize(2);

        SalesReportRow rowA = mine.stream().filter(r -> r.productId().equals(prodA)).findFirst().orElseThrow();
        SalesReportRow rowB = mine.stream().filter(r -> r.productId().equals(prodB)).findFirst().orElseThrow();

        // prodA: 2+3 = 5 units, revenue = 5 * 39.90 = 199.50, ordersCount = 2
        assertThat(rowA.unitsSold()).isEqualTo(5L);
        assertThat(rowA.revenue()).isEqualByComparingTo(new BigDecimal("199.50"));
        assertThat(rowA.ordersCount()).isEqualTo(2L);

        // prodB: 1 unit, revenue = 49.90, ordersCount = 1
        assertThat(rowB.unitsSold()).isEqualTo(1L);
        assertThat(rowB.revenue()).isEqualByComparingTo(new BigDecimal("49.90"));
        assertThat(rowB.ordersCount()).isEqualTo(1L);
    }

    @Test
    void sales_productIdFilter_narrowsToOneProduct() {
        UUID prodA = createProduct("Test Report Pizza A", "M", new BigDecimal("39.90"));
        UUID prodB = createProduct("Test Report Pizza B", "G", new BigDecimal("49.90"));

        LocalDateTime from = LocalDateTime.now().minusMinutes(5);
        LocalDateTime middle = LocalDateTime.now().minusMinutes(1);

        UUID order1 = insertOrder(MATRIZ_ID, "COMPLETED", middle);
        insertOrderItem(order1, prodA, 2, new BigDecimal("39.90"));
        insertOrderItem(order1, prodB, 1, new BigDecimal("49.90"));

        LocalDateTime to = LocalDateTime.now().plusMinutes(5);

        List<SalesReportRow> rows = reportService.sales(from, to, MATRIZ_ID, prodA);

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).productId()).isEqualTo(prodA);
        assertThat(rows.get(0).unitsSold()).isEqualTo(2L);
    }

    // ---- waste ----

    @Test
    void waste_sumsAdjustmentDecreaseOnly() {
        UUID ing = createIngredient("Test Report Ing Waste", new BigDecimal("0.001"));

        LocalDateTime from = LocalDateTime.now().minusMinutes(5);

        // Seed stock
        stockService.applyEntry(ing, MATRIZ_ID, new BigDecimal("50.000"),
                new BigDecimal("1.0000"), null, ADMIN_USER_ID);

        // 2 DECREASE adjustments: 3 + 2 = 5, count=2
        stockService.applyAdjustment(ing, MATRIZ_ID, new BigDecimal("3.000"),
                AdjustmentDirection.DECREASE, "spoiled", ADMIN_USER_ID);
        stockService.applyAdjustment(ing, MATRIZ_ID, new BigDecimal("2.000"),
                AdjustmentDirection.DECREASE, "expired", ADMIN_USER_ID);

        // INCREASE adjustment: should NOT count
        stockService.applyAdjustment(ing, MATRIZ_ID, new BigDecimal("5.000"),
                AdjustmentDirection.INCREASE, "found extra", ADMIN_USER_ID);

        // EXIT: should NOT count
        stockService.applyExit(ing, MATRIZ_ID, new BigDecimal("1.000"), "sale", ADMIN_USER_ID);

        LocalDateTime to = LocalDateTime.now().plusMinutes(5);

        List<WasteReportRow> rows = reportService.waste(from, to, MATRIZ_ID, ing);

        assertThat(rows).hasSize(1);
        WasteReportRow row = rows.get(0);
        assertThat(row.ingredientId()).isEqualTo(ing);
        assertThat(row.wasteQuantity()).isEqualByComparingTo(new BigDecimal("5.000"));
        assertThat(row.adjustmentCount()).isEqualTo(2L);
    }

    // ---- stockStatus ----

    @Test
    void stockStatus_classifiesLowWarningOkByStockVsMin() {
        UUID ingLow = createIngredient("Test Report Ing Low", new BigDecimal("10.000"));
        UUID ingWarn = createIngredient("Test Report Ing Warn", new BigDecimal("10.000"));
        UUID ingOk = createIngredient("Test Report Ing Ok", new BigDecimal("10.000"));

        // Stock = 5 (LOW, <= min 10)
        stockService.applyEntry(ingLow, MATRIZ_ID, new BigDecimal("5.000"),
                new BigDecimal("1.0000"), null, ADMIN_USER_ID);
        // Stock = 12 (WARNING, > 10 but <= 15 = min*1.5)
        stockService.applyEntry(ingWarn, MATRIZ_ID, new BigDecimal("12.000"),
                new BigDecimal("1.0000"), null, ADMIN_USER_ID);
        // Stock = 100 (OK, > 15)
        stockService.applyEntry(ingOk, MATRIZ_ID, new BigDecimal("100.000"),
                new BigDecimal("1.0000"), null, ADMIN_USER_ID);

        List<StockStatusRow> rows = reportService.stockStatus(MATRIZ_ID);

        StockStatusRow rowLow = rows.stream().filter(r -> r.ingredientId().equals(ingLow)).findFirst().orElseThrow();
        StockStatusRow rowWarn = rows.stream().filter(r -> r.ingredientId().equals(ingWarn)).findFirst().orElseThrow();
        StockStatusRow rowOk = rows.stream().filter(r -> r.ingredientId().equals(ingOk)).findFirst().orElseThrow();

        assertThat(rowLow.level()).isEqualTo("LOW");
        assertThat(rowWarn.level()).isEqualTo("WARNING");
        assertThat(rowOk.level()).isEqualTo("OK");
    }

    // ---- helpers ----

    private UUID createIngredient(String name, BigDecimal min) {
        return new TransactionTemplate(txm).execute(s -> {
            Ingredient ing = new Ingredient();
            ing.setName(name);
            ing.setUnitOfMeasure(UnitOfMeasure.kg);
            ing.setMinimumQty(min);
            return ingredientRepository.save(ing).getId();
        });
    }

    private UUID createProduct(String name, String size, BigDecimal price) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO products (id, name, size, price, active, created_at) " +
                        "VALUES (?, ?, ?, ?, true, NOW())",
                id, name, size, price);
        return id;
    }

    private UUID insertOrder(UUID unitId, String status, LocalDateTime completedAt) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO orders (id, unit_id, status, total_price, created_by, completed_at, created_at) " +
                        "VALUES (?, ?, ?, 0, ?, ?, NOW())",
                id, unitId, status, ADMIN_USER_ID, completedAt);
        return id;
    }

    private void insertOrderItem(UUID orderId, UUID productId, int qty, BigDecimal unitPrice) {
        jdbc.update("INSERT INTO order_items (id, order_id, product_id, quantity, unit_price) " +
                        "VALUES (?, ?, ?, ?, ?)",
                UUID.randomUUID(), orderId, productId, qty, unitPrice);
    }

    private void cleanup() {
        // 1) audit_logs for our test stock_movements
        jdbc.update("DELETE FROM audit_logs WHERE entity_type = 'StockMovement' AND entity_id IN " +
                "(SELECT id FROM stock_movements WHERE ingredient_id IN " +
                "(SELECT id FROM ingredients WHERE name LIKE 'Test Report%'))");

        // 2) notifications for test ingredients
        jdbc.update("DELETE FROM notifications WHERE ingredient_id IN " +
                "(SELECT id FROM ingredients WHERE name LIKE 'Test Report%')");

        // 3) order_items + orders for test orders.
        // We identify test orders by joining to test products (unique name LIKE 'Test Report%').
        // First capture the candidate order ids, then delete items, then delete the orders.
        java.util.List<UUID> testOrderIds = jdbc.queryForList(
                "SELECT DISTINCT order_id FROM order_items WHERE product_id IN " +
                        "(SELECT id FROM products WHERE name LIKE 'Test Report%')",
                UUID.class);
        if (!testOrderIds.isEmpty()) {
            String inClause = String.join(",", java.util.Collections.nCopies(testOrderIds.size(), "?"));
            jdbc.update("DELETE FROM order_items WHERE order_id IN (" + inClause + ")",
                    testOrderIds.toArray());
            jdbc.update("DELETE FROM orders WHERE id IN (" + inClause + ")",
                    testOrderIds.toArray());
        }

        // 4) stock_movements for test ingredients
        jdbc.update("DELETE FROM stock_movements WHERE ingredient_id IN " +
                "(SELECT id FROM ingredients WHERE name LIKE 'Test Report%')");

        // 5) stock for test ingredients
        jdbc.update("DELETE FROM stock WHERE ingredient_id IN " +
                "(SELECT id FROM ingredients WHERE name LIKE 'Test Report%')");

        // 6) product_ingredients (recipe join), products
        jdbc.update("DELETE FROM product_ingredients WHERE product_id IN " +
                "(SELECT id FROM products WHERE name LIKE 'Test Report%')");
        jdbc.update("DELETE FROM products WHERE name LIKE 'Test Report%'");

        // 7) ingredients
        jdbc.update("DELETE FROM ingredients WHERE name LIKE 'Test Report%'");

        // 8) units (NEVER delete MATRIZ_ID)
        jdbc.update("DELETE FROM units WHERE name LIKE 'Test Report%' AND id <> ?", MATRIZ_ID);
    }
}
