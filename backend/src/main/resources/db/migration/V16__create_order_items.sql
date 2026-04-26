CREATE TABLE order_items (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
     product_id UUID NOT NULL REFERENCES products(id),
     quantity INTEGER NOT NULL CHECK (quantity > 0),
     unit_price DECIMAL(10,2) NOT NULL,
     CONSTRAINT uq_order_item_product UNIQUE (order_id, product_id)
);

CREATE INDEX idx_order_items_order ON order_items(order_id);