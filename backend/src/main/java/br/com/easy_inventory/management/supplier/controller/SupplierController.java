package br.com.easy_inventory.management.supplier.controller;

import br.com.easy_inventory.management.shared.dto.ApiResponse;
import br.com.easy_inventory.management.shared.dto.PageResponse;
import br.com.easy_inventory.management.supplier.dto.*;
import br.com.easy_inventory.management.supplier.service.SupplierService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/suppliers")
public class SupplierController {

    private final SupplierService supplierService;

    public SupplierController(SupplierService supplierService) {
        this.supplierService = supplierService;
    }

    @GetMapping
    public ResponseEntity<PageResponse<SupplierResponse>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<SupplierResponse> result = supplierService.findAll(PageRequest.of(page, size));
        return ResponseEntity.ok(PageResponse.of(result.getContent(), page, size, result.getTotalElements()));
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<SupplierResponse>> create(@Valid @RequestBody CreateSupplierRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(supplierService.create(request)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<SupplierResponse>> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.of(supplierService.findById(id)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<SupplierResponse>> update(@PathVariable UUID id,
                                                                 @Valid @RequestBody UpdateSupplierRequest request) {
        return ResponseEntity.ok(ApiResponse.of(supplierService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<Void> deactivate(@PathVariable UUID id) {
        supplierService.deactivate(id);
        return ResponseEntity.noContent().build();
    }
}
