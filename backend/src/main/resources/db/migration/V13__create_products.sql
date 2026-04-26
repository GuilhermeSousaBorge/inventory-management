CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    size VARCHAR(20) NOT NULL CHECK ( size IN ('P', 'M', 'G', 'GG')),
    category_id UUID REFERENCES categories(id),
    price DECIMAL(10, 2) NOT NULL,
    description VARCHAR(255),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_product_name_size UNIQUE (name, size)
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(active);