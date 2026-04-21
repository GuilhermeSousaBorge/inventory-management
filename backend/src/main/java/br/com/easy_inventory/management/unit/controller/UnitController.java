package br.com.easy_inventory.management.unit.controller;

import br.com.easy_inventory.management.shared.dto.ApiResponse;
import br.com.easy_inventory.management.shared.dto.PageResponse;
import br.com.easy_inventory.management.unit.dto.*;
import br.com.easy_inventory.management.unit.service.UnitService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/units")
public class UnitController {

    private final UnitService unitService;

    public UnitController(UnitService unitService) {
        this.unitService = unitService;
    }

    @GetMapping
    public ResponseEntity<PageResponse<UnitResponse>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<UnitResponse> result = unitService.findAll(PageRequest.of(page, size));
        return ResponseEntity.ok(PageResponse.of(result.getContent(), page, size, result.getTotalElements()));
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<UnitResponse>> create(@Valid @RequestBody CreateUnitRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(unitService.create(request)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<UnitResponse>> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.of(unitService.findById(id)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<UnitResponse>> update(@PathVariable UUID id,
                                                             @Valid @RequestBody UpdateUnitRequest request) {
        return ResponseEntity.ok(ApiResponse.of(unitService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<Void> deactivate(@PathVariable UUID id) {
        unitService.deactivate(id);
        return ResponseEntity.noContent().build();
    }
}
