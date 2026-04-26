package br.com.easy_inventory.management.order.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record UpdateOrderRequest(
        @NotNull UUID unitId,
        @Size(max = 500) String notes,
        @NotEmpty @Valid List<OrderItemRequest> items
) {}