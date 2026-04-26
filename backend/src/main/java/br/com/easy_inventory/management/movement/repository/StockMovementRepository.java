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

    @Query(value = "SELECT * FROM stock_movements WHERE " +
            "(:ingredientId IS NULL OR ingredient_id = CAST(:ingredientId AS uuid)) AND " +
            "(:unitId IS NULL OR unit_id = CAST(:unitId AS uuid)) AND " +
            "(CAST(:type AS text) IS NULL OR type = CAST(:type AS text)) AND " +
            "(CAST(:from AS timestamp) IS NULL OR created_at >= CAST(:from AS timestamp)) AND " +
            "(CAST(:to AS timestamp) IS NULL OR created_at <= CAST(:to AS timestamp)) " +
            "ORDER BY created_at DESC",
            countQuery = "SELECT count(*) FROM stock_movements WHERE " +
            "(:ingredientId IS NULL OR ingredient_id = CAST(:ingredientId AS uuid)) AND " +
            "(:unitId IS NULL OR unit_id = CAST(:unitId AS uuid)) AND " +
            "(CAST(:type AS text) IS NULL OR type = CAST(:type AS text)) AND " +
            "(CAST(:from AS timestamp) IS NULL OR created_at >= CAST(:from AS timestamp)) AND " +
            "(CAST(:to AS timestamp) IS NULL OR created_at <= CAST(:to AS timestamp))",
            nativeQuery = true)
    Page<StockMovement> search(@Param("ingredientId") UUID ingredientId,
                               @Param("unitId") UUID unitId,
                               @Param("type") String type,
                               @Param("from") LocalDateTime from,
                               @Param("to") LocalDateTime to,
                               Pageable pageable);
}
