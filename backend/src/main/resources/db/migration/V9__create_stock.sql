CREATE TABLE stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    unit_id UUID NOT NULL REFERENCES unit(id),
    quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_stock_ingredient_unit UNIQUE (ingredient_id, unit_id)
);

CREATE INDEX idx_stock_ingredient ON stock (ingredient_id);
CREATE INDEX idx_stock_unit ON stock(unit_id);