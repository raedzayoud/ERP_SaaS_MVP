package com.erp.erp.settings.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/** Sends the login details of a new team member. */
@Service
public class TeamMemberMailService {

    private final JavaMailSender mailSender;
    private final String from;

    public TeamMemberMailService(
            JavaMailSender mailSender, @Value("${app.mail.from}") String from) {
        this.mailSender = mailSender;
        this.from = from;
    }

    public void sendCredentials(String email, String password, String workspace) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(email);
        message.setSubject("ERP Cloud - your account on " + workspace);
        message.setText("Your ERP account is ready.\n\n"
                + "Workspace: " + workspace + "\n"
                + "Email: " + email + "\n"
                + "Password: " + password + "\n\n"
                + "Sign in and change your password at your first login.");
        mailSender.send(message);
    }
}
