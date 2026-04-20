# SP1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the SP1 Foundation — JWT auth, user management, physical units, categories, suppliers, and ingredients.

**Architecture:** Domain-driven packages under `br.com.easy_inventory.management`. Each domain has entity, repository, service, controller, and DTOs. Shared infrastructure in `shared/` handles security, exceptions, and response envelopes.

**Tech Stack:** Java 21, Spring Boot 4.0.5, Spring Security 6, JJWT 0.12.6, Spring Data JPA, PostgreSQL 16, Flyway, SpringDoc OpenAPI 2.5.0.

---

## File Map

```
src/main/resources/
  application.yaml
  db/migration/
    V1__create_users.sql
    V2__create_refresh_tokens.sql
    V3__create_units.sql
    V4__insert_default_unit.sql
    V5__insert_default_owner.sql
    V6__create_categories.sql
    V7__create_suppliers.sql
    V8__create_ingredients.sql

src/main/java/br/com/easy_inventory/management/
  ManagementApplication.java               (modify: add @EnableConfigurationProperties)
  shared/
    dto/ApiResponse.java
    dto/PageResponse.java
    exception/ResourceNotFoundException.java
    exception/BusinessException.java
    exception/GlobalExceptionHandler.java
    security/JwtProperties.java
    security/JwtService.java
    security/JwtAuthFilter.java
    security/UserDetailsServiceImpl.java
    security/SecurityConfig.java
  user/
    entity/Role.java
    entity/User.java
    repository/UserRepository.java
    dto/UserResponse.java
    dto/CreateUserRequest.java
    dto/UpdateUserRequest.java
    dto/ChangePasswordRequest.java
    service/UserService.java
    controller/UserController.java
  auth/
    entity/RefreshToken.java
    repository/RefreshTokenRepository.java
    dto/LoginRequest.java
    dto/LoginResponse.java
    dto/RefreshRequest.java
    dto/LogoutRequest.java
    service/AuthService.java
    controller/AuthController.java
  unit/
    entity/Unit.java
    repository/UnitRepository.java
    dto/UnitResponse.java
    dto/CreateUnitRequest.java
    dto/UpdateUnitRequest.java
    service/UnitService.java
    controller/UnitController.java
  category/
    entity/Category.java
    repository/CategoryRepository.java
    dto/CategoryResponse.java
    dto/CreateCategoryRequest.java
    dto/UpdateCategoryRequest.java
    service/CategoryService.java
    controller/CategoryController.java
  supplier/
    entity/Supplier.java
    repository/SupplierRepository.java
    dto/SupplierResponse.java
    dto/CreateSupplierRequest.java
    dto/UpdateSupplierRequest.java
    service/SupplierService.java
    controller/SupplierController.java
  ingredient/
    entity/UnitOfMeasure.java
    entity/Ingredient.java
    repository/IngredientRepository.java
    dto/IngredientResponse.java
    dto/CreateIngredientRequest.java
    dto/UpdateIngredientRequest.java
    service/IngredientService.java
    controller/IngredientController.java

src/test/java/br/com/easy_inventory/management/
  auth/AuthControllerTest.java
  user/UserControllerTest.java
  unit/UnitControllerTest.java
  category/CategoryControllerTest.java
  supplier/SupplierControllerTest.java
  ingredient/IngredientControllerTest.java
```

---

## Task 1: Configure application.yaml

**Files:**
- Modify: `src/main/resources/application.yaml`

- [ ] **Step 1: Replace application.yaml contents**

```yaml
spring:
  application:
    name: management
  datasource:
    url: jdbc:postgresql://localhost:5432/pizzaria
    username: admin
    password: admin
  jpa:
    hibernate:
      ddl-auto: validate
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
  flyway:
    enabled: true
    locations: classpath:db/migration

jwt:
  secret: "dGhpcy1pcy1hLXZlcnktc2VjcmV0LWp3dC1rZXkh"
  access-token-expiration-ms: 28800000
  refresh-token-expiration-days: 7

springdoc:
  api-docs:
    path: /api-docs
  swagger-ui:
    path: /swagger-ui.html
```

- [ ] **Step 2: Enable ConfigurationProperties in main class**

Modify `src/main/java/br/com/easy_inventory/management/ManagementApplication.java`:

```java
package br.com.easy_inventory.management;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import br.com.easy_inventory.management.shared.security.JwtProperties;

@SpringBootApplication
@EnableConfigurationProperties(JwtProperties.class)
public class ManagementApplication {
    public static void main(String[] args) {
        SpringApplication.run(ManagementApplication.class, args);
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/main/resources/application.yaml src/main/java/br/com/easy_inventory/management/ManagementApplication.java
git commit -m "config: add datasource, JWT, and OpenAPI configuration"
```

---

## Task 2: Flyway Migrations

**Files:** Create all files in `src/main/resources/db/migration/`

- [ ] **Step 1: Create V1__create_users.sql**

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('OWNER', 'EMPLOYEE')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 2: Create V2__create_refresh_tokens.sql**

```sql
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id),
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 3: Create V3__create_units.sql**

```sql
CREATE TABLE units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 4: Create V4__insert_default_unit.sql**

```sql
INSERT INTO units (id, name, active, created_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'Matriz', TRUE, NOW());
```

- [ ] **Step 5: Create V5__insert_default_owner.sql**

```sql
-- Default credentials: admin@pizzaria.com / admin123
-- Hash generated with BCryptPasswordEncoder.encode("admin123")
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO users (id, name, email, password_hash, role, active, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Administrador',
    'admin@pizzaria.com',
    crypt('admin123', gen_salt('bf', 10)),
    'OWNER',
    TRUE,
    NOW()
);
```

- [ ] **Step 6: Create V6__create_categories.sql**

```sql
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 7: Create V7__create_suppliers.sql**

```sql
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    contact_name VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(150),
    address VARCHAR(255),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 8: Create V8__create_ingredients.sql**

```sql
CREATE TABLE ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    description VARCHAR(255),
    category_id UUID REFERENCES categories(id),
    unit_of_measure VARCHAR(10) NOT NULL CHECK (unit_of_measure IN ('kg', 'g', 'L', 'ml', 'un', 'cx')),
    minimum_qty DECIMAL(10,3) NOT NULL,
    average_cost DECIMAL(10,4) NOT NULL DEFAULT 0,
    expiry_date DATE,
    default_supplier_id UUID REFERENCES suppliers(id),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 9: Verify docker is running and migrations apply**

```bash
docker-compose up -d
./mvnw spring-boot:run
# Should see "Successfully applied 8 migrations" in logs then startup complete
# Ctrl+C to stop
```

- [ ] **Step 10: Commit**

```bash
git add src/main/resources/db/
git commit -m "feat: add Flyway migrations V1-V8 for SP1 schema"
```

---

## Task 3: Shared Infrastructure

**Files:** Create files in `src/main/java/br/com/easy_inventory/management/shared/`

- [ ] **Step 1: Create ApiResponse.java**

```java
package br.com.easy_inventory.management.shared.dto;

public record ApiResponse<T>(T data) {
    public static <T> ApiResponse<T> of(T data) {
        return new ApiResponse<>(data);
    }
}
```

- [ ] **Step 2: Create PageResponse.java**

```java
package br.com.easy_inventory.management.shared.dto;

