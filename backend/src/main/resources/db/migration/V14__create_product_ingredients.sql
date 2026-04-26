CREATE TABLE product_ingredients (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
     ingredient_id UUID NOT NULL REFERENCES ingredients(id),
     quantity DECIMAL(10,3) NOT NULL CHECK (quantity > 0),
     CONSTRAINT uq_product_ingredient UNIQUE (product_id, ingredient_id)
);

CREATE INDEX idx_product_ingredients_product ON product_ingredients(product_id);