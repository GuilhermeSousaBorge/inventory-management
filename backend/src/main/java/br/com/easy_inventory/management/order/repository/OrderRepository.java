package br.com.easy_inventory.management.order.repository;

import br.com.easy_inventory.management.order.entity.Order;
import br.com.easy_inventory.management.order.entity.OrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID> {
    @Query("select o from Order o where " +
            "(:unitId is null or o.unit.id = :unitId) and " +
            "(:status is null or o.status = :status) and " +
            "(:from is null or o.createdAt >= :from) and " +
            "(:to is null or o.createdAt <= :to) " +
            "order by o.createdAt desc")
    Page<Order> search(@Param("unitId") UUID unitId,
                       @Param("status") OrderStatus status,
                       @Param("from") LocalDateTime from,
                       @Param("to") LocalDateTime to,
                       Pageable pageable);
}
