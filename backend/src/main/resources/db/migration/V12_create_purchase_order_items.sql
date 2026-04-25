CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id),
  quantity DECIMAL(10,3) NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,4) NOT NULL CHECK (unit_price >= 0),
  CONSTRAINT uq_po_item_ingredient UNIQUE (purchase_order_id, ingredient_id)
);

CREATE INDEX idx_po_items_po ON purchase_order_items(purchase_order_id);