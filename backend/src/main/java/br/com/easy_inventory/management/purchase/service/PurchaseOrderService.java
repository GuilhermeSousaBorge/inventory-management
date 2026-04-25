package br.com.easy_inventory.management.purchase.service;

import br.com.easy_inventory.management.ingredient.entity.Ingredient;
import br.com.easy_inventory.management.ingredient.repository.IngredientRepository;
import br.com.easy_inventory.management.purchase.dto.*;
import br.com.easy_inventory.management.purchase.entity.PurchaseOrder;
import br.com.easy_inventory.management.purchase.entity.PurchaseOrderItem;
import br.com.easy_inventory.management.purchase.entity.PurchaseOrderStatus;
import br.com.easy_inventory.management.purchase.repository.PurchaseOrderRepository;
import br.com.easy_inventory.management.shared.exception.BusinessException;
import br.com.easy_inventory.management.shared.exception.ResourceNotFoundException;
import br.com.easy_inventory.management.supplier.entity.Supplier;
import br.com.easy_inventory.management.supplier.repository.SupplierRepository;
import br.com.easy_inventory.management.unit.entity.Unit;
import br.com.easy_inventory.management.unit.repository.UnitRepository;
import br.com.easy_inventory.management.user.entity.User;
import br.com.easy_inventory.management.user.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Service
public class PurchaseOrderService {

    private final PurchaseOrderRepository poRepository;
    private final SupplierRepository supplierRepository;
    private final UnitRepository unitRepository;
    private final IngredientRepository ingredientRepository;
    private final UserRepository userRepository;

    public PurchaseOrderService(PurchaseOrderRepository poRepository,
                                SupplierRepository supplierRepository,
                                UnitRepository unitRepository,
                                IngredientRepository ingredientRepository,
                                UserRepository userRepository) {
        this.poRepository = poRepository;
        this.supplierRepository = supplierRepository;
        this.unitRepository = unitRepository;
        this.ingredientRepository = ingredientRepository;
        this.userRepository = userRepository;
    }

    public Page<PurchaseOrderResponse> findAll(PurchaseOrderStatus status, UUID supplierId, UUID unitId,
                                               LocalDate from, LocalDate to, Pageable pageable) {
        return poRepository.search(status, supplierId, unitId, from, to, pageable)
                .map(PurchaseOrderResponse::from);
    }

    public PurchaseOrderResponse findById(UUID id) {
        return PurchaseOrderResponse.from(getOrThrow(id));
    }

    @Transactional
    public PurchaseOrderResponse create(CreatePurchaseOrderRequest req, UUID actorUserId) {
        Supplier supplier = supplierRepository.findById(req.supplierId())
                .orElseThrow(() -> new ResourceNotFoundException("Supplier not found: " + req.supplierId()));
        if (!supplier.isActive()) {
            throw new BusinessException("Supplier is inactive");
        }
        Unit unit = unitRepository.findById(req.unitId())
                .orElseThrow(() -> new ResourceNotFoundException("Unit not found: " + req.unitId()));
        User actor = userRepository.findById(actorUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + actorUserId));

        PurchaseOrder po = new PurchaseOrder();
        po.setSupplier(supplier);
        po.setUnit(unit);
        po.setNotes(req.notes());
        po.setExpectedAt(req.expectedAt());
        po.setCreatedBy(actor);

        attachItems(po, req.items());

        return PurchaseOrderResponse.from(poRepository.save(po));
    }

    @Transactional
    public PurchaseOrderResponse update(UUID id, UpdatePurchaseOrderRequest req) {
        PurchaseOrder po = getOrThrow(id);
        if (po.getStatus() != PurchaseOrderStatus.PENDING) {
            throw new BusinessException("Only pending purchase orders can be edited");
        }
        Supplier supplier = supplierRepository.findById(req.supplierId())
                .orElseThrow(() -> new ResourceNotFoundException("Supplier not found: " + req.supplierId()));
        if (!supplier.isActive()) {
            throw new BusinessException("Supplier is inactive");
        }
        Unit unit = unitRepository.findById(req.unitId())
                .orElseThrow(() -> new ResourceNotFoundException("Unit not found: " + req.unitId()));

        po.setSupplier(supplier);
        po.setUnit(unit);
        po.setNotes(req.notes());
        po.setExpectedAt(req.expectedAt());
        po.clearItems();
        attachItems(po, req.items());

        return PurchaseOrderResponse.from(poRepository.save(po));
    }

    private void attachItems(PurchaseOrder po, java.util.List<PurchaseOrderItemRequest> items) {
        Set<UUID> seen = new HashSet<>();
        BigDecimal total = BigDecimal.ZERO;
        for (PurchaseOrderItemRequest it : items) {
            if (!seen.add(it.ingredientId())) {
                throw new BusinessException("Duplicate ingredient in purchase order: " + it.ingredientId());
            }
            Ingredient ing = ingredientRepository.findById(it.ingredientId())
                    .orElseThrow(() -> new ResourceNotFoundException("Ingredient not found: " + it.ingredientId()));
            if (!ing.isActive()) {
                throw new BusinessException("Ingredient is inactive: " + ing.getName());
            }
            PurchaseOrderItem poi = new PurchaseOrderItem();
            poi.setIngredient(ing);
            poi.setQuantity(it.quantity());
            poi.setUnitPrice(it.unitPrice());
            po.addItem(poi);
            total = total.add(it.quantity().multiply(it.unitPrice()));
        }
        po.setTotalCost(total);
    }

    PurchaseOrder getOrThrow(UUID id) {
        return poRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase order not found: " + id));
    }
}