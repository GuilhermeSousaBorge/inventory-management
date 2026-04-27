package br.com.easy_inventory.management.report.service;

import br.com.easy_inventory.management.report.dto.ConsumptionReportRow;
import br.com.easy_inventory.management.report.dto.SalesReportRow;
import br.com.easy_inventory.management.report.dto.StockStatusRow;
import br.com.easy_inventory.management.report.dto.WasteReportRow;
import br.com.easy_inventory.management.shared.exception.BusinessException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class ReportService {

    @PersistenceContext
    private EntityManager em;

    public List<ConsumptionReportRow> consumption(LocalDateTime from, LocalDateTime to,
                                                  UUID unitId, UUID ingredientId) {
        validateRange(from, to);
        var sql = """
            SELECT m.ingredient_id, i.name, i.unit_of_measure,
                   SUM(m.quantity) AS total_qty,
                   COUNT(*) AS movement_count
              FROM stock_movements m
              JOIN ingredients i ON i.id = m.ingredient_id
             WHERE m.type = 'EXIT'
               AND (CAST(:unitId AS uuid) IS NULL OR m.unit_id = CAST(:unitId AS uuid))
               AND (CAST(:ingredientId AS uuid) IS NULL OR m.ingredient_id = CAST(:ingredientId AS uuid))
               AND m.created_at BETWEEN :from AND :to
             GROUP BY m.ingredient_id, i.name, i.unit_of_measure
             ORDER BY total_qty DESC
            """;
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery(sql)
                .setParameter("unitId", unitId == null ? null : unitId.toString())
                .setParameter("ingredientId", ingredientId == null ? null : ingredientId.toString())
                .setParameter("from", from).setParameter("to", to)
                .getResultList();
        return rows.stream().map(r -> new ConsumptionReportRow(
                (UUID) r[0],
                (String) r[1],
                br.com.easy_inventory.management.ingredient.entity.UnitOfMeasure.valueOf((String) r[2]),
                (BigDecimal) r[3],
                ((Number) r[4]).longValue()
        )).toList();
    }

    public List<SalesReportRow> sales(LocalDateTime from, LocalDateTime to,
                                      UUID unitId, UUID productId) {
        validateRange(from, to);
        var sql = """
            SELECT oi.product_id, p.name, p.size,
                   SUM(oi.quantity) AS units_sold,
                   SUM(oi.quantity * oi.unit_price) AS revenue,
                   COUNT(DISTINCT oi.order_id) AS orders_count
              FROM order_items oi
              JOIN orders o ON o.id = oi.order_id
              JOIN products p ON p.id = oi.product_id
             WHERE o.status = 'COMPLETED'
               AND (CAST(:unitId AS uuid) IS NULL OR o.unit_id = CAST(:unitId AS uuid))
               AND (CAST(:productId AS uuid) IS NULL OR oi.product_id = CAST(:productId AS uuid))
               AND o.completed_at BETWEEN :from AND :to
             GROUP BY oi.product_id, p.name, p.size
             ORDER BY revenue DESC
            """;
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery(sql)
                .setParameter("unitId", unitId == null ? null : unitId.toString())
                .setParameter("productId", productId == null ? null : productId.toString())
                .setParameter("from", from).setParameter("to", to)
                .getResultList();
        return rows.stream().map(r -> new SalesReportRow(
                (UUID) r[0],
                (String) r[1],
                br.com.easy_inventory.management.product.entity.ProductSize.valueOf((String) r[2]),
                ((Number) r[3]).longValue(),
                (BigDecimal) r[4],
                ((Number) r[5]).longValue()
        )).toList();
    }

    public List<WasteReportRow> waste(LocalDateTime from, LocalDateTime to,
                                      UUID unitId, UUID ingredientId) {
        validateRange(from, to);
        var sql = """
            SELECT m.ingredient_id, i.name, i.unit_of_measure,
                   SUM(m.quantity) AS waste_qty,
                   COUNT(*) AS adjustment_count
              FROM stock_movements m
              JOIN ingredients i ON i.id = m.ingredient_id
             WHERE m.type = 'ADJUSTMENT'
               AND m.direction = 'DECREASE'
               AND (CAST(:unitId AS uuid) IS NULL OR m.unit_id = CAST(:unitId AS uuid))
               AND (CAST(:ingredientId AS uuid) IS NULL OR m.ingredient_id = CAST(:ingredientId AS uuid))
               AND m.created_at BETWEEN :from AND :to
             GROUP BY m.ingredient_id, i.name, i.unit_of_measure
             ORDER BY waste_qty DESC
            """;
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery(sql)
                .setParameter("unitId", unitId == null ? null : unitId.toString())
                .setParameter("ingredientId", ingredientId == null ? null : ingredientId.toString())
                .setParameter("from", from).setParameter("to", to)
                .getResultList();
        return rows.stream().map(r -> new WasteReportRow(
                (UUID) r[0],
                (String) r[1],
                br.com.easy_inventory.management.ingredient.entity.UnitOfMeasure.valueOf((String) r[2]),
                (BigDecimal) r[3],
                ((Number) r[4]).longValue()
        )).toList();
    }

    public List<StockStatusRow> stockStatus(UUID unitId) {
        var sql = """
            SELECT s.ingredient_id, i.name, i.unit_of_measure,
                   s.quantity, i.minimum_qty,
                   CASE
                     WHEN s.quantity <= i.minimum_qty THEN 'LOW'
                     WHEN s.quantity <= i.minimum_qty * 1.5 THEN 'WARNING'
                     ELSE 'OK'
                   END AS level
              FROM stock s
              JOIN ingredients i ON i.id = s.ingredient_id
             WHERE i.active = true
               AND (CAST(:unitId AS uuid) IS NULL OR s.unit_id = CAST(:unitId AS uuid))
             ORDER BY (s.quantity / NULLIF(i.minimum_qty, 0)) ASC
            """;
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery(sql)
                .setParameter("unitId", unitId == null ? null : unitId.toString())
                .getResultList();
        return rows.stream().map(r -> new StockStatusRow(
                (UUID) r[0],
                (String) r[1],
                br.com.easy_inventory.management.ingredient.entity.UnitOfMeasure.valueOf((String) r[2]),
                (BigDecimal) r[3],
                (BigDecimal) r[4],
                (String) r[5]
        )).toList();
    }

    private void validateRange(LocalDateTime from, LocalDateTime to) {
        if (from == null || to == null) {
            throw new BusinessException("Both 'from' and 'to' are required");
        }
        if (from.isAfter(to)) {
            throw new BusinessException("'from' must be <= 'to'");
        }
    }
}
