package com.querypilot.service;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RateLimitService {
    private final int limit;
    private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();
    public RateLimitService(@Value("${querypilot.rate-limit.queries-per-hour:20}") int limit) { this.limit = limit; }
    public boolean allow(String userId) { return buckets.computeIfAbsent(userId, key -> Bucket.builder().addLimit(Bandwidth.classic(limit, Refill.intervally(limit, Duration.ofHours(1)))).build()).tryConsume(1); }
}
