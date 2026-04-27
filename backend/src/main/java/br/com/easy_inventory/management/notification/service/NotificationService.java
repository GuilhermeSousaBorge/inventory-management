package br.com.easy_inventory.management.notification.service;

import br.com.easy_inventory.management.ingredient.entity.Ingredient;
import br.com.easy_inventory.management.ingredient.repository.IngredientRepository;
import br.com.easy_inventory.management.notification.dto.NotificationResponse;
import br.com.easy_inventory.management.notification.entity.Notification;
import br.com.easy_inventory.management.notification.entity.NotificationStatus;
import br.com.easy_inventory.management.notification.entity.NotificationType;
import br.com.easy_inventory.management.notification.repository.NotificationRepository;
import br.com.easy_inventory.management.shared.event.StockChangedEvent;
import br.com.easy_inventory.management.shared.exception.BusinessException;
import br.com.easy_inventory.management.shared.exception.ResourceNotFoundException;
import br.com.easy_inventory.management.unit.entity.Unit;
import br.com.easy_inventory.management.unit.repository.UnitRepository;
import br.com.easy_inventory.management.user.repository.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class NotificationService {

    private final NotificationRepository repo;
    private final IngredientRepository ingredientRepo;
    private final UnitRepository unitRepo;
    private final UserRepository userRepo;

    public NotificationService(NotificationRepository repo,
                               IngredientRepository ingredientRepo,
                               UnitRepository unitRepo,
                               UserRepository userRepo) {
        this.repo = repo;
        this.ingredientRepo = ingredientRepo;
        this.unitRepo = unitRepo;
        this.userRepo = userRepo;
    }

    public Page<NotificationResponse> findAll(NotificationStatus status, UUID unitId,
                                              LocalDateTime from, LocalDateTime to,
                                              Pageable pageable) {
        return repo.search(status, unitId, from, to, pageable).map(NotificationResponse::from);
    }

    public NotificationResponse findById(UUID id) {
        return NotificationResponse.from(getOrThrow(id));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void raiseLowStock(StockChangedEvent ev) {
        Ingredient ing = ingredientRepo.findById(ev.ingredientId())
                .orElseThrow(() -> new ResourceNotFoundException("Ingredient not found: " + ev.ingredientId()));
        Unit unit = unitRepo.findById(ev.unitId())
                .orElseThrow(() -> new ResourceNotFoundException("Unit not found: " + ev.unitId()));

        Notification n = new Notification();
        n.setType(NotificationType.LOW_STOCK);
        n.setStatus(NotificationStatus.ACTIVE);
        n.setIngredient(ing);
        n.setUnit(unit);
        n.setTriggeredQuantity(ev.newQuantity());
        n.setMinQuantity(ev.minQuantity());
        n.setMessage(buildLowStockMessage(ing, unit, ev));

        try {
            repo.saveAndFlush(n);
        } catch (DataIntegrityViolationException e) {
            // partial unique index: an ACTIVE notification already exists — ignore
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void autoResolveLowStock(UUID ingredientId, UUID unitId) {
        repo.findActive(ingredientId, unitId, NotificationType.LOW_STOCK)
            .ifPresent(n -> {
                n.setStatus(NotificationStatus.RESOLVED);
                n.setResolvedAt(LocalDateTime.now());
            });
    }

    @Transactional
    public NotificationResponse resolveManually(UUID notificationId, UUID actorUserId) {
        Notification n = getOrThrow(notificationId);
        if (n.getStatus() != NotificationStatus.ACTIVE) {
            throw new BusinessException("Notification is not active");
        }
        n.setStatus(NotificationStatus.RESOLVED);
        n.setResolvedAt(LocalDateTime.now());
        n.setResolvedBy(userRepo.getReferenceById(actorUserId));
        return NotificationResponse.from(n);
    }

    private String buildLowStockMessage(Ingredient ing, Unit unit, StockChangedEvent ev) {
        return ing.getName() + " abaixo do mínimo na unidade " + unit.getName() + ": "
                + ev.newQuantity() + " " + ing.getUnitOfMeasure() + " \u2264 "
                + ev.minQuantity() + " " + ing.getUnitOfMeasure();
    }

    Notification getOrThrow(UUID id) {
        return repo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found: " + id));
    }
}
