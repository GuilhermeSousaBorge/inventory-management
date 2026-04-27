package br.com.easy_inventory.management.audit.dto;

import br.com.easy_inventory.management.audit.entity.AuditAction;
import br.com.easy_inventory.management.audit.entity.AuditLog;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

public record AuditLogResponse(
        UUID id,
        AuditAction action,
        String entityType,
        UUID entityId,
        UUID actorId,
        String actorName,
        Map<String, Object> details,
        LocalDateTime createdAt
) {
    public static AuditLogResponse from(AuditLog log) {
        return new AuditLogResponse(
                log.getId(),
                log.getAction(),
                log.getEntityType(),
                log.getEntityId(),
                log.getActor().getId(),
                log.getActor().getName(),
                log.getDetails(),
                log.getCreatedAt()
        );
    }
}
