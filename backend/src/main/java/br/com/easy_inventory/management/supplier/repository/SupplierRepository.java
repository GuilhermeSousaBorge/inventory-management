package br.com.easy_inventory.management.supplier.repository;

import br.com.easy_inventory.management.supplier.entity.Supplier;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface SupplierRepository extends JpaRepository<Supplier, UUID> {}
