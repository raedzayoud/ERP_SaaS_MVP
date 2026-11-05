# AGENTS.md — ERP Backend (Spring Boot)

## 1. Most important rule

Write clean, simple, readable, beginner-friendly Java.

- Prefer the simplest solution that works.
- Do not add complexity, patterns, or abstractions without a clear, immediate need.
- Prioritize working code, security, and maintainability over clever code.

## 2. Do not introduce

- DDD, hexagonal architecture, CQRS, event sourcing, microservices, WebFlux.
- Custom frameworks, generic base classes, unnecessary interfaces or abstractions.
- MapStruct, caching layers, messaging, or extra dependencies.
- Clever streams/generics where a simple loop or `if` is clearer.
- Premature refactors or changes outside the requested task.

Ask before adding any dependency or making an architectural change.

## 3. Project facts

- Spring Boot 4.0.0, Java 25, Spring MVC, Spring Data JPA, Spring Security.
- PostgreSQL 18 via Docker container `erp-postgres`, host port `5433`, database `erp_db`.
- Package-by-feature under `com.erp.erp`: `auth`, `tenant`, `user`, `kyc`, `common`, `config`.
- Existing features: JWT auth, multipart KYC signup, super-admin signup review.
- UUID primary keys; JPA `ddl-auto=update` in dev; no Flyway yet.
- Backend project root: `erp_backend/erp` (next to `pom.xml`).
- Do not modify the duplicate folder `ERP_SaaS/erpbackend/`.
- Do not modify the Angular frontend unless explicitly asked.

Commands (from `erp_backend/erp`):

```bash
.\mvnw.cmd test
.\mvnw.cmd spring-boot:run
docker compose up -d
```

## 4. Package and layering rules

- Keep feature code inside its feature package.
- `config` = wiring only. `common` = genuinely shared code only.
- Controller: HTTP mapping, validation, request/response only. No business logic, no repositories.
- Service: business rules, orchestration, transactions.
- Repository: database queries only.
- Entity: persistence only. Never expose entities through the API.
- DTOs: Java `record`s. Keep API shapes separate from entities.
- Do not create empty packages, unused classes, or speculative abstractions.

## 5. Java conventions

- Constructor injection with `final` fields (current style). No field injection.
- Lombok only where already used (`@Getter`, `@Setter`, `@NoArgsConstructor` on entities).
  Do not use `@Data` on entities.
- Use `UUID` for ids, `Instant` (UTC) for timestamps, `BigDecimal` for money, enums for fixed sets.
- Use clear English names. Keep methods short. Prefer early returns.
- Avoid `null` returns. Use `Optional` only where it is natural (e.g. repository lookups).
- Validate input with Jakarta annotations; normalize (trim/lowercase) in the service.
- Comments only when behavior is not obvious. Keep them short and in English.
- No `System.out`. If logging is added, use SLF4J. Never log passwords, tokens, or KYC data.

## 6. API and errors

- Use `/api/v1/...` paths and DTO responses.
- Return correct status codes: 200, 201, 204, 400, 401, 403, 404, 409, 413.
- Throw the existing `AuthException`; let `GlobalExceptionHandler` return `{ "message": "..." }`.
- Validate everything server-side. Never trust the browser for tenant, role, or KYC status.
- Derive the tenant from the authenticated user, never from request data.

## 7. Security and data

- Never commit secrets. Use environment variables (`DB_PASSWORD`, `JWT_SECRET`).
- Hash passwords with BCrypt. Never store or log plain passwords.
- Keep authorization rules in `SecurityConfig`; endpoints are protected by default.
- Keep `open-in-view=false`: load the data you need inside the service transaction.
- `@Transactional` on writes, `@Transactional(readOnly = true)` on reads.
- Do not run destructive database commands (`DROP`, `TRUNCATE`, schema reset) without asking.
- Keep KYC, role and tenant checks enforced by the backend.

## 8. Testing and definition of done

- Use the existing JUnit 5 setup. Plain unit tests for pure logic; `@SpringBootTest` only for wiring.
- Follow the existing test naming style, e.g. `enterpriseWhenRoomLive`.
- Run `.\mvnw.cmd test` before declaring the task complete.
- Report failures honestly; never claim tests passed without running them.
- Check that the change is limited to the requested files.
- Mention any API, schema, or configuration change in the final summary.

## 9. Ask before

- Adding a dependency or library.
- Changing authentication, JWT, security rules, or the database schema.
- Introducing a new layer, pattern, or module.
- Deleting or rewriting existing code unrelated to the task.
