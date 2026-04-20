package br.com.easy_inventory.management.unit.repository;

import br.com.easy_inventory.management.unit.entity.Unit;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface UnitRepository extends JpaRepository<Unit, UUID> {}
