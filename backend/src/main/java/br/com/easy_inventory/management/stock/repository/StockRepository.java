package br.com.easy_inventory.management.stock.repository;

import br.com.easy_inventory.management.stock.entity.Stock;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface StockRepository extends JpaRepository<Stock, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Stock s " +
            "where s.ingredient.id = :ingredientId and s.unit.id = :unitId")
    Optional<Stock> findForUpdate(@Param("ingredientId") UUID ingredientId,
                                  @Param("unitId") UUID unitId);

    Optional<Stock> findByIngredientIdAndUnitId(UUID ingredientId, UUID unitId);

    Page<Stock> findByUnitId(UUID unitId, Pageable pageable);
    Page<Stock> findByIngredientId(UUID ingredientId, Pageable pageable);
    Page<Stock> findByIngredientIdAndUnitId(UUID ingredientId, UUID unitId, Pageable pageable);

    @Query("select s from Stock s where s.quantity < s.ingredient.minimumQty")
    Page<Stock> findBelowMinimum(Pageable pageable);
}
