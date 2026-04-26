package br.com.easy_inventory.management.notification.listener;

import br.com.easy_inventory.management.notification.service.NotificationService;
import br.com.easy_inventory.management.shared.event.StockChangedEvent;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class StockLevelListener {

    private final NotificationService notificationService;

    public StockLevelListener(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onStockChanged(StockChangedEvent ev) {
        if (ev.newQuantity().compareTo(ev.minQuantity()) <= 0) {
            notificationService.raiseLowStock(ev);
        } else {
            notificationService.autoResolveLowStock(ev.ingredientId(), ev.unitId());
        }
    }
}
