package br.com.easy_inventory.management.movement.controller;

import br.com.easy_inventory.management.movement.dto.CreateAdjustmentRequest;
import br.com.easy_inventory.management.movement.dto.MovementResponse;
import br.com.easy_inventory.management.movement.entity.MovementType;
import br.com.easy_inventory.management.movement.service.MovementService;
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
@RequestMapping("/stock-movements")
public class MovementController {


    private final MovementService movementService;

    public MovementController(MovementService movementService) {
        this.movementService = movementService;
    }

    @GetMapping
    public ResponseEntity<PageResponse<MovementResponse>> list(
            @RequestParam(required = false) UUID ingredient,
            @RequestParam(required = false) UUID unit,
            @RequestParam(required = false) MovementType type,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<MovementResponse> result = movementService.findAll(ingredient, unit, type, from, to,
                PageRequest.of(page, size));
        return ResponseEntity.ok(PageResponse.of(result.getContent(), page, size, result.getTotalElements()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<MovementResponse>> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.of(movementService.findById(id)));
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<MovementResponse>> createAdjustment(
            @Valid @RequestBody CreateAdjustmentRequest request) {
        var response = movementService.createAdjustment(request, AuthenticatedUser.currentId());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(response));
    }
}
