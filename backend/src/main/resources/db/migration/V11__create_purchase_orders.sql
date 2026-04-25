CREATE TABLE purchase_orders (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     supplier_id UUID NOT NULL REFERENCES suppliers(id),
     unit_id UUID NOT NULL REFERENCES units(id),
     status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'RECEIVED', 'CANCELED')),
     total_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
     notes VARCHAR(500),
     expected_at DATE,
     received_at TIMESTAMP,
     canceled_at TIMESTAMP,
     created_by UUID NOT NULL REFERENCES users(id),
     created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_po_status ON purchase_orders(status);
CREATE INDEX idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_po_unit ON purchase_orders(unit_id);

ALTER TABLE stock_movements
    ADD CONSTRAINT fk_movements_po
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id);