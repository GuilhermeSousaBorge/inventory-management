package br.com.easy_inventory.management.purchase.controller;

import br.com.easy_inventory.management.purchase.dto.CreatePurchaseOrderRequest;
import br.com.easy_inventory.management.purchase.dto.PurchaseOrderResponse;
import br.com.easy_inventory.management.purchase.dto.UpdatePurchaseOrderRequest;
import br.com.easy_inventory.management.purchase.entity.PurchaseOrderStatus;
import br.com.easy_inventory.management.purchase.service.PurchaseOrderService;
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

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/purchase-orders")
public class PurchaseOrderController {
    private final PurchaseOrderService service;

    public PurchaseOrderController(PurchaseOrderService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<PageResponse<PurchaseOrderResponse>> list(
            @RequestParam(required = false) PurchaseOrderStatus status,
            @RequestParam(required = false) UUID supplier,
            @RequestParam(required = false) UUID unit,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<PurchaseOrderResponse> result = service.findAll(status, supplier, unit, from, to,
                PageRequest.of(page, size));
        return ResponseEntity.ok(PageResponse.of(result.getContent(), page, size, result.getTotalElements()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<PurchaseOrderResponse>> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.of(service.findById(id)));
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<PurchaseOrderResponse>> create(
            @Valid @RequestBody CreatePurchaseOrderRequest request) {
        var response = service.create(request, AuthenticatedUser.currentId());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(response));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<PurchaseOrderResponse>> update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdatePurchaseOrderRequest request) {
        return ResponseEntity.ok(ApiResponse.of(service.update(id, request)));
    }

    @PostMapping("/{id}/receive")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<PurchaseOrderResponse>> receive(@PathVariable UUID id) {
        var response = service.receive(id, AuthenticatedUser.currentId());
        return ResponseEntity.ok(ApiResponse.of(response));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<PurchaseOrderResponse>> cancel(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.of(service.cancel(id)));
    }
}

