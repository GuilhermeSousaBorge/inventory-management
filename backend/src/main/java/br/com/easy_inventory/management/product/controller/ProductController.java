package br.com.easy_inventory.management.product.controller;

import br.com.easy_inventory.management.product.dto.CreateProductRequest;
import br.com.easy_inventory.management.product.dto.ProductResponse;
import br.com.easy_inventory.management.product.dto.UpdateProductRequest;
import br.com.easy_inventory.management.product.entity.ProductSize;
import br.com.easy_inventory.management.product.service.ProductService;
import br.com.easy_inventory.management.shared.dto.ApiResponse;
import br.com.easy_inventory.management.shared.dto.PageResponse;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/products")
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @GetMapping
    public ResponseEntity<PageResponse<ProductResponse>> list(
            @RequestParam(required = false) UUID category,
            @RequestParam(required = false) ProductSize size,
            @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        Page<ProductResponse> result = productService.findAll(category, size, active,
                PageRequest.of(page, pageSize));
        return ResponseEntity.ok(PageResponse.of(result.getContent(), page, pageSize, result.getTotalElements()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ProductResponse>> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.of(productService.findById(id)));
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<ProductResponse>> create(
            @Valid @RequestBody CreateProductRequest request) {
        var response = productService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(response));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<ProductResponse>> update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateProductRequest request) {
        return ResponseEntity.ok(ApiResponse.of(productService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<Void> deactivate(@PathVariable UUID id) {
        productService.deactivate(id);
        return ResponseEntity.noContent().build();
    }
}