package br.com.easy_inventory.management.notification.repository;

import br.com.easy_inventory.management.notification.entity.Notification;
import br.com.easy_inventory.management.notification.entity.NotificationStatus;
import br.com.easy_inventory.management.notification.entity.NotificationType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    @Query("select n from Notification n " +
           "where n.ingredient.id = :ingredientId " +
           "  and n.unit.id = :unitId " +
           "  and n.type = :type " +
           "  and n.status = br.com.easy_inventory.management.notification.entity.NotificationStatus.ACTIVE")
    Optional<Notification> findActive(@Param("ingredientId") UUID ingredientId,
                                      @Param("unitId") UUID unitId,
                                      @Param("type") NotificationType type);

    @Query("select n from Notification n where " +
           "(:status is null or n.status = :status) and " +
           "(:unitId is null or n.unit.id = :unitId) and " +
           "(cast(:from as timestamp) is null or n.createdAt >= :from) and " +
           "(cast(:to as timestamp) is null or n.createdAt <= :to) " +
           "order by n.createdAt desc")
    Page<Notification> search(@Param("status") NotificationStatus status,
                              @Param("unitId") UUID unitId,
                              @Param("from") LocalDateTime from,
                              @Param("to") LocalDateTime to,
                              Pageable pageable);
}
