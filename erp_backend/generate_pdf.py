from fpdf import FPDF
import os

class PDF(FPDF):
    def header(self):
        self.set_font("helvetica", "B", 14)
        self.set_text_color(20, 60, 120)
        self.cell(0, 10, "ERP Backend - Technical Report", new_x="LMARGIN", new_y="NEXT", align="C")
        self.set_font("helvetica", "", 10)
        self.set_text_color(100, 100, 100)
        self.cell(0, 7, "Spring Boot 4.0.0 · Java 25 · PostgreSQL 18 · Multi-tenant SaaS", new_x="LMARGIN", new_y="NEXT", align="C")
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font("helvetica", "I", 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, "Page " + str(self.page_no()), align="C")

    def chapter_title(self, num, title):
        self.set_font("helvetica", "B", 13)
        self.set_text_color(20, 60, 120)
        self.cell(0, 10, "Chapter " + str(num) + ": " + title, new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def section_title(self, title):
        self.set_font("helvetica", "B", 11)
        self.set_text_color(40, 90, 160)
        self.cell(0, 7, title, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def body_text(self, text, size=9):
        self.set_font("helvetica", "", size)
        self.set_text_color(30, 30, 30)
        self.multi_cell(0, 5, text)
        self.ln(2)

    def bullet(self, text, size=9):
        self.set_font("helvetica", "", size)
        self.set_text_color(30, 30, 30)
        self.multi_cell(0, 5, "- " + text)
        self.ln(0.5)

    def code_block(self, lines):
        self.set_font("courier", "", 8)
        self.set_text_color(0, 0, 0)
        self.set_fill_color(245, 245, 245)
        for line in lines:
            self.cell(0, 4, line, new_x="LMARGIN", new_y="NEXT", fill=True)
        self.ln(2)

    def table(self, headers, rows, col_widths=None, size=8):
        self.set_font("helvetica", "B", size)
        self.set_text_color(255, 255, 255)
        self.set_fill_color(20, 60, 120)
        if col_widths is None:
            col_widths = [self.w / len(headers)] * len(headers)
        for i, h in enumerate(headers):
            self.cell(col_widths[i], 6, h, border=1, fill=True)
        self.ln()
        self.set_font("helvetica", "", size)
        self.set_text_color(30, 30, 30)
        self.set_fill_color(255, 255, 255)
        for row in rows:
            for i, cell in enumerate(row):
                self.cell(col_widths[i], 5, str(cell), border=1)
            self.ln()
        self.ln(2)


pdf = PDF()
pdf.add_page()
pdf.set_auto_page_break(auto=True, margin=15)

# ========== Chapter 1: Overview ==========
pdf.chapter_title(1, "Project Overview")
pdf.body_text("Module root: erp_backend/erp (Spring Boot application)")
pdf.body_text("Stack: Spring Boot 4.0.0, Java 25, Spring MVC, Spring Data JPA, Spring Security, Lombok")
pdf.body_text("Database: PostgreSQL 18 (Docker container erp-postgres, host port 5433, DB erp_db)")
pdf.body_text("ORM: JPA/Hibernate, ddl-auto=update in dev, open-in-view=false")
pdf.body_text("Architecture: Package-by-feature under com.erp.erp: auth, tenant, user, kyc, billing, common, config")
pdf.body_text("UUID primary keys; DTOs are Java records; entities use Lombok (@Getter/@Setter/@NoArgsConstructor)")
pdf.body_text("Commands: .\\mvnw.cmd test, .\\mvnw.cmd spring-boot:run, docker compose up -d")

# ========== Chapter 2: Layering ==========
pdf.chapter_title(2, "Package & Layering Rules")
pdf.table(
    ["Layer", "Responsibility"],
    [
        ["Controller", "HTTP mapping, validation, request/response only"],
        ["Service", "Business rules, orchestration, transactions"],
        ["Repository", "Database queries only (JpaRepository)"],
        ["Entity", "Persistence only, never exposed through API"],
        ["Config", "Wiring only"],
        ["Common", "Genuinely shared code only"],
    ],
    col_widths=[40, 140],
)
pdf.body_text("Constructor injection with final fields; no field injection.")

# ========== Chapter 3: Auth Module ==========
pdf.chapter_title(3, "Module: auth - Authentication & Authorization")
pdf.section_title("Entities")
pdf.bullet("User (users table): id (UUID), fullName, email (unique), passwordHash (BCrypt), role, active, mustRenewPassword, tenant (ManyToOne, nullable - super-admin has no tenant)")
pdf.bullet("RefreshToken (refresh_tokens table): id, user, tokenHash (SHA-256, unique), expiresAt, revokedAt, createdAt")
pdf.bullet("PasswordResetCode (password_reset_codes table): id, user (OneToOne), codeHash, expiresAt, attempts, lastSentAt")
pdf.section_title("Role Enum (8 roles)")
pdf.bullet("SUPER_ADMIN, ADMIN_ENTREPRISE, COMMERCIAL, ACHETEUR, MAGASINIER, COMPTABLE, DIRECTEUR, CLIENT_EXTERNE - each with a code matching the Angular frontend")
pdf.section_title("Repositories")
pdf.bullet("UserRepository: findByEmail, findFirstByTenantId, existsByEmail")
pdf.bullet("RefreshTokenRepository: findByTokenHash")
pdf.bullet("PasswordResetCodeRepository: findByUserId")
pdf.section_title("Services")
pdf.bullet("AuthService: login, refresh, logout, signupAvailability, signup, me")
pdf.bullet("PasswordResetService: forgotPassword (6-digit code via email, TTL 15 min, max 5 attempts, 60s cooldown), resetPassword")
pdf.bullet("RefreshTokenService: create, rotate (revoke + new), revoke (idempotent)")
pdf.bullet("PasswordResetMailService: sends reset code email via JavaMailSender (Gmail SMTP)")
pdf.bullet("PlanResolver: derives cheapest plan containing all requested modules (starter/business/enterprise)")
pdf.bullet("RolePermissions: permission matrix per role (mirrors Angular rbac.ts)")
pdf.section_title("Controllers (/api/v1/auth)")
pdf.table(
    ["Method", "Path", "Auth", "Description"],
    [
        ["POST", "/login", "Public", "Returns access + refresh token pair"],
        ["POST", "/refresh", "Public", "Rotates refresh token, returns new pair"],
        ["POST", "/logout", "Public", "Revokes refresh token"],
        ["GET", "/signup/availability", "Public", "Checks subdomain availability"],
        ["POST", "/signup (multipart)", "Public", "Creates tenant + user + KYC docs; returns Stripe checkout URL"],
        ["POST", "/forgot-password", "Public", "Sends reset code"],
        ["POST", "/reset-password", "Public", "Validates code, updates password"],
        ["GET", "/me", "Authenticated", "Current user + tenant from JWT"],
    ],
    col_widths=[12, 40, 25, 93],
)

# ========== Chapter 4: Tenant Module ==========
pdf.chapter_title(4, "Module: tenant - Multi-tenancy")
pdf.section_title("Entity Tenant (tenants table)")
pdf.body_text("id (UUID), companyName, email, subdomain (unique), country, language, companySize, planId, enabledModules (comma-separated), kycStatus (default APPROVED), decisionNote, decidedAt, billingStatus (default NONE/EXEMPT), billingInterval, stripeCustomerId (unique), stripeSubscriptionId (unique), currentPeriodEnd, cancelAtPeriodEnd, currency (default USD), taxId, address, createdAt")
pdf.section_title("Enum KycStatus: PENDING, APPROVED, REJECTED")
pdf.section_title("Repository TenantRepository")
pdf.bullet("findBySubdomain, findByStripeCustomerId, findByStripeSubscriptionId, findByKycStatusOrderByCreatedAtDesc, existsBySubdomain, existsByEmail")

# ========== Chapter 5: KYC Module ==========
pdf.chapter_title(5, "Module: kyc - Know Your Customer (signup document review)")
pdf.section_title("Entity SignupDocument (signup_documents table)")
pdf.bullet("id, tenant (ManyToOne), slot (DocumentSlot), originalFileName, contentType, sizeBytes, storagePath, uploadedAt; unique constraint on (tenant_id, slot)")
pdf.section_title("Enum DocumentSlot: ID_CARD_RECTO, ID_CARD_VERSO, TRADE_REGISTER, TAX_REGISTRATION")
pdf.section_title("Repository SignupDocumentRepository")
pdf.bullet("findByTenantId, findByIdAndTenant_Id, findByTenantIdAndSlot")
pdf.section_title("Service KycStorageService")
pdf.bullet("Local filesystem storage: {storageDir}/{tenantId}/{userId}/{documentId}.{ext}")
pdf.bullet("Allowed types: image/png, image/jpeg, application/pdf; max 2 MB per file")
pdf.bullet("Validates extension + magic-byte signature; path-traversal protection")
pdf.section_title("Service SignupReviewService (super-admin)")
pdf.bullet("list(status), download(tenantId, documentId), approve(tenantId) - requires billing ACTIVE/EXEMPT, reject(tenantId, note)")
pdf.section_title("Controller KycAdminController (/api/v1/admin/signups)")
pdf.table(
    ["Method", "Path", "Auth", "Description"],
    [
        ["GET", "", "super-admin", "List signups by KYC status"],
        ["GET", "/{tenantId}/documents/{documentId}", "super-admin", "Download a KYC document"],
        ["POST", "/{tenantId}/approve", "super-admin", "Approve signup (sets KYC APPROVED)"],
        ["POST", "/{tenantId}/reject", "super-admin", "Reject signup with note"],
    ],
    col_widths=[12, 55, 25, 78],
)

# ========== Chapter 6: Billing Module ==========
pdf.chapter_title(6, "Module: billing - Stripe Subscriptions")
pdf.section_title("Enums")
pdf.bullet("BillingStatus: NONE, PENDING, ACTIVE, PAST_DUE, CANCELED, EXEMPT - allowsPlatformAccess() (ACTIVE or EXEMPT), allowsKycApproval(), fromStripe(String)")
pdf.bullet("BillingInterval: MONTHLY, ANNUAL - fromStripe(String) (\"month\"/\"year\")")
pdf.section_title("Entity StripeEvent (stripe_events table)")
pdf.bullet("id (String), type, processedAt - idempotency for webhook retries")
pdf.section_title("Repository StripeEventRepository: JpaRepository<StripeEvent, String>")
pdf.section_title("Services")
pdf.bullet("BillingService: checkout (creates Stripe Checkout session, sets PENDING), subscription (status), portal (Billing Portal session), deleteCustomerQuietly")
pdf.bullet("StripeWebhookService: verifies signature, processes events, idempotent via StripeEventRepository")
pdf.bullet("StripePriceCatalog: maps plan+interval -> Stripe Price ID from env")
pdf.bullet("SubscriptionSync: copies Stripe subscription fields onto Tenant")
pdf.section_title("Controllers")
pdf.table(
    ["Method", "Path", "Auth", "Description"],
    [
        ["POST", "/billing/checkout-session", "Authenticated", "Create Stripe Checkout session"],
        ["GET", "/billing/subscription", "Authenticated", "Get billing status"],
        ["POST", "/billing/portal-session", "Authenticated", "Create Billing Portal session"],
        ["POST", "/webhooks/stripe", "Public (signature verified)", "Stripe webhook handler"],
    ],
    col_widths=[12, 45, 35, 78],
)

# ========== Chapter 7: Config & Common ==========
pdf.chapter_title(7, "Module: config & common")
pdf.section_title("SecurityConfig (stateless JWT)")
pdf.bullet("Public paths (permitAll): login, refresh, logout, signup, signup/availability, forgot-password, reset-password, webhooks/stripe")
pdf.bullet("/api/v1/auth/me: authenticated")
pdf.bullet("/api/v1/admin/**: hasAuthority(super-admin)")
pdf.bullet("/api/v1/billing/**: hasAnyAuthority(kyc:pending, kyc:approved)")
pdf.bullet("/api/**: hasAuthority(access:full)")
pdf.bullet("anyRequest: authenticated")
pdf.bullet("JWT converter: adds role authority, kyc:<status> authority, and access:full when kyc=approved AND billing active/exempt")
pdf.bullet("403 handler: returns descriptive message (registration pending approval, registration rejected, payment required, access denied)")
pdf.bullet("HS256 JWT encoder/decoder, BCryptPasswordEncoder, CORS (localhost:4200)")
pdf.section_title("JwtService")
pdf.bullet("Generates HS256 tokens with claims: userId, role, permissions, kycStatus, billingStatus, tenantId")
pdf.bullet("Access token expiration: 15 min; refresh: 30 days")
pdf.section_title("GlobalExceptionHandler (@RestControllerAdvice)")
pdf.bullet("AuthException -> { message: \"...\" } with the exception's status")
pdf.bullet("Validation errors -> 400 with first field error")
pdf.bullet("Type mismatch -> 400; Missing multipart part -> 400; Max upload size -> 413; Unexpected -> 500 internal error")
pdf.section_title("AuthException: RuntimeException carrying an HTTP status code")

# ========== Chapter 8: API Summary ==========
pdf.chapter_title(8, "API Summary (all /api/v1/)")
pdf.section_title("Auth")
pdf.code_block([
    "POST   /auth/login",
    "POST   /auth/refresh",
    "POST   /auth/logout",
    "GET    /auth/signup/availability?subdomain=...",
    "POST   /auth/signup          (multipart: data + 4 KYC files)",
    "POST   /auth/forgot-password",
    "POST   /auth/reset-password",
    "GET    /auth/me",
])
pdf.section_title("Billing (authenticated; tenant derived from JWT)")
pdf.code_block([
    "POST   /billing/checkout-session   { interval: \"MONTHLY\"|\"ANNUAL\" }",
    "GET    /billing/subscription",
    "POST   /billing/portal-session",
])
pdf.section_title("Webhooks (public)")
pdf.code_block(["POST   /webhooks/stripe   (Stripe-Signature header required)"])
pdf.section_title("Admin (super-admin only)")
pdf.code_block([
    "GET    /admin/signups?status=PENDING",
    "GET    /admin/signups/{tenantId}/documents/{documentId}",
    "POST   /admin/signups/{tenantId}/approve",
    "POST   /admin/signups/{tenantId}/reject   { note }",
])

# ========== Chapter 9: Configuration ==========
pdf.chapter_title(9, "Configuration (application.properties)")
pdf.table(
    ["Property", "Default", "Description"],
    [
        ["server.port", "8080", ""],
        ["spring.datasource.url", "jdbc:postgresql://localhost:5433/erp_db", ""],
        ["spring.datasource.password", "${DB_PASSWORD:erpdev1234}", ""],
        ["spring.jpa.hibernate.ddl-auto", "update", ""],
        ["app.jwt.secret", "dev-only-secret-change-me-32-bytes-min!!", "HS256, override via JWT_SECRET"],
        ["app.jwt.expiration-ms", "900000 (15 min)", ""],
        ["app.jwt.refresh-expiration-ms", "2592000000 (30 days)", ""],
        ["app.cors.allowed-origins", "http://localhost:4200", "Angular frontend"],
        ["app.kyc.storage-dir", "./uploads/images", ""],
        ["app.kyc.max-file-size-kb", "2048", ""],
        ["app.password-reset.code-ttl-minutes", "15", ""],
        ["app.password-reset.max-attempts", "5", ""],
        ["app.password-reset.resend-cooldown-seconds", "60", ""],
        ["Stripe keys/URLs/prices", "from env (STRIPE_*)", ""],
        ["spring.servlet.multipart.max-file-size", "3MB", ""],
        ["spring.servlet.multipart.max-request-size", "12MB", ""],
    ],
    col_widths=[55, 50, 65],
)
pdf.body_text("Secrets loaded from optional .env file (gitignored). Never commit real credentials.")

# ========== Chapter 10: Security Model ==========
pdf.chapter_title(10, "Security Model Summary")
pdf.bullet("Stateless JWT (HS256), no HTTP sessions")
pdf.bullet("Passwords hashed with BCrypt; never logged")
pdf.bullet("Refresh tokens stored as SHA-256 hashes; rotation on use")
pdf.bullet("Authorization derived from JWT claims: role, kycStatus, billingStatus -> authorities")
pdf.bullet("Tenant always derived from authenticated user's JWT, never from request body")
pdf.bullet("Password reset: 6-digit numeric code, email-only, rate-limited, attempt-capped, TTL-enforced")
pdf.bullet("KYC files: magic-byte validation, path-traversal protection, 2 MB cap, PNG/JPEG/PDF only")
pdf.bullet("CORS restricted to http://localhost:4200")

# ========== Chapter 11: Testing ==========
pdf.chapter_title(11, "Testing")
pdf.bullet("JUnit 5, @SpringBootTest context load test (ErpApplicationTests)")
pdf.bullet("Test classes: SignupReviewServiceTest, KycStorageServiceTest, JwtServiceTest, StripePriceCatalogTest, BillingStatusTest, BillingIntervalTest, RefreshTokenServiceTest, PlanResolverTest, PasswordResetServiceTest, AuthServiceTest, RolePermissionsTest")
pdf.bullet("Run: .\\mvnw.cmd test")

# ========== Chapter 12: Key Design Decisions ==========
pdf.chapter_title(12, "Key Design Decisions & Notes")
pdf.bullet("Multi-tenant by subdomain: each signup creates a Tenant + an ADMIN_ENTREPRISE user; KYC starts PENDING, billing starts NONE")
pdf.bullet("Payment-gated approval: KYC approval requires billingStatus to be ACTIVE or EXEMPT (Stripe checkout completed)")
pdf.bullet("Super-admin bypass: SUPER_ADMIN role has empty permissions map and is exempt from KYC/billing checks")
pdf.bullet("No Flyway yet: schema managed by ddl-auto=update")
pdf.bullet("Documents stored locally (not S3): {storageDir}/{tenantId}/{userId}/{documentId}.{ext}")
pdf.bullet("Stripe webhook idempotency: processed event IDs stored in stripe_events table")

# ========== Chapter 13: Observations ==========
pdf.chapter_title(13, "Observations / Potential Improvements")
pdf.bullet("No Flyway/Liquibase for schema migrations (ddl-auto=update is dev-only)")
pdf.bullet("KYC storage is local filesystem; consider object storage for production")
pdf.bullet("No refresh-token reuse detection / family revocation on theft")
pdf.bullet("Password reset codes are per-user (OneToOne), not multiple concurrent codes")
pdf.bullet("Billing depends on Stripe being configured; endpoints return 503 if secret key missing")
pdf.bullet("RolePermissions map is hardcoded and must stay in sync with the Angular rbac.ts")

# Output
out_path = os.path.abspath("ERP_Backend_Technical_Report.pdf")
pdf.output(out_path)
print("PDF generated: " + out_path)
