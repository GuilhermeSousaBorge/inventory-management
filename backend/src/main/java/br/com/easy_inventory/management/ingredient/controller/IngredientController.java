package br.com.easy_inventory.management.ingredient.controller;

import br.com.easy_inventory.management.ingredient.dto.*;
import br.com.easy_inventory.management.ingredient.service.IngredientService;
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
@RequestMapping("/ingredients")
public class IngredientController {

    private final IngredientService ingredientService;

    public IngredientController(IngredientService ingredientService) {
        this.ingredientService = ingredientService;
    }

    @GetMapping
    public ResponseEntity<PageResponse<IngredientResponse>> list(
            @RequestParam(required = false) UUID category,
            @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<IngredientResponse> result = ingredientService.findAll(category, active, PageRequest.of(page, size));
        return ResponseEntity.ok(PageResponse.of(result.getContent(), page, size, result.getTotalElements()));
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<IngredientResponse>> create(@Valid @RequestBody CreateIngredientRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(ingredientService.create(request)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<IngredientResponse>> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.of(ingredientService.findById(id)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<IngredientResponse>> update(@PathVariable UUID id,
                                                                   @Valid @RequestBody UpdateIngredientRequest request) {
        return ResponseEntity.ok(ApiResponse.of(ingredientService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<Void> deactivate(@PathVariable UUID id) {
        ingredientService.deactivate(id);
        return ResponseEntity.noContent().build();
    }
}
