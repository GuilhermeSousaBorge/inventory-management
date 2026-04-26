package br.com.easy_inventory.management.order.service;

import br.com.easy_inventory.management.order.dto.*;
import br.com.easy_inventory.management.order.entity.Order;
import br.com.easy_inventory.management.order.entity.OrderItem;
import br.com.easy_inventory.management.order.entity.OrderStatus;
import br.com.easy_inventory.management.order.repository.OrderRepository;
import br.com.easy_inventory.management.product.entity.Product;
import br.com.easy_inventory.management.product.repository.ProductRepository;
import br.com.easy_inventory.management.shared.exception.BusinessException;
import br.com.easy_inventory.management.shared.exception.ResourceNotFoundException;
import br.com.easy_inventory.management.stock.service.StockService;
import br.com.easy_inventory.management.unit.entity.Unit;
import br.com.easy_inventory.management.unit.repository.UnitRepository;
import br.com.easy_inventory.management.user.entity.User;
import br.com.easy_inventory.management.user.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final UnitRepository unitRepository;
    private final UserRepository userRepository;
    private final StockService stockService;

    public OrderService(OrderRepository orderRepository,
                        ProductRepository productRepository,
                        UnitRepository unitRepository,
                        UserRepository userRepository,
                        StockService stockService) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.unitRepository = unitRepository;
        this.userRepository = userRepository;
        this.stockService = stockService;
    }

    // ----- READ -----

    public Page<OrderResponse> findAll(UUID unitId, OrderStatus status,
                                       LocalDateTime from, LocalDateTime to, Pageable pageable) {
        return orderRepository.search(unitId, status, from, to, pageable)
                .map(OrderResponse::from);
    }

    public OrderResponse findById(UUID id) {
        return OrderResponse.from(getOrThrow(id));
    }

    // ----- CREATE -----

    @Transactional
    public OrderResponse create(CreateOrderRequest req, UUID actorUserId) {
        Unit unit = unitRepository.findById(req.unitId())
                .orElseThrow(() -> new ResourceNotFoundException("Unit not found: " + req.unitId()));
        User actor = userRepository.findById(actorUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + actorUserId));

        Order order = new Order();
        order.setUnit(unit);
        order.setNotes(req.notes());
        order.setCreatedBy(actor);

        attachItems(order, req.items());

        return OrderResponse.from(orderRepository.save(order));
    }

    // ----- UPDATE -----

    @Transactional
    public OrderResponse update(UUID id, UpdateOrderRequest req) {
        Order order = getOrThrow(id);
        if (order.getStatus() != OrderStatus.PENDING) {
            throw new BusinessException("Only pending orders can be edited");
        }
        Unit unit = unitRepository.findById(req.unitId())
                .orElseThrow(() -> new ResourceNotFoundException("Unit not found: " + req.unitId()));

        order.setUnit(unit);
        order.setNotes(req.notes());
        order.clearItems();
        attachItems(order, req.items());

        return OrderResponse.from(orderRepository.save(order));
    }

    // ----- STATE TRANSITIONS -----

    @Transactional
    public OrderResponse start(UUID id, UUID actorUserId) {
        Order order = getOrThrow(id);
        if (order.getStatus() != OrderStatus.PENDING) {
            throw new BusinessException("Only pending orders can be started");
        }

        Map<UUID, BigDecimal> ingredientTotals = new HashMap<>();
        for (OrderItem item : order.getItems()) {
            Product product = item.getProduct();
            for (var pi : product.getIngredients()) {
                UUID ingredientId = pi.getIngredient().getId();
                BigDecimal needed = pi.getQuantity().multiply(BigDecimal.valueOf(item.getQuantity()));
                ingredientTotals.merge(ingredientId, needed, BigDecimal::add);
            }
        }

        UUID unitId = order.getUnit().getId();
        for (Map.Entry<UUID, BigDecimal> entry : ingredientTotals.entrySet()) {
            stockService.applyExit(
                    entry.getKey(),
                    unitId,
                    entry.getValue(),
                    "Order #" + order.getId(),
                    actorUserId
            );
        }

        order.setStatus(OrderStatus.IN_PROGRESS);
        order.setStartedAt(LocalDateTime.now());
        return OrderResponse.from(orderRepository.save(order));
    }

    @Transactional
    public OrderResponse complete(UUID id) {
        Order order = getOrThrow(id);
        if (order.getStatus() != OrderStatus.IN_PROGRESS) {
            throw new BusinessException("Only in-progress orders can be completed");
        }
        order.setStatus(OrderStatus.COMPLETED);
        order.setCompletedAt(LocalDateTime.now());
        return OrderResponse.from(orderRepository.save(order));
    }

    @Transactional
    public OrderResponse cancel(UUID id) {
        Order order = getOrThrow(id);
        if (order.getStatus() != OrderStatus.PENDING) {
            throw new BusinessException("Only pending orders can be canceled");
        }
        order.setStatus(OrderStatus.CANCELED);
        order.setCanceledAt(LocalDateTime.now());
        return OrderResponse.from(orderRepository.save(order));
    }

    // ----- PRIVATE -----

    private void attachItems(Order order, List<OrderItemRequest> items) {
        Set<UUID> seen = new HashSet<>();
        BigDecimal total = BigDecimal.ZERO;
        for (OrderItemRequest it : items) {
            if (!seen.add(it.productId())) {
                throw new BusinessException("Duplicate product in order: " + it.productId());
            }
            Product product = productRepository.findById(it.productId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + it.productId()));
            if (!product.isActive()) {
                throw new BusinessException("Product is inactive: " + product.getName());
            }
            OrderItem oi = new OrderItem();
            oi.setProduct(product);
            oi.setQuantity(it.quantity());
            oi.setUnitPrice(product.getPrice());
            order.addItem(oi);
            total = total.add(product.getPrice().multiply(BigDecimal.valueOf(it.quantity())));
        }
        order.setTotalPrice(total);
    }

    Order getOrThrow(UUID id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + id));
    }
}