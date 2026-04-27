package br.com.easy_inventory.management.report.dto;

import br.com.easy_inventory.management.product.entity.ProductSize;

import java.math.BigDecimal;
import java.util.UUID;

public record SalesReportRow(
        UUID productId,
        String productName,
        ProductSize size,
        long unitsSold,
        BigDecimal revenue,
        long ordersCount
) {}
