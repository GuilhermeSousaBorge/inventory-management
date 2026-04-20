# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development Setup
```bash
# Start required services (PostgreSQL + pgAdmin)
docker-compose up -d
```

### Build & Run
```bash
./mvnw clean package          # Build JAR
./mvnw spring-boot:run        # Run application
java -jar target/backend-0.0.1-SNAPSHOT.jar  # Run built JAR
```

### Testing
```bash
./mvnw test                   # Run all tests
./mvnw test -Dtest=ClassName  # Run a single test class
./mvnw test -Dtest=ClassName#methodName  # Run a single test method
```

> On Windows use `mvnw.cmd` instead of `./mvnw`.

## Infrastructure

- **Database:** PostgreSQL 16 on `localhost:5432` (DB: `pizzaria`, user: `admin`, password: `admin`)
- **pgAdmin:** Available at `localhost:5050`
- **Database migrations:** Flyway — migration scripts go in `src/main/resources/db/migration/` using the `V{n}__{description}.sql` naming convention

## Architecture

Spring Boot 4 REST API with JWT authentication.

**Package root:** `br.com.easy_inventory.management`

**Expected layered structure:**
- `entity/` — JPA entities (mapped to DB tables)
- `repository/` — Spring Data JPA repositories
- `service/` — Business logic
- `controller/` — REST controllers (`@RestController`)
- `config/` or `security/` — Spring Security + JWT configuration
- DTOs for request/response shapes with Bean Validation annotations (`@Valid`)

**Key dependencies:**
- Spring Data JPA + PostgreSQL for persistence
- JJWT 0.12.6 for JWT-based auth
- SpringDoc OpenAPI 2.5.0 — Swagger UI auto-generated from controllers
- Flyway for schema migrations
- Spring Validation for input validation

**API docs:** Once running, Swagger UI is available at `http://localhost:8080/swagger-ui.html`.
