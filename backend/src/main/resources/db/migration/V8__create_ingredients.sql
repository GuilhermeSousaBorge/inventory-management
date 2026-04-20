CREATE TABLE ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    description VARCHAR(255),
    category_id UUID REFERENCES categories(id),
    unit_of_measure VARCHAR(10) NOT NULL CHECK (unit_of_measure IN ('kg', 'g', 'L', 'ml', 'un', 'cx')),
    minimum_qty DECIMAL(10,3) NOT NULL,
    average_cost DECIMAL(10,4) NOT NULL DEFAULT 0,
    expiry_date DATE,
    default_supplier_id UUID REFERENCES suppliers(id),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
