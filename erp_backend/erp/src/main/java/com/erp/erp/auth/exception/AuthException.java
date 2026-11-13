package com.erp.erp.auth.exception;

/** Business error carrying the HTTP status returned to the client. */
public class AuthException extends RuntimeException {

    private final int status;
    private final String code;

    public AuthException(int status, String message) {
        this(status, message, null);
    }

    /** The code is a stable machine name the frontend maps to a translation. */
    public AuthException(int status, String message, String code) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public int getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }
}
