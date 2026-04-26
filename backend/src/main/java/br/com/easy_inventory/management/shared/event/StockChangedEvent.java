package br.com.easy_inventory.management.shared.event;

import java.math.BigDecimal;
import java.util.UUID;

public record StockChangedEvent(
        UUID ingredientId,
        UUID unitId,
        BigDecimal newQuantity,
        BigDecimal minQuantity
) {}
