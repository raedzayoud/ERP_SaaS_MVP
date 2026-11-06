package com.erp.erp.auth.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class PasswordResetMailService {

    private final JavaMailSender mailSender;
    private final String from;
    private final long ttlMinutes;

    public PasswordResetMailService(
            JavaMailSender mailSender,
            @Value("${app.mail.from}") String from,
            @Value("${app.password-reset.code-ttl-minutes}") long ttlMinutes) {
        this.mailSender = mailSender;
        this.from = from;
        this.ttlMinutes = ttlMinutes;
    }

    public void sendCode(String email, String code) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(email);
        message.setSubject("ERP Cloud - reset your password");
        message.setText("Your password reset code is: " + code + "\n\n"
                + "It expires in " + ttlMinutes + " minutes.\n"
                + "If you did not request this, you can ignore this email.");
        mailSender.send(message);
    }
}
