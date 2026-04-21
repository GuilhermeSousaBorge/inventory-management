package br.com.easy_inventory.management.unit.service;

import br.com.easy_inventory.management.shared.exception.ResourceNotFoundException;
import br.com.easy_inventory.management.unit.dto.*;
import br.com.easy_inventory.management.unit.entity.Unit;
import br.com.easy_inventory.management.unit.repository.UnitRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class UnitService {

    private final UnitRepository unitRepository;

    public UnitService(UnitRepository unitRepository) {
        this.unitRepository = unitRepository;
    }

    public Page<UnitResponse> findAll(Pageable pageable) {
        return unitRepository.findAll(pageable).map(UnitResponse::from);
    }

    public UnitResponse findById(UUID id) {
        return UnitResponse.from(getOrThrow(id));
    }

    @Transactional
    public UnitResponse create(CreateUnitRequest request) {
        Unit unit = new Unit();
        unit.setName(request.name());
        unit.setAddress(request.address());
        return UnitResponse.from(unitRepository.save(unit));
    }

    @Transactional
    public UnitResponse update(UUID id, UpdateUnitRequest request) {
        Unit unit = getOrThrow(id);
        unit.setName(request.name());
        unit.setAddress(request.address());
        unit.setActive(request.active());
        return UnitResponse.from(unitRepository.save(unit));
    }

    @Transactional
    public void deactivate(UUID id) {
        Unit unit = getOrThrow(id);
        unit.setActive(false);
        unitRepository.save(unit);
    }

    private Unit getOrThrow(UUID id) {
        return unitRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Unit not found: " + id));
    }
}