import java.util.List;

public record PageResponse<T>(List<T> data, int page, int size, long total) {
    public static <T> PageResponse<T> of(List<T> data, int page, int size, long total) {
        return new PageResponse<>(data, page, size, total);
    }
}
```

- [ ] **Step 3: Create ResourceNotFoundException.java**

```java
package br.com.easy_inventory.management.shared.exception;

public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}
```

- [ ] **Step 4: Create BusinessException.java**

```java
package br.com.easy_inventory.management.shared.exception;

public class BusinessException extends RuntimeException {
    public BusinessException(String message) {
        super(message);
    }
}
```

- [ ] **Step 5: Create GlobalExceptionHandler.java**

```java
package br.com.easy_inventory.management.shared.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.List;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<Map<String, String>> handleBusiness(BusinessException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, List<String>>> handleValidation(MethodArgumentNotValidException ex) {
        List<String> errors = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .toList();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("errors", errors));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, String>> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Access denied"));
    }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/main/java/br/com/easy_inventory/management/shared/
git commit -m "feat: add shared DTOs and exception handling"
```

---

## Task 4: User Entity and Repository

**Files:** Create files in `src/main/java/br/com/easy_inventory/management/user/`

- [ ] **Step 1: Create Role.java**

```java
package br.com.easy_inventory.management.user.entity;

public enum Role {
    OWNER, EMPLOYEE
}
```

- [ ] **Step 2: Create User.java**

```java
package br.com.easy_inventory.management.user.entity;

import jakarta.persistence.*;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "users")
public class User implements UserDetails {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, unique = true, length = 150)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        this.createdAt = LocalDateTime.now();
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    @Override public String getPassword() { return passwordHash; }
    @Override public String getUsername() { return email; }
    @Override public boolean isEnabled() { return active; }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
```

- [ ] **Step 3: Create UserRepository.java**

```java
package br.com.easy_inventory.management.user.repository;

import br.com.easy_inventory.management.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/main/java/br/com/easy_inventory/management/user/
git commit -m "feat: add User entity, Role enum, and UserRepository"
```

---

## Task 5: JWT Security Infrastructure

**Files:** Create files in `src/main/java/br/com/easy_inventory/management/shared/security/`

- [ ] **Step 1: Create JwtProperties.java**

```java
package br.com.easy_inventory.management.shared.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "jwt")
public record JwtProperties(
        String secret,
        long accessTokenExpirationMs,
        int refreshTokenExpirationDays
) {}
```

- [ ] **Step 2: Create JwtService.java**

```java
package br.com.easy_inventory.management.shared.security;

import br.com.easy_inventory.management.user.entity.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.UUID;

@Service
public class JwtService {

    private final JwtProperties props;

    public JwtService(JwtProperties props) {
        this.props = props;
    }

