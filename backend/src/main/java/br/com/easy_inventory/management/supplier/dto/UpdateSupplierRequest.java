package br.com.easy_inventory.management.supplier.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateSupplierRequest(
        @NotBlank @Size(max = 150) String name,
        @Size(max = 100) String contactName,
        @Size(max = 20) String phone,
        @Size(max = 150) String email,
        @Size(max = 255) String address,
        @NotNull Boolean active
) {}
