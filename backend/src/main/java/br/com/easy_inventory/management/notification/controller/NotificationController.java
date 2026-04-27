package br.com.easy_inventory.management.notification.controller;

import br.com.easy_inventory.management.notification.dto.NotificationResponse;
import br.com.easy_inventory.management.notification.entity.NotificationStatus;
import br.com.easy_inventory.management.notification.service.NotificationService;
import br.com.easy_inventory.management.shared.dto.ApiResponse;
import br.com.easy_inventory.management.shared.dto.PageResponse;
import br.com.easy_inventory.management.shared.security.AuthenticatedUser;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.UUID;

@RestController
@RequestMapping("/notifications")
public class NotificationController {

    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<PageResponse<NotificationResponse>> list(
            @RequestParam(required = false) NotificationStatus status,
            @RequestParam(required = false) UUID unit,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<NotificationResponse> result = service.findAll(status, unit, from, to,
                PageRequest.of(page, size));
        return ResponseEntity.ok(PageResponse.of(result.getContent(), page, size, result.getTotalElements()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<NotificationResponse>> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.of(service.findById(id)));
    }

    @PostMapping("/{id}/resolve")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<NotificationResponse>> resolve(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.of(
                service.resolveManually(id, AuthenticatedUser.currentId())));
    }
}
