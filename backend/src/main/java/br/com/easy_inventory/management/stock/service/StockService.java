package br.com.easy_inventory.management.stock.service;

import br.com.easy_inventory.management.ingredient.entity.Ingredient;
import br.com.easy_inventory.management.ingredient.repository.IngredientRepository;
import br.com.easy_inventory.management.shared.exception.BusinessException;
import br.com.easy_inventory.management.shared.exception.ResourceNotFoundException;
import br.com.easy_inventory.management.stock.dto.StockResponse;
import br.com.easy_inventory.management.stock.entity.Stock;
import br.com.easy_inventory.management.stock.repository.StockRepository;
import br.com.easy_inventory.management.unit.entity.Unit;
import br.com.easy_inventory.management.unit.repository.UnitRepository;
import br.com.easy_inventory.management.user.entity.User;
import br.com.easy_inventory.management.user.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;

@Service
public class StockService {

    private final StockRepository stockRepository;
    private final StockMovementRepository movementRepository;
    private final IngredientRepository ingredientRepository;
    private final UnitRepository unitRepository;
    private final UserRepository userRepository;
    private final EntityManager entityManager;

    public StockService(StockRepository stockRepository,
                        StockMovementRepository movementRepository,
                        IngredientRepository ingredientRepository,
                        UnitRepository unitRepository,
                        UserRepository userRepository,
                        EntityManager entityManager) {
        this.stockRepository = stockRepository;
        this.movementRepository = movementRepository;
        this.ingredientRepository = ingredientRepository;
        this.unitRepository = unitRepository;
        this.userRepository = userRepository;
        this.entityManager = entityManager;
    }

    // ----- READ -----

    public Page<StockResponse> findAll(UUID unitId, UUID ingredientId, Pageable pageable) {
        Page<Stock> page;
        if (unitId != null && ingredientId != null) {
            page = stockRepository.findByIngredientIdAndUnitId(ingredientId, unitId, pageable);
        } else if (unitId != null) {
            page = stockRepository.findByUnitId(unitId, pageable);
        } else if (ingredientId != null) {
            page = stockRepository.findByIngredientId(ingredientId, pageable);
        } else {
            page = stockRepository.findAll(pageable);
        }
        return page.map(StockResponse::from);
    }

    public StockResponse findById(UUID id) {
        return StockResponse.from(getOrThrow(id));
    }

    public Page<StockResponse> findBelowMinimum(Pageable pageable) {
        return stockRepository.findBelowMinimum(pageable).map(StockResponse::from);
    }

    // ----- WRITE -----

    @Transactional
    public StockMovement applyEntry(UUID ingredientId, UUID unitId,
                                    BigDecimal quantity, BigDecimal unitPrice,
                                    UUID purchaseOrderId, UUID actorUserId) {
        if (quantity == null || quantity.signum() <= 0) {
            throw new BusinessException("Entry quantity must be positive");
        }
        if (unitPrice == null || unitPrice.signum() < 0) {
            throw new BusinessException("Entry unit price must be non-negative");
        }

        Ingredient ing = ingredientRepository.findById(ingredientId)
                .orElseThrow(() -> new ResourceNotFoundException("Ingredient not found: " + ingredientId));
        Unit unit = unitRepository.findById(unitId)
                .orElseThrow(() -> new ResourceNotFoundException("Unit not found: " + unitId));
        User actor = userRepository.findById(actorUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + actorUserId));

        Stock stock = lockOrCreate(ing, unit);

        BigDecimal currentQty = stock.getQuantity();
        BigDecimal currentAvg = ing.getAverageCost() == null ? BigDecimal.ZERO : ing.getAverageCost();

        BigDecimal newQty = currentQty.add(quantity);
        BigDecimal newAvg = currentQty.multiply(currentAvg)
                .add(quantity.multiply(unitPrice))
                .divide(newQty, 4, RoundingMode.HALF_UP);

        stock.setQuantity(newQty);
        ing.setAverageCost(newAvg);

        stockRepository.save(stock);
        ingredientRepository.save(ing);