    public String generateAccessToken(User user) {
        return Jwts.builder()
                .subject(user.getId().toString())
                .claim("email", user.getEmail())
                .claim("role", user.getRole().name())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + props.accessTokenExpirationMs()))
                .signWith(secretKey())
                .compact();
    }

    public Claims extractClaims(String token) {
        return Jwts.parser()
                .verifyWith(secretKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public UUID extractUserId(String token) {
        return UUID.fromString(extractClaims(token).getSubject());
    }

    public boolean isTokenValid(String token) {
        try {
            return !extractClaims(token).getExpiration().before(new Date());
        } catch (Exception e) {
            return false;
        }
    }

    private SecretKey secretKey() {
        return Keys.hmacShaKeyFor(Decoders.BASE64.decode(props.secret()));
    }
}
```

- [ ] **Step 3: Create UserDetailsServiceImpl.java**

```java
package br.com.easy_inventory.management.shared.security;

import br.com.easy_inventory.management.user.repository.UserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;

    public UserDetailsServiceImpl(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
    }
}
```

- [ ] **Step 4: Create JwtAuthFilter.java**

```java
package br.com.easy_inventory.management.shared.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserDetailsServiceImpl userDetailsService;

    public JwtAuthFilter(JwtService jwtService, UserDetailsServiceImpl userDetailsService) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);
        if (!jwtService.isTokenValid(token)) {
            filterChain.doFilter(request, response);
            return;
        }

        var claims = jwtService.extractClaims(token);
        String email = claims.get("email", String.class);

        if (email != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            UserDetails userDetails = userDetailsService.loadUserByUsername(email);
            if (userDetails.isEnabled()) {
                var authToken = new UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.getAuthorities());
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }
        filterChain.doFilter(request, response);
    }
}
```

- [ ] **Step 5: Create SecurityConfig.java**

```java
package br.com.easy_inventory.management.shared.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final UserDetailsServiceImpl userDetailsService;
    private final JwtAuthFilter jwtAuthFilter;

    public SecurityConfig(UserDetailsServiceImpl userDetailsService, JwtAuthFilter jwtAuthFilter) {
        this.userDetailsService = userDetailsService;
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/auth/**").permitAll()
                        .requestMatchers("/swagger-ui.html", "/swagger-ui/**", "/api-docs/**").permitAll()
                        .anyRequest().authenticated()
                )
                .authenticationProvider(authenticationProvider())
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        var provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/main/java/br/com/easy_inventory/management/shared/security/
git commit -m "feat: add JWT security infrastructure (filter, service, config)"
```

---

## Task 6: Auth Module

**Files:** Create files in `src/main/java/br/com/easy_inventory/management/auth/`

- [ ] **Step 1: Create RefreshToken.java**

```java
package br.com.easy_inventory.management.auth.entity;

import br.com.easy_inventory.management.user.entity.User;
import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "refresh_tokens")
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "token_hash", nullable = false, unique = true, length = 255)
    private String tokenHash;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(nullable = false)
    private boolean revoked = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() { this.createdAt = LocalDateTime.now(); }

    public UUID getId() { return id; }
    public String getTokenHash() { return tokenHash; }
    public void setTokenHash(String tokenHash) { this.tokenHash = tokenHash; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
    public boolean isRevoked() { return revoked; }
    public void setRevoked(boolean revoked) { this.revoked = revoked; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
```

- [ ] **Step 2: Create RefreshTokenRepository.java**

```java
package br.com.easy_inventory.management.auth.repository;

import br.com.easy_inventory.management.auth.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {
    Optional<RefreshToken> findByTokenHash(String tokenHash);

    @Modifying
    @Query("UPDATE RefreshToken r SET r.revoked = true WHERE r.user.id = :userId")
    void revokeAllByUserId(UUID userId);
}
```

- [ ] **Step 3: Create auth DTOs**

`LoginRequest.java`:
```java
package br.com.easy_inventory.management.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @NotBlank @Email String email,
        @NotBlank String password
) {}
```

`LoginResponse.java`:
```java
package br.com.easy_inventory.management.auth.dto;

public record LoginResponse(String accessToken, String refreshToken) {}
```

`RefreshRequest.java`:
```java
package br.com.easy_inventory.management.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record RefreshRequest(@NotBlank String refreshToken) {}
```

`LogoutRequest.java`:
```java
package br.com.easy_inventory.management.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record LogoutRequest(@NotBlank String refreshToken) {}
```

- [ ] **Step 4: Create AuthService.java**

```java
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
import org.springframework.security.crypto.password.PasswordEncoder;
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
```

- [ ] **Step 5: Create AuthController.java**

```java
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
```

- [ ] **Step 6: Run the application to verify startup**

```bash
docker-compose up -d
./mvnw spring-boot:run
# Verify: "Started ManagementApplication" in logs — no errors
# Ctrl+C to stop
```

- [ ] **Step 7: Commit**

```bash
git add src/main/java/br/com/easy_inventory/management/auth/
git commit -m "feat: add Auth module (login, refresh token, logout)"
```

---

## Task 7: Auth Integration Tests

**Files:**
- Create: `src/test/java/br/com/easy_inventory/management/auth/AuthControllerTest.java`

- [ ] **Step 1: Write the failing tests**

```java
package br.com.easy_inventory.management.auth;

import br.com.easy_inventory.management.auth.repository.RefreshTokenRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class AuthControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired RefreshTokenRepository refreshTokenRepository;

    @BeforeEach
    void setUp() {
        refreshTokenRepository.deleteAll();
    }

    @Test
    void login_withValidCredentials_returns200WithTokens() throws Exception {
        String body = objectMapper.writeValueAsString(
                Map.of("email", "admin@pizzaria.com", "password", "admin123"));

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.data.refreshToken").isNotEmpty());
    }

    @Test
    void login_withWrongPassword_returns401() throws Exception {
        String body = objectMapper.writeValueAsString(
                Map.of("email", "admin@pizzaria.com", "password", "wrong"));

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void refresh_withValidToken_returnsNewTokens() throws Exception {
        // Login first
        String loginBody = objectMapper.writeValueAsString(
                Map.of("email", "admin@pizzaria.com", "password", "admin123"));
        String loginResponse = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody))
                .andReturn().getResponse().getContentAsString();

        String refreshToken = objectMapper.readTree(loginResponse)
                .path("data").path("refreshToken").asText();

        String refreshBody = objectMapper.writeValueAsString(
                Map.of("refreshToken", refreshToken));

        mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(refreshBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.data.refreshToken").isNotEmpty());
    }

    @Test
    void logout_withValidToken_returns204() throws Exception {
        String loginBody = objectMapper.writeValueAsString(
                Map.of("email", "admin@pizzaria.com", "password", "admin123"));
        String loginResponse = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody))
                .andReturn().getResponse().getContentAsString();

        String refreshToken = objectMapper.readTree(loginResponse)
                .path("data").path("refreshToken").asText();

        String logoutBody = objectMapper.writeValueAsString(
                Map.of("refreshToken", refreshToken));

        mockMvc.perform(post("/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(logoutBody))
                .andExpect(status().isNoContent());
    }
}
```

- [ ] **Step 2: Run tests**

```bash
./mvnw test -Dtest=AuthControllerTest
# Expected: All 4 tests PASS
```

- [ ] **Step 3: Commit**

```bash
git add src/test/
git commit -m "test: add Auth controller integration tests"
```

---

## Task 8: User Module

**Files:** Create files in `src/main/java/br/com/easy_inventory/management/user/`

- [ ] **Step 1: Create user DTOs**

`UserResponse.java`:
```java
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
```

`CreateUserRequest.java`:
```java
package br.com.easy_inventory.management.user.dto;

import br.com.easy_inventory.management.user.entity.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateUserRequest(
        @NotBlank @Size(max = 100) String name,
        @NotBlank @Email @Size(max = 150) String email,
        @NotBlank @Size(min = 6, max = 100) String password,
        @NotNull Role role
) {}
```

`UpdateUserRequest.java`:
```java
package br.com.easy_inventory.management.user.dto;

import br.com.easy_inventory.management.user.entity.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateUserRequest(
        @NotBlank @Size(max = 100) String name,
        @NotBlank @Email @Size(max = 150) String email,
        @NotNull Role role,
        @NotNull Boolean active
) {}
```

`ChangePasswordRequest.java`:
```java
package br.com.easy_inventory.management.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
        @NotBlank String currentPassword,
        @NotBlank @Size(min = 6, max = 100) String newPassword
) {}
```

- [ ] **Step 2: Create UserService.java**

```java
package br.com.easy_inventory.management.user.service;

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

import java.util.UUID;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public Page<UserResponse> findAll(Pageable pageable) {
        return userRepository.findAll(pageable).map(UserResponse::from);
    }

    public UserResponse findById(UUID id) {
        return UserResponse.from(getOrThrow(id));
    }

    @Transactional
    public UserResponse create(CreateUserRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new BusinessException("Email already in use");
        }
        User user = new User();
        user.setName(request.name());
        user.setEmail(request.email());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setRole(request.role());
        return UserResponse.from(userRepository.save(user));
    }

    @Transactional
    public UserResponse update(UUID id, UpdateUserRequest request) {
        User user = getOrThrow(id);
        if (!user.getEmail().equals(request.email()) && userRepository.existsByEmail(request.email())) {
            throw new BusinessException("Email already in use");
        }
        user.setName(request.name());
        user.setEmail(request.email());
        user.setRole(request.role());
        user.setActive(request.active());
        return UserResponse.from(userRepository.save(user));
    }

    @Transactional
    public void deactivate(UUID id) {
        User user = getOrThrow(id);
        user.setActive(false);
        userRepository.save(user);
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
```

- [ ] **Step 3: Create UserController.java**

```java
package br.com.easy_inventory.management.user.controller;

import br.com.easy_inventory.management.shared.dto.ApiResponse;
import br.com.easy_inventory.management.shared.dto.PageResponse;
import br.com.easy_inventory.management.user.dto.*;
import br.com.easy_inventory.management.user.service.UserService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<PageResponse<UserResponse>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<UserResponse> result = userService.findAll(PageRequest.of(page, size));
        return ResponseEntity.ok(PageResponse.of(result.getContent(), page, size, result.getTotalElements()));
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<UserResponse>> create(@Valid @RequestBody CreateUserRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(userService.create(request)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<UserResponse>> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.of(userService.findById(id)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<UserResponse>> update(@PathVariable UUID id,
                                                             @Valid @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(ApiResponse.of(userService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<Void> deactivate(@PathVariable UUID id) {
        userService.deactivate(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> me() {
        return ResponseEntity.ok(ApiResponse.of(userService.getMe()));
    }

    @PutMapping("/me/password")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        userService.changePassword(request);
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/main/java/br/com/easy_inventory/management/user/
git commit -m "feat: add User module (CRUD + profile management)"
```

---

## Task 9: User Integration Tests

**Files:**
- Create: `src/test/java/br/com/easy_inventory/management/user/UserControllerTest.java`

- [ ] **Step 1: Write failing tests**

```java
package br.com.easy_inventory.management.user;

import br.com.easy_inventory.management.auth.repository.RefreshTokenRepository;
import br.com.easy_inventory.management.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class UserControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;
    @Autowired RefreshTokenRepository refreshTokenRepository;

    private String adminToken;

    @BeforeEach
    void setUp() throws Exception {
        refreshTokenRepository.deleteAll();
        userRepository.findAll().stream()
                .filter(u -> !u.getEmail().equals("admin@pizzaria.com"))
                .forEach(u -> userRepository.delete(u));

        String loginBody = objectMapper.writeValueAsString(
                Map.of("email", "admin@pizzaria.com", "password", "admin123"));
        String response = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody))
                .andReturn().getResponse().getContentAsString();
        adminToken = objectMapper.readTree(response).path("data").path("accessToken").asText();
    }

    @Test
    void getMe_returnsCurrentUser() throws Exception {
        mockMvc.perform(get("/users/me")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value("admin@pizzaria.com"))
                .andExpect(jsonPath("$.data.role").value("OWNER"));
    }

    @Test
    void listUsers_asOwner_returns200() throws Exception {
        mockMvc.perform(get("/users")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void createUser_asOwner_returns201() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "name", "Test Employee",
                "email", "employee@test.com",
                "password", "pass123",
                "role", "EMPLOYEE"));

        mockMvc.perform(post("/users")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.email").value("employee@test.com"))
                .andExpect(jsonPath("$.data.role").value("EMPLOYEE"));
    }

    @Test
    void createUser_withDuplicateEmail_returns400() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "name", "Dup", "email", "admin@pizzaria.com",
                "password", "pass123", "role", "EMPLOYEE"));

        mockMvc.perform(post("/users")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void listUsers_withoutAuth_returns401() throws Exception {
        mockMvc.perform(get("/users"))
                .andExpect(status().isUnauthorized());
    }
}
```

- [ ] **Step 2: Run tests**

```bash
./mvnw test -Dtest=UserControllerTest
# Expected: All 5 tests PASS
```

- [ ] **Step 3: Commit**

```bash
git add src/test/
git commit -m "test: add User controller integration tests"
```

---

## Task 10: Unit Module

**Files:** Create files in `src/main/java/br/com/easy_inventory/management/unit/`

- [ ] **Step 1: Create Unit.java**

```java
package br.com.easy_inventory.management.unit.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "units")
public class Unit {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 255)
    private String address;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() { this.createdAt = LocalDateTime.now(); }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
```

- [ ] **Step 2: Create UnitRepository.java**

```java
package br.com.easy_inventory.management.unit.repository;

import br.com.easy_inventory.management.unit.entity.Unit;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface UnitRepository extends JpaRepository<Unit, UUID> {}
```

- [ ] **Step 3: Create unit DTOs**

`UnitResponse.java`:
```java
package br.com.easy_inventory.management.unit.dto;

import br.com.easy_inventory.management.unit.entity.Unit;
import java.time.LocalDateTime;
import java.util.UUID;

public record UnitResponse(UUID id, String name, String address, boolean active, LocalDateTime createdAt) {
    public static UnitResponse from(Unit u) {
        return new UnitResponse(u.getId(), u.getName(), u.getAddress(), u.isActive(), u.getCreatedAt());
    }
}
```

`CreateUnitRequest.java`:
```java
package br.com.easy_inventory.management.unit.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateUnitRequest(
        @NotBlank @Size(max = 100) String name,
        @Size(max = 255) String address
) {}
```

`UpdateUnitRequest.java`:
```java
package br.com.easy_inventory.management.unit.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateUnitRequest(
        @NotBlank @Size(max = 100) String name,
        @Size(max = 255) String address,
        @NotNull Boolean active
) {}
```

- [ ] **Step 4: Create UnitService.java**

```java
package br.com.easy_inventory.management.unit.service;

import br.com.easy_inventory.management.shared.exception.ResourceNotFoundException;
import br.com.easy_inventory.management.unit.dto.*;
import br.com.easy_inventory.management.unit.entity.Unit;
import br.com.easy_inventory.management.unit.repository.UnitRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class UnitService {

    private final UnitRepository unitRepository;

    public UnitService(UnitRepository unitRepository) {
        this.unitRepository = unitRepository;
    }

    public Page<UnitResponse> findAll(Pageable pageable) {
        return unitRepository.findAll(pageable).map(UnitResponse::from);
    }

    public UnitResponse findById(UUID id) {
        return UnitResponse.from(getOrThrow(id));
    }

    @Transactional
    public UnitResponse create(CreateUnitRequest request) {
        Unit unit = new Unit();
        unit.setName(request.name());
        unit.setAddress(request.address());
        return UnitResponse.from(unitRepository.save(unit));
    }

    @Transactional
    public UnitResponse update(UUID id, UpdateUnitRequest request) {
        Unit unit = getOrThrow(id);
        unit.setName(request.name());
        unit.setAddress(request.address());
        unit.setActive(request.active());
        return UnitResponse.from(unitRepository.save(unit));
    }

    @Transactional
    public void deactivate(UUID id) {
        Unit unit = getOrThrow(id);
        unit.setActive(false);
        unitRepository.save(unit);
    }

    private Unit getOrThrow(UUID id) {
        return unitRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Unit not found: " + id));
    }
}
```

- [ ] **Step 5: Create UnitController.java**

```java
package br.com.easy_inventory.management.unit.controller;

import br.com.easy_inventory.management.shared.dto.ApiResponse;
import br.com.easy_inventory.management.shared.dto.PageResponse;
import br.com.easy_inventory.management.unit.dto.*;
import br.com.easy_inventory.management.unit.service.UnitService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/units")
public class UnitController {

    private final UnitService unitService;

    public UnitController(UnitService unitService) {
        this.unitService = unitService;
    }

    @GetMapping
    public ResponseEntity<PageResponse<UnitResponse>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<UnitResponse> result = unitService.findAll(PageRequest.of(page, size));
        return ResponseEntity.ok(PageResponse.of(result.getContent(), page, size, result.getTotalElements()));
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<UnitResponse>> create(@Valid @RequestBody CreateUnitRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(unitService.create(request)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<UnitResponse>> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.of(unitService.findById(id)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<UnitResponse>> update(@PathVariable UUID id,
                                                             @Valid @RequestBody UpdateUnitRequest request) {
        return ResponseEntity.ok(ApiResponse.of(unitService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<Void> deactivate(@PathVariable UUID id) {
        unitService.deactivate(id);
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/main/java/br/com/easy_inventory/management/unit/
git commit -m "feat: add Unit module (CRUD for physical locations)"
```

---

## Task 11: Unit Integration Tests

**Files:**
- Create: `src/test/java/br/com/easy_inventory/management/unit/UnitControllerTest.java`

- [ ] **Step 1: Write failing tests**

```java
package br.com.easy_inventory.management.unit;

import br.com.easy_inventory.management.auth.repository.RefreshTokenRepository;
import br.com.easy_inventory.management.unit.repository.UnitRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class UnitControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UnitRepository unitRepository;
    @Autowired RefreshTokenRepository refreshTokenRepository;

    private String adminToken;

    @BeforeEach
    void setUp() throws Exception {
        refreshTokenRepository.deleteAll();
        // Remove test units (keep the default Matriz from migration)
        unitRepository.findAll().stream()
                .filter(u -> u.getName().startsWith("Test"))
                .forEach(unitRepository::delete);

        String loginBody = objectMapper.writeValueAsString(
                Map.of("email", "admin@pizzaria.com", "password", "admin123"));
        String response = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody))
                .andReturn().getResponse().getContentAsString();
        adminToken = objectMapper.readTree(response).path("data").path("accessToken").asText();
    }

    @Test
    void listUnits_withoutAuth_returns200() throws Exception {
        mockMvc.perform(get("/units"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void createUnit_asOwner_returns201() throws Exception {
        String body = objectMapper.writeValueAsString(
                Map.of("name", "Test Filial Norte", "address", "Rua A, 123"));

        mockMvc.perform(post("/units")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.name").value("Test Filial Norte"));
    }

    @Test
    void createUnit_withoutAuth_returns401() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of("name", "Test Filial"));

        mockMvc.perform(post("/units")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deactivateUnit_asOwner_returns204() throws Exception {
        // Create first
        String createBody = objectMapper.writeValueAsString(Map.of("name", "Test Temp Unit"));
        String created = mockMvc.perform(post("/units")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andReturn().getResponse().getContentAsString();
        String unitId = objectMapper.readTree(created).path("data").path("id").asText();

        mockMvc.perform(delete("/units/" + unitId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/units/" + unitId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.active").value(false));
    }
}
```

- [ ] **Step 2: Run tests**

```bash
./mvnw test -Dtest=UnitControllerTest
# Expected: All 4 tests PASS
```

- [ ] **Step 3: Commit**

```bash
git add src/test/
git commit -m "test: add Unit controller integration tests"
```

---

## Task 12: Category Module

**Files:** Create files in `src/main/java/br/com/easy_inventory/management/category/`

- [ ] **Step 1: Create Category.java**

```java
package br.com.easy_inventory.management.category.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "categories")
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 100)
    private String name;

    @Column(length = 255)
    private String description;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() { this.createdAt = LocalDateTime.now(); }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
```

- [ ] **Step 2: Create CategoryRepository.java**

```java
package br.com.easy_inventory.management.category.repository;

import br.com.easy_inventory.management.category.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.UUID;

public interface CategoryRepository extends JpaRepository<Category, UUID> {
    boolean existsByName(String name);

    // Native query avoids JPQL dependency on Ingredient entity (created in Task 16)
    @Query(value = "SELECT COUNT(*) > 0 FROM ingredients WHERE category_id = :categoryId", nativeQuery = true)
    boolean hasIngredients(UUID categoryId);
}
```

- [ ] **Step 3: Create category DTOs**

`CategoryResponse.java`:
```java
package br.com.easy_inventory.management.category.dto;

import br.com.easy_inventory.management.category.entity.Category;
import java.time.LocalDateTime;
import java.util.UUID;

public record CategoryResponse(UUID id, String name, String description, LocalDateTime createdAt) {
    public static CategoryResponse from(Category c) {
        return new CategoryResponse(c.getId(), c.getName(), c.getDescription(), c.getCreatedAt());
    }
}
```

`CreateCategoryRequest.java`:
```java
package br.com.easy_inventory.management.category.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateCategoryRequest(
        @NotBlank @Size(max = 100) String name,
        @Size(max = 255) String description
) {}
```

`UpdateCategoryRequest.java`:
```java
package br.com.easy_inventory.management.category.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateCategoryRequest(
        @NotBlank @Size(max = 100) String name,
        @Size(max = 255) String description
) {}
```

- [ ] **Step 4: Create CategoryService.java**

```java
package br.com.easy_inventory.management.category.service;

import br.com.easy_inventory.management.category.dto.*;
import br.com.easy_inventory.management.category.entity.Category;
import br.com.easy_inventory.management.category.repository.CategoryRepository;
import br.com.easy_inventory.management.shared.exception.BusinessException;
import br.com.easy_inventory.management.shared.exception.ResourceNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;

    public CategoryService(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    public Page<CategoryResponse> findAll(Pageable pageable) {
        return categoryRepository.findAll(pageable).map(CategoryResponse::from);
    }

    public CategoryResponse findById(UUID id) {
        return CategoryResponse.from(getOrThrow(id));
    }

    @Transactional
    public CategoryResponse create(CreateCategoryRequest request) {
        if (categoryRepository.existsByName(request.name())) {
            throw new BusinessException("Category name already exists");
        }
        Category category = new Category();
        category.setName(request.name());
        category.setDescription(request.description());
        return CategoryResponse.from(categoryRepository.save(category));
    }

    @Transactional
    public CategoryResponse update(UUID id, UpdateCategoryRequest request) {
        Category category = getOrThrow(id);
        if (!category.getName().equals(request.name()) && categoryRepository.existsByName(request.name())) {
            throw new BusinessException("Category name already exists");
        }
        category.setName(request.name());
        category.setDescription(request.description());
        return CategoryResponse.from(categoryRepository.save(category));
    }

    @Transactional
    public void delete(UUID id) {
        getOrThrow(id);
        if (categoryRepository.hasIngredients(id)) {
            throw new BusinessException("Cannot delete category with linked ingredients");
        }
        categoryRepository.deleteById(id);
    }

    private Category getOrThrow(UUID id) {
        return categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category not found: " + id));
    }
}
```

- [ ] **Step 5: Create CategoryController.java**

```java
package br.com.easy_inventory.management.category.controller;

import br.com.easy_inventory.management.category.dto.*;
import br.com.easy_inventory.management.category.service.CategoryService;
import br.com.easy_inventory.management.shared.dto.ApiResponse;
import br.com.easy_inventory.management.shared.dto.PageResponse;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/categories")
public class CategoryController {

    private final CategoryService categoryService;

    public CategoryController(CategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @GetMapping
    public ResponseEntity<PageResponse<CategoryResponse>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<CategoryResponse> result = categoryService.findAll(PageRequest.of(page, size));
        return ResponseEntity.ok(PageResponse.of(result.getContent(), page, size, result.getTotalElements()));
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<CategoryResponse>> create(@Valid @RequestBody CreateCategoryRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(categoryService.create(request)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<CategoryResponse>> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.of(categoryService.findById(id)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<CategoryResponse>> update(@PathVariable UUID id,
                                                                 @Valid @RequestBody UpdateCategoryRequest request) {
        return ResponseEntity.ok(ApiResponse.of(categoryService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        categoryService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/main/java/br/com/easy_inventory/management/category/
git commit -m "feat: add Category module"
```

---

## Task 13: Category Integration Tests

**Files:**
- Create: `src/test/java/br/com/easy_inventory/management/category/CategoryControllerTest.java`

- [ ] **Step 1: Write failing tests**

```java
package br.com.easy_inventory.management.category;

import br.com.easy_inventory.management.auth.repository.RefreshTokenRepository;
import br.com.easy_inventory.management.category.repository.CategoryRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class CategoryControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired CategoryRepository categoryRepository;
    @Autowired RefreshTokenRepository refreshTokenRepository;

    private String adminToken;

    @BeforeEach
    void setUp() throws Exception {
        refreshTokenRepository.deleteAll();
        categoryRepository.findAll().stream()
                .filter(c -> c.getName().startsWith("Test"))
                .forEach(categoryRepository::delete);

        String loginBody = objectMapper.writeValueAsString(
                Map.of("email", "admin@pizzaria.com", "password", "admin123"));
        String response = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody))
                .andReturn().getResponse().getContentAsString();
        adminToken = objectMapper.readTree(response).path("data").path("accessToken").asText();
    }

    @Test
    void createCategory_asOwner_returns201() throws Exception {
        String body = objectMapper.writeValueAsString(
                Map.of("name", "Test Laticínios", "description", "Queijos e similares"));

        mockMvc.perform(post("/categories")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.name").value("Test Laticínios"));
    }

    @Test
    void createCategory_withDuplicateName_returns400() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of("name", "Test Grãos"));
        mockMvc.perform(post("/categories")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/categories")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void listCategories_withoutAuth_returns200() throws Exception {
        mockMvc.perform(get("/categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void deleteCategory_withNoIngredients_returns204() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of("name", "Test Temp Cat"));
        String created = mockMvc.perform(post("/categories")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andReturn().getResponse().getContentAsString();
        String catId = objectMapper.readTree(created).path("data").path("id").asText();

        mockMvc.perform(delete("/categories/" + catId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());
    }
}
```

- [ ] **Step 2: Run tests**

```bash
./mvnw test -Dtest=CategoryControllerTest
# Expected: All 4 tests PASS
```

- [ ] **Step 3: Commit**

```bash
git add src/test/
git commit -m "test: add Category controller integration tests"
```

---

## Task 14: Supplier Module

**Files:** Create files in `src/main/java/br/com/easy_inventory/management/supplier/`

- [ ] **Step 1: Create Supplier.java**

```java
package br.com.easy_inventory.management.supplier.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "suppliers")
public class Supplier {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(name = "contact_name", length = 100)
    private String contactName;

    @Column(length = 20)
    private String phone;

    @Column(length = 150)
    private String email;

    @Column(length = 255)
    private String address;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() { this.createdAt = LocalDateTime.now(); }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getContactName() { return contactName; }
    public void setContactName(String contactName) { this.contactName = contactName; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
```

- [ ] **Step 2: Create SupplierRepository.java**

```java
package br.com.easy_inventory.management.supplier.repository;

import br.com.easy_inventory.management.supplier.entity.Supplier;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface SupplierRepository extends JpaRepository<Supplier, UUID> {}
```

- [ ] **Step 3: Create supplier DTOs**

`SupplierResponse.java`:
```java
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
```

`CreateSupplierRequest.java`:
```java
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
```

`UpdateSupplierRequest.java`:
```java
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
```

- [ ] **Step 4: Create SupplierService.java**

```java
package br.com.easy_inventory.management.supplier.service;

import br.com.easy_inventory.management.shared.exception.ResourceNotFoundException;
import br.com.easy_inventory.management.supplier.dto.*;
import br.com.easy_inventory.management.supplier.entity.Supplier;
import br.com.easy_inventory.management.supplier.repository.SupplierRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class SupplierService {

    private final SupplierRepository supplierRepository;

    public SupplierService(SupplierRepository supplierRepository) {
        this.supplierRepository = supplierRepository;
    }

    public Page<SupplierResponse> findAll(Pageable pageable) {
        return supplierRepository.findAll(pageable).map(SupplierResponse::from);
    }

    public SupplierResponse findById(UUID id) {
        return SupplierResponse.from(getOrThrow(id));
    }

    @Transactional
    public SupplierResponse create(CreateSupplierRequest request) {
        Supplier supplier = new Supplier();
        supplier.setName(request.name());
        supplier.setContactName(request.contactName());
        supplier.setPhone(request.phone());
        supplier.setEmail(request.email());
        supplier.setAddress(request.address());
        return SupplierResponse.from(supplierRepository.save(supplier));
    }

    @Transactional
    public SupplierResponse update(UUID id, UpdateSupplierRequest request) {
        Supplier supplier = getOrThrow(id);
        supplier.setName(request.name());
        supplier.setContactName(request.contactName());
        supplier.setPhone(request.phone());
        supplier.setEmail(request.email());
        supplier.setAddress(request.address());
        supplier.setActive(request.active());
        return SupplierResponse.from(supplierRepository.save(supplier));
    }

    @Transactional
    public void deactivate(UUID id) {
        Supplier supplier = getOrThrow(id);
        supplier.setActive(false);
        supplierRepository.save(supplier);
    }

    private Supplier getOrThrow(UUID id) {
        return supplierRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Supplier not found: " + id));
    }
}
```

- [ ] **Step 5: Create SupplierController.java**

```java
package br.com.easy_inventory.management.supplier.controller;

import br.com.easy_inventory.management.shared.dto.ApiResponse;
import br.com.easy_inventory.management.shared.dto.PageResponse;
import br.com.easy_inventory.management.supplier.dto.*;
import br.com.easy_inventory.management.supplier.service.SupplierService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/suppliers")
public class SupplierController {

    private final SupplierService supplierService;

    public SupplierController(SupplierService supplierService) {
        this.supplierService = supplierService;
    }

    @GetMapping
    public ResponseEntity<PageResponse<SupplierResponse>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<SupplierResponse> result = supplierService.findAll(PageRequest.of(page, size));
        return ResponseEntity.ok(PageResponse.of(result.getContent(), page, size, result.getTotalElements()));
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<SupplierResponse>> create(@Valid @RequestBody CreateSupplierRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(supplierService.create(request)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<SupplierResponse>> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.of(supplierService.findById(id)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<SupplierResponse>> update(@PathVariable UUID id,
                                                                 @Valid @RequestBody UpdateSupplierRequest request) {
        return ResponseEntity.ok(ApiResponse.of(supplierService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<Void> deactivate(@PathVariable UUID id) {
        supplierService.deactivate(id);
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/main/java/br/com/easy_inventory/management/supplier/
git commit -m "feat: add Supplier module"
```

---

## Task 15: Supplier Integration Tests

**Files:**
- Create: `src/test/java/br/com/easy_inventory/management/supplier/SupplierControllerTest.java`

- [ ] **Step 1: Write failing tests**

```java
package br.com.easy_inventory.management.supplier;

import br.com.easy_inventory.management.auth.repository.RefreshTokenRepository;
import br.com.easy_inventory.management.supplier.repository.SupplierRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class SupplierControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired SupplierRepository supplierRepository;
    @Autowired RefreshTokenRepository refreshTokenRepository;

    private String adminToken;

    @BeforeEach
    void setUp() throws Exception {
        refreshTokenRepository.deleteAll();
        supplierRepository.findAll().stream()
                .filter(s -> s.getName().startsWith("Test"))
                .forEach(supplierRepository::delete);

        String loginBody = objectMapper.writeValueAsString(
                Map.of("email", "admin@pizzaria.com", "password", "admin123"));
        String response = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody))
                .andReturn().getResponse().getContentAsString();
        adminToken = objectMapper.readTree(response).path("data").path("accessToken").asText();
    }

    @Test
    void createSupplier_asOwner_returns201() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "name", "Test Distribuidora XYZ",
                "contactName", "João",
                "phone", "11999999999",
                "email", "joao@xyz.com",
                "address", "Av. B, 456"));

        mockMvc.perform(post("/suppliers")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.name").value("Test Distribuidora XYZ"))
                .andExpect(jsonPath("$.data.active").value(true));
    }

    @Test
    void listSuppliers_withoutAuth_returns200() throws Exception {
        mockMvc.perform(get("/suppliers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void deactivateSupplier_asOwner_returns204() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of("name", "Test Temp Supplier"));
        String created = mockMvc.perform(post("/suppliers")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andReturn().getResponse().getContentAsString();
        String supplierId = objectMapper.readTree(created).path("data").path("id").asText();

        mockMvc.perform(delete("/suppliers/" + supplierId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/suppliers/" + supplierId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.active").value(false));
    }
}
```

- [ ] **Step 2: Run tests**

```bash
./mvnw test -Dtest=SupplierControllerTest
# Expected: All 3 tests PASS
```

- [ ] **Step 3: Commit**

```bash
git add src/test/
git commit -m "test: add Supplier controller integration tests"
```

---

## Task 16: Ingredient Module

**Files:** Create files in `src/main/java/br/com/easy_inventory/management/ingredient/`

- [ ] **Step 1: Create UnitOfMeasure.java**

```java
package br.com.easy_inventory.management.ingredient.entity;

public enum UnitOfMeasure {
    kg, g, L, ml, un, cx
}
```

- [ ] **Step 2: Create Ingredient.java**

```java
package br.com.easy_inventory.management.ingredient.entity;

import br.com.easy_inventory.management.category.entity.Category;
import br.com.easy_inventory.management.supplier.entity.Supplier;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "ingredients")
public class Ingredient {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(length = 255)
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    @Enumerated(EnumType.STRING)
    @Column(name = "unit_of_measure", nullable = false, length = 10)
    private UnitOfMeasure unitOfMeasure;

    @Column(name = "minimum_qty", nullable = false, precision = 10, scale = 3)
    private BigDecimal minimumQty;

    @Column(name = "average_cost", nullable = false, precision = 10, scale = 4)
    private BigDecimal averageCost = BigDecimal.ZERO;

    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "default_supplier_id")
    private Supplier defaultSupplier;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() { this.createdAt = LocalDateTime.now(); }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Category getCategory() { return category; }
    public void setCategory(Category category) { this.category = category; }
    public UnitOfMeasure getUnitOfMeasure() { return unitOfMeasure; }
    public void setUnitOfMeasure(UnitOfMeasure unitOfMeasure) { this.unitOfMeasure = unitOfMeasure; }
    public BigDecimal getMinimumQty() { return minimumQty; }
    public void setMinimumQty(BigDecimal minimumQty) { this.minimumQty = minimumQty; }
    public BigDecimal getAverageCost() { return averageCost; }
    public void setAverageCost(BigDecimal averageCost) { this.averageCost = averageCost; }
    public LocalDate getExpiryDate() { return expiryDate; }
    public void setExpiryDate(LocalDate expiryDate) { this.expiryDate = expiryDate; }
    public Supplier getDefaultSupplier() { return defaultSupplier; }
    public void setDefaultSupplier(Supplier defaultSupplier) { this.defaultSupplier = defaultSupplier; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
```

- [ ] **Step 3: Create IngredientRepository.java**

```java
package br.com.easy_inventory.management.ingredient.repository;

import br.com.easy_inventory.management.ingredient.entity.Ingredient;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface IngredientRepository extends JpaRepository<Ingredient, UUID> {
    Page<Ingredient> findByCategoryId(UUID categoryId, Pageable pageable);
    Page<Ingredient> findByActive(boolean active, Pageable pageable);
    Page<Ingredient> findByCategoryIdAndActive(UUID categoryId, boolean active, Pageable pageable);
}
```

- [ ] **Step 4: Create ingredient DTOs**

`IngredientResponse.java`:
```java
package br.com.easy_inventory.management.ingredient.dto;

import br.com.easy_inventory.management.ingredient.entity.Ingredient;
import br.com.easy_inventory.management.ingredient.entity.UnitOfMeasure;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record IngredientResponse(
        UUID id, String name, String description,
        UUID categoryId, String categoryName,
        UnitOfMeasure unitOfMeasure,
        BigDecimal minimumQty, BigDecimal averageCost,
        LocalDate expiryDate,
        UUID defaultSupplierId, String defaultSupplierName,
        boolean active, LocalDateTime createdAt
) {
    public static IngredientResponse from(Ingredient i) {
        return new IngredientResponse(
                i.getId(), i.getName(), i.getDescription(),
                i.getCategory() != null ? i.getCategory().getId() : null,
                i.getCategory() != null ? i.getCategory().getName() : null,
                i.getUnitOfMeasure(),
                i.getMinimumQty(), i.getAverageCost(),
                i.getExpiryDate(),
                i.getDefaultSupplier() != null ? i.getDefaultSupplier().getId() : null,
                i.getDefaultSupplier() != null ? i.getDefaultSupplier().getName() : null,
                i.isActive(), i.getCreatedAt()
        );
    }
}
```

`CreateIngredientRequest.java`:
```java
package br.com.easy_inventory.management.ingredient.dto;

import br.com.easy_inventory.management.ingredient.entity.UnitOfMeasure;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record CreateIngredientRequest(
        @NotBlank @Size(max = 150) String name,
        @Size(max = 255) String description,
        UUID categoryId,
        @NotNull UnitOfMeasure unitOfMeasure,
        @NotNull @DecimalMin("0.001") BigDecimal minimumQty,
        LocalDate expiryDate,
        UUID defaultSupplierId
) {}
```

`UpdateIngredientRequest.java`:
```java
package br.com.easy_inventory.management.ingredient.dto;

import br.com.easy_inventory.management.ingredient.entity.UnitOfMeasure;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record UpdateIngredientRequest(
        @NotBlank @Size(max = 150) String name,
        @Size(max = 255) String description,
        UUID categoryId,
        @NotNull UnitOfMeasure unitOfMeasure,
        @NotNull @DecimalMin("0.001") BigDecimal minimumQty,
        LocalDate expiryDate,
        UUID defaultSupplierId,
        @NotNull Boolean active
) {}
```

- [ ] **Step 5: Create IngredientService.java**

```java
package br.com.easy_inventory.management.ingredient.service;

import br.com.easy_inventory.management.category.entity.Category;
import br.com.easy_inventory.management.category.repository.CategoryRepository;
import br.com.easy_inventory.management.ingredient.dto.*;
import br.com.easy_inventory.management.ingredient.entity.Ingredient;
import br.com.easy_inventory.management.ingredient.repository.IngredientRepository;
import br.com.easy_inventory.management.shared.exception.ResourceNotFoundException;
import br.com.easy_inventory.management.supplier.entity.Supplier;
import br.com.easy_inventory.management.supplier.repository.SupplierRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class IngredientService {

    private final IngredientRepository ingredientRepository;
    private final CategoryRepository categoryRepository;
    private final SupplierRepository supplierRepository;

    public IngredientService(IngredientRepository ingredientRepository,
                              CategoryRepository categoryRepository,
                              SupplierRepository supplierRepository) {
        this.ingredientRepository = ingredientRepository;
        this.categoryRepository = categoryRepository;
        this.supplierRepository = supplierRepository;
    }

    public Page<IngredientResponse> findAll(UUID categoryId, Boolean active, Pageable pageable) {
        if (categoryId != null && active != null) {
            return ingredientRepository.findByCategoryIdAndActive(categoryId, active, pageable)
                    .map(IngredientResponse::from);
        } else if (categoryId != null) {
            return ingredientRepository.findByCategoryId(categoryId, pageable).map(IngredientResponse::from);
        } else if (active != null) {
            return ingredientRepository.findByActive(active, pageable).map(IngredientResponse::from);
        }
        return ingredientRepository.findAll(pageable).map(IngredientResponse::from);
    }

    public IngredientResponse findById(UUID id) {
        return IngredientResponse.from(getOrThrow(id));
    }

    @Transactional
    public IngredientResponse create(CreateIngredientRequest request) {
        Ingredient ingredient = new Ingredient();
        ingredient.setName(request.name());
        ingredient.setDescription(request.description());
        ingredient.setUnitOfMeasure(request.unitOfMeasure());
        ingredient.setMinimumQty(request.minimumQty());
        ingredient.setExpiryDate(request.expiryDate());
        if (request.categoryId() != null) {
            Category cat = categoryRepository.findById(request.categoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("Category not found"));
            ingredient.setCategory(cat);
        }
        if (request.defaultSupplierId() != null) {
            Supplier sup = supplierRepository.findById(request.defaultSupplierId())
                    .orElseThrow(() -> new ResourceNotFoundException("Supplier not found"));
            ingredient.setDefaultSupplier(sup);
        }
        return IngredientResponse.from(ingredientRepository.save(ingredient));
    }

    @Transactional
    public IngredientResponse update(UUID id, UpdateIngredientRequest request) {
        Ingredient ingredient = getOrThrow(id);
        ingredient.setName(request.name());
        ingredient.setDescription(request.description());
        ingredient.setUnitOfMeasure(request.unitOfMeasure());
        ingredient.setMinimumQty(request.minimumQty());
        ingredient.setExpiryDate(request.expiryDate());
        ingredient.setActive(request.active());
        ingredient.setCategory(request.categoryId() != null
                ? categoryRepository.findById(request.categoryId())
                        .orElseThrow(() -> new ResourceNotFoundException("Category not found"))
                : null);
        ingredient.setDefaultSupplier(request.defaultSupplierId() != null
                ? supplierRepository.findById(request.defaultSupplierId())
                        .orElseThrow(() -> new ResourceNotFoundException("Supplier not found"))
                : null);
        return IngredientResponse.from(ingredientRepository.save(ingredient));
    }

    @Transactional
    public void deactivate(UUID id) {
        Ingredient ingredient = getOrThrow(id);
        ingredient.setActive(false);
        ingredientRepository.save(ingredient);
    }

    private Ingredient getOrThrow(UUID id) {
        return ingredientRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ingredient not found: " + id));
    }
}
```

- [ ] **Step 6: Create IngredientController.java**

```java
package br.com.easy_inventory.management.ingredient.controller;

import br.com.easy_inventory.management.ingredient.dto.*;
import br.com.easy_inventory.management.ingredient.service.IngredientService;
import br.com.easy_inventory.management.shared.dto.ApiResponse;
import br.com.easy_inventory.management.shared.dto.PageResponse;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/ingredients")
public class IngredientController {

    private final IngredientService ingredientService;

    public IngredientController(IngredientService ingredientService) {
        this.ingredientService = ingredientService;
    }

    @GetMapping
    public ResponseEntity<PageResponse<IngredientResponse>> list(
            @RequestParam(required = false) UUID category,
            @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<IngredientResponse> result = ingredientService.findAll(category, active, PageRequest.of(page, size));
        return ResponseEntity.ok(PageResponse.of(result.getContent(), page, size, result.getTotalElements()));
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<IngredientResponse>> create(@Valid @RequestBody CreateIngredientRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(ingredientService.create(request)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<IngredientResponse>> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.of(ingredientService.findById(id)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<IngredientResponse>> update(@PathVariable UUID id,
                                                                   @Valid @RequestBody UpdateIngredientRequest request) {
        return ResponseEntity.ok(ApiResponse.of(ingredientService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<Void> deactivate(@PathVariable UUID id) {
        ingredientService.deactivate(id);
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 7: Commit**

```bash
git add src/main/java/br/com/easy_inventory/management/ingredient/
git commit -m "feat: add Ingredient module with UnitOfMeasure enum"
```

---

## Task 17: Ingredient Integration Tests

**Files:**
- Create: `src/test/java/br/com/easy_inventory/management/ingredient/IngredientControllerTest.java`

- [ ] **Step 1: Write failing tests**

```java
package br.com.easy_inventory.management.ingredient;

import br.com.easy_inventory.management.auth.repository.RefreshTokenRepository;
import br.com.easy_inventory.management.ingredient.repository.IngredientRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class IngredientControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired IngredientRepository ingredientRepository;
    @Autowired RefreshTokenRepository refreshTokenRepository;

    private String adminToken;

    @BeforeEach
    void setUp() throws Exception {
        refreshTokenRepository.deleteAll();
        ingredientRepository.findAll().stream()
                .filter(i -> i.getName().startsWith("Test"))
                .forEach(ingredientRepository::delete);

        String loginBody = objectMapper.writeValueAsString(
                Map.of("email", "admin@pizzaria.com", "password", "admin123"));
        String response = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody))
                .andReturn().getResponse().getContentAsString();
        adminToken = objectMapper.readTree(response).path("data").path("accessToken").asText();
    }

    @Test
    void createIngredient_asOwner_returns201() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "name", "Test Farinha de Trigo",
                "unitOfMeasure", "kg",
                "minimumQty", 10.0));

        mockMvc.perform(post("/ingredients")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.name").value("Test Farinha de Trigo"))
                .andExpect(jsonPath("$.data.unitOfMeasure").value("kg"))
                .andExpect(jsonPath("$.data.active").value(true));
    }

    @Test
    void listIngredients_withoutAuth_returns200() throws Exception {
        mockMvc.perform(get("/ingredients"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void createIngredient_missingRequiredFields_returns400() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of("name", "Test Incomplete"));

        mockMvc.perform(post("/ingredients")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void filterIngredients_byActive_returnsFiltered() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "name", "Test Active Ingredient",
                "unitOfMeasure", "un",
                "minimumQty", 5.0));
        mockMvc.perform(post("/ingredients")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/ingredients?active=true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }
}
```

- [ ] **Step 2: Run tests**

```bash
./mvnw test -Dtest=IngredientControllerTest
# Expected: All 4 tests PASS
```

- [ ] **Step 3: Commit**

```bash
git add src/test/
git commit -m "test: add Ingredient controller integration tests"
```

---

## Task 18: Full Test Suite + Final Verification

- [ ] **Step 1: Run all tests**

```bash
./mvnw test
# Expected: All tests PASS, 0 failures
```

- [ ] **Step 2: Verify application starts and Swagger is accessible**

```bash
./mvnw spring-boot:run
# Open browser: http://localhost:8080/swagger-ui.html
# Verify all endpoints are visible: /auth, /users, /units, /categories, /suppliers, /ingredients
# Ctrl+C to stop
```

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "feat: complete SP1 Foundation — auth, users, units, categories, suppliers, ingredients"
```

---

## Notes

- **Docker must be running** before any test or application startup: `docker-compose up -d`
- **Default credentials:** `admin@pizzaria.com` / `admin123` (inserted by V5 migration via pgcrypto)
- **JWT secret** in `application.yaml` is for development only — rotate before deploying
- **`/ingredients/low-stock`** endpoint from spec is deferred to SP2 when the `stock` table exists
- The `CategoryRepository.hasIngredients` JPQL query references the `Ingredient` entity — both must exist before compilation