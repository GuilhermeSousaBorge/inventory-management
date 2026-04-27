package br.com.easy_inventory.management.audit.controller;

import br.com.easy_inventory.management.audit.dto.AuditLogResponse;
import br.com.easy_inventory.management.audit.entity.AuditAction;
import br.com.easy_inventory.management.audit.service.AuditService;
import br.com.easy_inventory.management.shared.dto.ApiResponse;
import br.com.easy_inventory.management.shared.dto.PageResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.UUID;

@RestController
@RequestMapping("/audit-logs")
@PreAuthorize("hasRole('OWNER')")
public class AuditLogController {

    private final AuditService service;

    public AuditLogController(AuditService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<PageResponse<AuditLogResponse>> list(
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) UUID entityId,
            @RequestParam(required = false) UUID actorId,
            @RequestParam(required = false) AuditAction action,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<AuditLogResponse> result = service.findAll(entityType, entityId, actorId, action,
                from, to, PageRequest.of(page, size));
        return ResponseEntity.ok(PageResponse.of(result.getContent(), page, size, result.getTotalElements()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<AuditLogResponse>> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.of(service.findById(id)));
    }
}
