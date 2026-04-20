package br.com.easy_inventory.management.user.dto;

import br.com.easy_inventory.management.user.entity.Role;
import br.com.easy_inventory.management.user.entity.User;

import java.time.LocalDateTime;
import java.util.UUID;

public record UserResponse(UUID id, String name, String email, Role role, boolean active, LocalDateTime createdAt) {
    public static UserResponse from(User u) {
        return new UserResponse(u.getId(), u.getName(), u.getEmail(), u.getRole(), u.isActive(), u.getCreatedAt());
    }
}
