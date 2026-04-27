package br.com.easy_inventory.management.unit.service;

import br.com.easy_inventory.management.audit.entity.AuditAction;
import br.com.easy_inventory.management.audit.service.AuditService;
import br.com.easy_inventory.management.shared.exception.ResourceNotFoundException;
import br.com.easy_inventory.management.unit.dto.*;
import br.com.easy_inventory.management.unit.entity.Unit;
import br.com.easy_inventory.management.unit.repository.UnitRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class UnitService {

    private final UnitRepository unitRepository;
    private final AuditService auditService;

    public UnitService(UnitRepository unitRepository, AuditService auditService) {
        this.unitRepository = unitRepository;
        this.auditService = auditService;
    }

    public Page<UnitResponse> findAll(Pageable pageable) {
        return unitRepository.findAll(pageable).map(UnitResponse::from);
    }

    public UnitResponse findById(UUID id) {
        return UnitResponse.from(getOrThrow(id));
    }

    @Transactional
    public UnitResponse create(CreateUnitRequest request, UUID actorUserId) {
        Unit unit = new Unit();
        unit.setName(request.name());
        unit.setAddress(request.address());
        Unit saved = unitRepository.save(unit);

        auditService.log(AuditAction.UNIT_CREATED, "Unit", saved.getId(), actorUserId,
                Map.of("name", saved.getName()));
        return UnitResponse.from(saved);
    }

    @Transactional
    public UnitResponse update(UUID id, UpdateUnitRequest request, UUID actorUserId) {
        Unit unit = getOrThrow(id);

        Map<String, Object> before = new HashMap<>();
        before.put("name", unit.getName());
        before.put("address", unit.getAddress());
        before.put("active", unit.isActive());

        unit.setName(request.name());
        unit.setAddress(request.address());
        unit.setActive(request.active());
        Unit saved = unitRepository.save(unit);

        Map<String, Object> after = new HashMap<>();
        after.put("name", saved.getName());
        after.put("address", saved.getAddress());
        after.put("active", saved.isActive());

        auditService.log(AuditAction.UNIT_UPDATED, "Unit", saved.getId(), actorUserId,
                Map.of("before", before, "after", after));
        return UnitResponse.from(saved);
    }

    @Transactional
    public void deactivate(UUID id, UUID actorUserId) {
        Unit unit = getOrThrow(id);
        unit.setActive(false);
        unitRepository.save(unit);
        auditService.log(AuditAction.UNIT_DEACTIVATED, "Unit", id, actorUserId, null);
    }

    private Unit getOrThrow(UUID id) {
        return unitRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Unit not found: " + id));
    }
}
