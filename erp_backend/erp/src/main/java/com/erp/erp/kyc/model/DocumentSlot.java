package com.erp.erp.kyc.model;

import java.util.Locale;
import java.util.Optional;

/**
 * The four documents requested by the signup wizard. The key is the exact
 * name used by the Angular client ("idCardRecto", ...).
 */
public enum DocumentSlot {
    ID_CARD_RECTO("idCardRecto"),
    ID_CARD_VERSO("idCardVerso"),
    TRADE_REGISTER("tradeRegister"),
    TAX_REGISTRATION("taxRegistration");

    private final String key;

    DocumentSlot(String key) {
        this.key = key;
    }

    public String getKey() {
        return key;
    }

    /** Accepts both the frontend key ("idCardRecto") and the enum name ("ID_CARD_RECTO"). */
    public static Optional<DocumentSlot> fromKey(String value) {
        if (value == null) {
            return Optional.empty();
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        for (DocumentSlot slot : values()) {
            if (slot.key.toLowerCase(Locale.ROOT).equals(normalized)
                    || slot.name().toLowerCase(Locale.ROOT).equals(normalized)) {
                return Optional.of(slot);
            }
        }
        return Optional.empty();
    }
}
