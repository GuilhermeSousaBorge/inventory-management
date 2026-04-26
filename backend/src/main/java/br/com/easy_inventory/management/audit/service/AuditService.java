package br.com.easy_inventory.management.audit.service;

import br.com.easy_inventory.management.audit.dto.AuditLogResponse;
import br.com.easy_inventory.management.audit.entity.AuditAction;
import br.com.easy_inventory.management.audit.entity.AuditLog;
import br.com.easy_inventory.management.audit.repository.AuditLogRepository;
import br.com.easy_inventory.management.shared.exception.ResourceNotFoundException;
import br.com.easy_inventory.management.user.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Service
public class AuditService {

    private final AuditLogRepository repo;
    private final UserRepository userRepo;

    public AuditService(AuditLogRepository repo, UserRepository userRepo) {
        this.repo = repo;
        this.userRepo = userRepo;
    }

    public Page<AuditLogResponse> findAll(String entityType, UUID entityId, UUID actorId,
                                          AuditAction action, LocalDateTime from, LocalDateTime to,
                                          Pageable pageable) {
        return repo.search(entityType, entityId, actorId, action, from, to, pageable)
                .map(AuditLogResponse::from);
    }

    public AuditLogResponse findById(UUID id) {
        return AuditLogResponse.from(
                repo.findById(id).orElseThrow(() -> new ResourceNotFoundException("AuditLog not found: " + id)));
    }

    @Transactional
    public void log(AuditAction action, String entityType, UUID entityId,
                    UUID actorId, Map<String, Object> details) {
        AuditLog entry = new AuditLog();
        entry.setAction(action);
        entry.setEntityType(entityType);
        entry.setEntityId(entityId);
        entry.setActor(userRepo.getReferenceById(actorId));
        entry.setDetails(details);
        repo.save(entry);
    }
}
