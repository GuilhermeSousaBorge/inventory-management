package br.com.easy_inventory.management.order.dto;

import br.com.easy_inventory.management.order.entity.OrderItem;
import br.com.easy_inventory.management.product.entity.Product;

import java.math.BigDecimal;
import java.util.UUID;

public record OrderItemResponse(
        UUID id,
        UUID productId,
        String productName,
        int quantity,
        BigDecimal unitPrice,
        BigDecimal subtotal
) {
    public static OrderItemResponse from(OrderItem item) {
        Product p = item.getProduct();
        return new OrderItemResponse(
                item.getId(),
                p.getId(),
                p.getName() + " " + p.getSize(),
                item.getQuantity(),
                item.getUnitPrice(),
                item.getUnitPrice().multiply(BigDecimal.valueOf(item.getQuantity()))
        );
    }
}