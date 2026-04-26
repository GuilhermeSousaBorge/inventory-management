package br.com.easy_inventory.management.order.controller;

import br.com.easy_inventory.management.order.dto.CreateOrderRequest;
import br.com.easy_inventory.management.order.dto.OrderResponse;
import br.com.easy_inventory.management.order.dto.UpdateOrderRequest;
import br.com.easy_inventory.management.order.entity.OrderStatus;
import br.com.easy_inventory.management.order.service.OrderService;
import br.com.easy_inventory.management.shared.dto.ApiResponse;
import br.com.easy_inventory.management.shared.dto.PageResponse;
import br.com.easy_inventory.management.shared.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.UUID;

@RestController
@RequestMapping("/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @GetMapping
    public ResponseEntity<PageResponse<OrderResponse>> list(
            @RequestParam(required = false) UUID unit,
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<OrderResponse> result = orderService.findAll(unit, status, from, to,
                PageRequest.of(page, size));
        return ResponseEntity.ok(PageResponse.of(result.getContent(), page, size, result.getTotalElements()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<OrderResponse>> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.of(orderService.findById(id)));
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<OrderResponse>> create(
            @Valid @RequestBody CreateOrderRequest request) {
        var response = orderService.create(request, AuthenticatedUser.currentId());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(response));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<OrderResponse>> update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateOrderRequest request) {
        return ResponseEntity.ok(ApiResponse.of(orderService.update(id, request)));
    }

    @PostMapping("/{id}/start")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<OrderResponse>> start(@PathVariable UUID id) {
        var response = orderService.start(id, AuthenticatedUser.currentId());
        return ResponseEntity.ok(ApiResponse.of(response));
    }

    @PostMapping("/{id}/complete")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<OrderResponse>> complete(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.of(orderService.complete(id)));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<OrderResponse>> cancel(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.of(orderService.cancel(id)));
    }
}