package com.querypilot.controller;

import com.querypilot.config.JwtSecurity;
import com.querypilot.dto.ApiDtos;
import com.querypilot.service.QueryService;
import com.querypilot.service.SchemaService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class ApiControllers {
    private final JwtSecurity jwt;
    private final PasswordEncoder encoder;
    private final QueryService queries;
    private final SchemaService schema;

    public ApiControllers(JwtSecurity jwt, PasswordEncoder encoder, QueryService queries, SchemaService schema) { this.jwt = jwt; this.encoder = encoder; this.queries = queries; this.schema = schema; }

    @PostMapping("/auth/signup") public ApiDtos.AuthResponse signup(@Valid @RequestBody ApiDtos.AuthRequest request) { return new ApiDtos.AuthResponse(jwt.issue(request.email(), request.email()), request.email(), request.email(), request.name() == null ? "Analyst" : request.name()); }
    @PostMapping("/auth/login") public ApiDtos.AuthResponse login(@Valid @RequestBody ApiDtos.AuthRequest request) { return new ApiDtos.AuthResponse(jwt.issue(request.email(), request.email()), request.email(), request.email(), "Analyst"); }
    @GetMapping("/schema") public ApiDtos.SchemaResponse schema() { return schema.getSchema(); }
    @PostMapping("/query/generate") public ApiDtos.GenerateResponse generate(@Valid @RequestBody ApiDtos.GenerateRequest request) { return queries.generate(request); }
    @PostMapping("/query/execute") public ApiDtos.ExecuteResponse execute(@Valid @RequestBody ApiDtos.ExecuteRequest request, Authentication auth) { return queries.execute(request, auth.getName()); }
    @GetMapping("/query/history") public Object history(Authentication auth) { return queries.history(auth.getName()); }
    @PostMapping("/query/favorite") public ResponseEntity<?> favorite(@Valid @RequestBody ApiDtos.FavoriteRequest request, Authentication auth) { queries.favorite(auth.getName(), request.queryId()); return ResponseEntity.ok(Map.of("success", true)); }
}
