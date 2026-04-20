-- Default credentials: admin@pizzaria.com / admin123
-- Hash generated with BCryptPasswordEncoder.encode("admin123")
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO users (id, name, email, password_hash, role, active, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Administrador',
    'admin@pizzaria.com',
    crypt('admin123', gen_salt('bf', 10)),
    'OWNER',
    TRUE,
    NOW()
);
