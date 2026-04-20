package br.com.easy_inventory.management.auth.service;

import br.com.easy_inventory.management.auth.dto.LoginRequest;
import br.com.easy_inventory.management.auth.dto.LoginResponse;
import br.com.easy_inventory.management.auth.entity.RefreshToken;
import br.com.easy_inventory.management.auth.repository.RefreshTokenRepository;
import br.com.easy_inventory.management.shared.exception.BusinessException;
import br.com.easy_inventory.management.shared.security.JwtProperties;
import br.com.easy_inventory.management.shared.security.JwtService;
import br.com.easy_inventory.management.user.entity.User;
import br.com.easy_inventory.management.user.repository.UserRepository;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.UUID;

@Service
public class AuthService {

    private final AuthenticationManager authManager;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtService jwtService;
    private final JwtProperties jwtProperties;

    public AuthService(AuthenticationManager authManager,
                       UserRepository userRepository,
                       RefreshTokenRepository refreshTokenRepository,
                       JwtService jwtService,
                       JwtProperties jwtProperties) {
        this.authManager = authManager;
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.jwtService = jwtService;
        this.jwtProperties = jwtProperties;
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {
        authManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email(), request.password()));

        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new BusinessException("User not found"));

        String accessToken = jwtService.generateAccessToken(user);
        String rawRefreshToken = UUID.randomUUID().toString();
        String tokenHash = hash(rawRefreshToken);

        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setTokenHash(tokenHash);
        refreshToken.setUser(user);
        refreshToken.setExpiresAt(LocalDateTime.now().plusDays(jwtProperties.refreshTokenExpirationDays()));
        refreshTokenRepository.save(refreshToken);

        return new LoginResponse(accessToken, rawRefreshToken);
    }

    @Transactional
    public LoginResponse refresh(String rawRefreshToken) {
        String tokenHash = hash(rawRefreshToken);
        RefreshToken stored = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new BusinessException("Invalid refresh token"));

        if (stored.isRevoked() || stored.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new BusinessException("Refresh token expired or revoked");
        }

        stored.setRevoked(true);
        refreshTokenRepository.save(stored);

        User user = stored.getUser();
        String newAccessToken = jwtService.generateAccessToken(user);
        String newRawToken = UUID.randomUUID().toString();
        String newHash = hash(newRawToken);

        RefreshToken newToken = new RefreshToken();
        newToken.setTokenHash(newHash);
        newToken.setUser(user);
        newToken.setExpiresAt(LocalDateTime.now().plusDays(jwtProperties.refreshTokenExpirationDays()));
        refreshTokenRepository.save(newToken);

        return new LoginResponse(newAccessToken, newRawToken);
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        String tokenHash = hash(rawRefreshToken);
        refreshTokenRepository.findByTokenHash(tokenHash)
                .ifPresent(t -> {
                    t.setRevoked(true);
                    refreshTokenRepository.save(t);
                });
    }

    private String hash(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(bytes);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }
}
