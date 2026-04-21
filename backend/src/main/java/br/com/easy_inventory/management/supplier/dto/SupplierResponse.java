package br.com.easy_inventory.management.supplier.dto;

import br.com.easy_inventory.management.supplier.entity.Supplier;
import java.time.LocalDateTime;
import java.util.UUID;

public record SupplierResponse(UUID id, String name, String contactName, String phone,
                                String email, String address, boolean active, LocalDateTime createdAt) {
    public static SupplierResponse from(Supplier s) {
        return new SupplierResponse(s.getId(), s.getName(), s.getContactName(), s.getPhone(),
                s.getEmail(), s.getAddress(), s.isActive(), s.getCreatedAt());
    }
}
