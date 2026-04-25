package br.com.easy_inventory.management.movement.repository;

import br.com.easy_inventory.management.movement.entity.MovementType;
import br.com.easy_inventory.management.movement.entity.StockMovement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.UUID;

public interface StockMovementRepository extends JpaRepository<StockMovement, UUID> {

    @Query("select m from StockMovement m where " +
            "(:ingredientId is null or m.ingredient.id = :ingredientId) and " +
            "(:unitId is null or m.unit.id = :unitId) and " +
            "(:type is null or m.type = :type) and " +
            "(:from is null or m.createdAt >= :from) and " +
            "(:to is null or m.createdAt <= :to) " +
            "order by m.createdAt desc")
    Page<StockMovement> search(@Param("ingredientId") UUID ingredientId,
                               @Param("unitId") UUID unitId,
                               @Param("type") MovementType type,
                               @Param("from") LocalDateTime from,
                               @Param("to") LocalDateTime to,
                               Pageable pageable);
}
