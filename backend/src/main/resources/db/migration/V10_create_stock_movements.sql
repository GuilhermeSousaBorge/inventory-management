CREATE TABLE stock_movements (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     ingredient_id UUID NOT NULL REFERENCES ingredients(id),
     unit_id UUID NOT NULL REFERENCES units(id),
     type VARCHAR(20) NOT NULL CHECK (type IN ('ENTRY', 'EXIT', 'ADJUSTMENT')),
     quantity DECIMAL(10,3) NOT NULL CHECK (quantity > 0),
     unit_price DECIMAL(10,4),
     reason VARCHAR(255),
     purchase_order_id UUID,
     created_by UUID NOT NULL REFERENCES users(id),
     created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_movements_ingredient_unit_date
    ON stock_movements(ingredient_id, unit_id, created_at DESC);
CREATE INDEX idx_movements_po ON stock_movements(purchase_order_id);
CREATE INDEX idx_movements_type ON stock_movements(type);