        StockMovement mv = new StockMovement();
        mv.setIngredient(ing);
        mv.setUnit(unit);
        mv.setType(MovementType.ENTRY);
        mv.setQuantity(quantity);
        mv.setUnitPrice(unitPrice);
        mv.setPurchaseOrderId(purchaseOrderId);
        mv.setCreatedBy(actor);
        return movementRepository.save(mv);
    }

    @Transactional
    public StockMovement applyExit(UUID ingredientId, UUID unitId,
                                   BigDecimal quantity, String reason, UUID actorUserId) {
        if (quantity == null || quantity.signum() <= 0) {
            throw new BusinessException("Exit quantity must be positive");
        }

        Ingredient ing = ingredientRepository.findById(ingredientId)
                .orElseThrow(() -> new ResourceNotFoundException("Ingredient not found: " + ingredientId));
        Unit unit = unitRepository.findById(unitId)
                .orElseThrow(() -> new ResourceNotFoundException("Unit not found: " + unitId));
        User actor = userRepository.findById(actorUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + actorUserId));

        Stock stock = lockOrCreate(ing, unit);

        if (stock.getQuantity().compareTo(quantity) < 0) {
            throw new BusinessException("Insufficient stock: available="
                    + stock.getQuantity() + ", requested=" + quantity);
        }

        stock.setQuantity(stock.getQuantity().subtract(quantity));
        stockRepository.save(stock);

        StockMovement mv = new StockMovement();
        mv.setIngredient(ing);
        mv.setUnit(unit);
        mv.setType(MovementType.EXIT);
        mv.setQuantity(quantity);
        mv.setReason(reason);
        mv.setCreatedBy(actor);
        return movementRepository.save(mv);
    }

    @Transactional
    public StockMovement applyAdjustment(UUID ingredientId, UUID unitId,
                                         BigDecimal quantity, AdjustmentDirection direction,
                                         String reason, UUID actorUserId) {
        if (quantity == null || quantity.signum() <= 0) {
            throw new BusinessException("Adjustment quantity must be positive");
        }
        if (direction == null) {
            throw new BusinessException("Adjustment direction required");
        }
        if (reason == null || reason.isBlank()) {
            throw new BusinessException("Adjustment reason required");
        }

        Ingredient ing = ingredientRepository.findById(ingredientId)
                .orElseThrow(() -> new ResourceNotFoundException("Ingredient not found: " + ingredientId));
        Unit unit = unitRepository.findById(unitId)
                .orElseThrow(() -> new ResourceNotFoundException("Unit not found: " + unitId));
        User actor = userRepository.findById(actorUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + actorUserId));

        Stock stock = lockOrCreate(ing, unit);

        BigDecimal newQty = direction == AdjustmentDirection.INCREASE
                ? stock.getQuantity().add(quantity)
                : stock.getQuantity().subtract(quantity);

        if (newQty.signum() < 0) {
            throw new BusinessException("Adjustment would result in negative stock");
        }
        stock.setQuantity(newQty);
        stockRepository.save(stock);

        StockMovement mv = new StockMovement();
        mv.setIngredient(ing);
        mv.setUnit(unit);
        mv.setType(MovementType.ADJUSTMENT);
        mv.setQuantity(quantity);
        mv.setReason(reason);
        mv.setCreatedBy(actor);
        return movementRepository.save(mv);
    }

    // Handles first-time upsert race: concurrent inserts for same (ingredient, unit).
    private Stock lockOrCreate(Ingredient ing, Unit unit) {
        return stockRepository.findForUpdate(ing.getId(), unit.getId())
                .orElseGet(() -> {
                    Stock s = new Stock(ing, unit, BigDecimal.ZERO);
                    try {
                        stockRepository.saveAndFlush(s);
                        // Re-read with lock so we return a locked entity.
                        entityManager.detach(s);
                        return stockRepository.findForUpdate(ing.getId(), unit.getId())
                                .orElseThrow();
                    } catch (DataIntegrityViolationException race) {
                        return stockRepository.findForUpdate(ing.getId(), unit.getId())
                                .orElseThrow();
                    }
                });
    }

    private Stock getOrThrow(UUID id) {
        return stockRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Stock not found: " + id));
    }
}
