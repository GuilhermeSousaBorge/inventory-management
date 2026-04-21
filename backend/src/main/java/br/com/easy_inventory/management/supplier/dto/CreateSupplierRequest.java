package br.com.easy_inventory.management.supplier.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateSupplierRequest(
        @NotBlank @Size(max = 150) String name,
        @Size(max = 100) String contactName,
        @Size(max = 20) String phone,
        @Size(max = 150) String email,
        @Size(max = 255) String address
) {}
