package br.com.easy_inventory.management.unit.dto;

import br.com.easy_inventory.management.unit.entity.Unit;
import java.time.LocalDateTime;
import java.util.UUID;

public record UnitResponse(UUID id, String name, String address, boolean active, LocalDateTime createdAt) {
    public static UnitResponse from(Unit u) {
        return new UnitResponse(u.getId(), u.getName(), u.getAddress(), u.isActive(), u.getCreatedAt());
    }
}
