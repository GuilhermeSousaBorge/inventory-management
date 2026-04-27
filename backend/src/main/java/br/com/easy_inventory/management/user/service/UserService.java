package br.com.easy_inventory.management.user.service;

import br.com.easy_inventory.management.audit.entity.AuditAction;
import br.com.easy_inventory.management.audit.service.AuditService;
import br.com.easy_inventory.management.shared.exception.BusinessException;
import br.com.easy_inventory.management.shared.exception.ResourceNotFoundException;
import br.com.easy_inventory.management.user.dto.*;
import br.com.easy_inventory.management.user.entity.User;
import br.com.easy_inventory.management.user.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder, AuditService auditService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
    }

    public Page<UserResponse> findAll(Pageable pageable) {
        return userRepository.findAll(pageable).map(UserResponse::from);
    }

    public UserResponse findById(UUID id) {
        return UserResponse.from(getOrThrow(id));
    }

    @Transactional
    public UserResponse create(CreateUserRequest request, UUID actorUserId) {
        if (userRepository.existsByEmail(request.email())) {
            throw new BusinessException("Email already in use");
        }
        User user = new User();
        user.setName(request.name());
        user.setEmail(request.email());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setRole(request.role());
        User saved = userRepository.save(user);

        auditService.log(AuditAction.USER_CREATED, "User", saved.getId(), actorUserId,
                Map.of("name", saved.getName(), "email", saved.getEmail(), "role", saved.getRole().name()));
        return UserResponse.from(saved);
    }

    @Transactional
    public UserResponse update(UUID id, UpdateUserRequest request, UUID actorUserId) {
        User user = getOrThrow(id);
        if (!user.getEmail().equals(request.email()) && userRepository.existsByEmail(request.email())) {
            throw new BusinessException("Email already in use");
        }

        Map<String, Object> before = Map.of(
                "name", user.getName(), "email", user.getEmail(),
                "role", user.getRole().name(), "active", user.isActive());
        boolean roleChanged = user.getRole() != request.role();

        user.setName(request.name());
        user.setEmail(request.email());
        user.setRole(request.role());
        user.setActive(request.active());
        User saved = userRepository.save(user);

        Map<String, Object> after = Map.of(
                "name", saved.getName(), "email", saved.getEmail(),
                "role", saved.getRole().name(), "active", saved.isActive());

        auditService.log(AuditAction.USER_UPDATED, "User", saved.getId(), actorUserId,
                Map.of("before", before, "after", after));
        if (roleChanged) {
            auditService.log(AuditAction.USER_ROLE_CHANGED, "User", saved.getId(), actorUserId,
                    Map.of("before", before.get("role"), "after", after.get("role")));
        }
        return UserResponse.from(saved);
    }

    @Transactional
    public void deactivate(UUID id, UUID actorUserId) {
        User user = getOrThrow(id);
        user.setActive(false);
        userRepository.save(user);
        auditService.log(AuditAction.USER_DEACTIVATED, "User", id, actorUserId, null);
    }

    public UserResponse getMe() {
        User current = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return UserResponse.from(current);
    }

    @Transactional
    public void changePassword(ChangePasswordRequest request) {
        User current = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        User user = getOrThrow(current.getId());
        if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            throw new BusinessException("Current password is incorrect");
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
    }

    private User getOrThrow(UUID id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + id));
    }
}
