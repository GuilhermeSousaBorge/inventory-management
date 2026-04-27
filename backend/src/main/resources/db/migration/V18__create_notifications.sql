CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(30) NOT NULL CHECK (type IN ('LOW_STOCK')),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RESOLVED')),
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    unit_id UUID NOT NULL REFERENCES units(id),
    message VARCHAR(255) NOT NULL,
    triggered_quantity DECIMAL(12,3) NOT NULL,
    min_quantity DECIMAL(12,3) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP,
    resolved_by UUID REFERENCES users(id)
);

CREATE INDEX idx_notifications_status_created ON notifications(status, created_at DESC);
CREATE INDEX idx_notifications_ingredient_unit_status ON notifications(ingredient_id, unit_id, status);

CREATE UNIQUE INDEX uq_notification_active_per_ingredient_unit
    ON notifications(ingredient_id, unit_id, type)
    WHERE status = 'ACTIVE';
