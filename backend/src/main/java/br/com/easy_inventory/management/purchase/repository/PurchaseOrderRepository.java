package br.com.easy_inventory.management.purchase.repository;

import br.com.easy_inventory.management.purchase.entity.PurchaseOrder;
import br.com.easy_inventory.management.purchase.entity.PurchaseOrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.UUID;

public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, UUID> {

    @Query("select p from PurchaseOrder p where " +
            "(:status is null or p.status = :status) and " +
            "(:supplierId is null or p.supplier.id = :supplierId) and " +
            "(:unitId is null or p.unit.id = :unitId) and " +
            "(:from is null or p.expectedAt >= :from) and " +
            "(:to is null or p.expectedAt <= :to) " +
            "order by p.createdAt desc")
    Page<PurchaseOrder> search(@Param("status") PurchaseOrderStatus status,
                               @Param("supplierId") UUID supplierId,
                               @Param("unitId") UUID unitId,
                               @Param("from") LocalDate from,
                               @Param("to") LocalDate to,
                               Pageable pageable);
}