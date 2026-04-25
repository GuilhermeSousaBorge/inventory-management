package br.com.easy_inventory.management.movement.service;

import br.com.easy_inventory.management.movement.dto.CreateAdjustmentRequest;
import br.com.easy_inventory.management.movement.dto.MovementResponse;
import br.com.easy_inventory.management.movement.entity.MovementType;
import br.com.easy_inventory.management.movement.repository.StockMovementRepository;
import br.com.easy_inventory.management.shared.exception.ResourceNotFoundException;
import br.com.easy_inventory.management.stock.service.StockService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class MovementService {

    private final StockMovementRepository movementRepository;
    private final StockService stockService;

    public MovementService(StockMovementRepository movementRepository, StockService stockService) {
        this.movementRepository = movementRepository;
        this.stockService = stockService;
    }

    public Page<MovementResponse> findAll(UUID ingredientId, UUID unitId, MovementType type,
                                          LocalDateTime from, LocalDateTime to, Pageable pageable) {
        return movementRepository.search(ingredientId, unitId, type, from, to, pageable)
                .map(MovementResponse::from);
    }

    public MovementResponse findById(UUID id) {
        return MovementResponse.from(movementRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Movement not found: " + id)));
    }

    @Transactional
    public MovementResponse createAdjustment(CreateAdjustmentRequest req, UUID actorUserId) {
        var movement = stockService.applyAdjustment(
                req.ingredientId(), req.unitId(),
                req.quantity(), req.direction(), req.reason(), actorUserId);
        return MovementResponse.from(movement);
    }
}
