package br.com.easy_inventory.management.unit.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateUnitRequest(
        @NotBlank @Size(max = 100) String name,
        @Size(max = 255) String address
) {}
