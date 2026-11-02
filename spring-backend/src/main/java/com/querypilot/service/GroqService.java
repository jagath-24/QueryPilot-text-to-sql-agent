package com.querypilot.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.querypilot.dto.ApiDtos;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class GroqService {
    private final RestClient client = RestClient.builder().baseUrl("https://api.groq.com/openai/v1").build();
    private final ObjectMapper mapper = new ObjectMapper();
    private final SchemaService schemaService;
    private final String apiKey;
    private final String model;

    public GroqService(SchemaService schemaService, @Value("${querypilot.groq.api-key:}") String apiKey, @Value("${querypilot.groq.model:llama-3.3-70b-versatile}") String model) { this.schemaService = schemaService; this.apiKey = apiKey; this.model = model; }

    public ApiDtos.GenerateResponse generate(String question) {
        if (apiKey == null || apiKey.isBlank()) throw new IllegalStateException("GROQ_API_KEY is not configured");
        String system = "You are a MySQL Text-to-SQL compiler. Return JSON only with keys sql and explanation. Generate exactly one read-only SELECT query. Never use system tables, comments, or mutations. Prefer explicit columns. Schema: " + schemaService.getSchema();
        var body = "{\"model\":\"" + model + "\",\"temperature\":0.1,\"response_format\":{\"type\":\"json_object\"},\"messages\":[{\"role\":\"system\",\"content\":" + quote(system) + "},{\"role\":\"user\",\"content\":" + quote(question) + "}]}";
        String raw = client.post().uri("/chat/completions").header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey).contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(String.class);
        try {
            JsonNode content = mapper.readTree(raw).path("choices").path(0).path("message").path("content");
            JsonNode output = mapper.readTree(content.asText());
            return new ApiDtos.GenerateResponse(output.path("sql").asText(), output.path("explanation").asText());
        } catch (Exception ex) { throw new IllegalStateException("Groq returned invalid JSON", ex); }
    }
    private String quote(String value) { try { return mapper.writeValueAsString(value); } catch (Exception ex) { throw new IllegalStateException(ex); } }
}
