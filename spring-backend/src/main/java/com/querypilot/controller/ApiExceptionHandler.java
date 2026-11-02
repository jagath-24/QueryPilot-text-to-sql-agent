package com.querypilot.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(IllegalArgumentException.class) ResponseEntity<?> badRequest(IllegalArgumentException ex) { return ResponseEntity.badRequest().body(Map.of("timestamp", Instant.now().toString(), "error", ex.getMessage())); }
    @ExceptionHandler(IllegalStateException.class) ResponseEntity<?> state(IllegalStateException ex) { return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of("timestamp", Instant.now().toString(), "error", ex.getMessage())); }
}
