ALTER TABLE stock_movements
  ADD COLUMN direction VARCHAR(10) CHECK (direction IN ('INCREASE', 'DECREASE'));
