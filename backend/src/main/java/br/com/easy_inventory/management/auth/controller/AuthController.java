package br.com.easy_inventory.management.auth.controller;

import br.com.easy_inventory.management.auth.dto.*;
import br.com.easy_inventory.management.auth.service.AuthService;
import br.com.easy_inventory.management.shared.dto.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(ApiResponse.of(authService.login(request)));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<LoginResponse>> refresh(@Valid @RequestBody RefreshRequest request) {
        return ResponseEntity.ok(ApiResponse.of(authService.refresh(request.refreshToken())));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@Valid @RequestBody LogoutRequest request) {
        authService.logout(request.refreshToken());
        return ResponseEntity.noContent().build();
    }
}
