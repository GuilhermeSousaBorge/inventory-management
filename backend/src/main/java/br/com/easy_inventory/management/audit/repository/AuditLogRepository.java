package br.com.easy_inventory.management.audit.repository;

import br.com.easy_inventory.management.audit.entity.AuditAction;
import br.com.easy_inventory.management.audit.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.UUID;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    @Query("select a from AuditLog a where " +
           "(cast(:entityType as string) is null or a.entityType = :entityType) and " +
           "(cast(:entityId as java.util.UUID) is null or a.entityId = :entityId) and " +
           "(cast(:actorId as java.util.UUID) is null or a.actor.id = :actorId) and " +
           "(cast(:action as string) is null or a.action = :action) and " +
           "(cast(:from as timestamp) is null or a.createdAt >= :from) and " +
           "(cast(:to as timestamp) is null or a.createdAt <= :to) " +
           "order by a.createdAt desc")
    Page<AuditLog> search(@Param("entityType") String entityType,
                          @Param("entityId") UUID entityId,
                          @Param("actorId") UUID actorId,
                          @Param("action") AuditAction action,
                          @Param("from") LocalDateTime from,
                          @Param("to") LocalDateTime to,
                          Pageable pageable);
}
