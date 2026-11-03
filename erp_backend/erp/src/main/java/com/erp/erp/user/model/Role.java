package com.erp.erp.user.model;

/**
 * The 8 roles of the platform. The code is the exact string used by the
 * Angular frontend (e.g. "admin-entreprise") so both sides speak the same
 * language.
 */
public enum Role {
    SUPER_ADMIN("super-admin"),
    ADMIN_ENTREPRISE("admin-entreprise"),
    COMMERCIAL("commercial"),
    ACHETEUR("acheteur"),
    MAGASINIER("magasinier"),
    COMPTABLE("comptable"),
    DIRECTEUR("directeur"),
    CLIENT_EXTERNE("client-externe");

    private final String code;

    Role(String code) {
        this.code = code;
    }

    public String getCode() {
        return code;
    }

    public static Role fromCode(String code) {
        for (Role role : values()) {
            if (role.code.equals(code)) {
                return role;
            }
        }
        throw new IllegalArgumentException("Unknown role: " + code);
    }
}
