package handler

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"
)

type RateLimitResponse struct {
	Allowed       bool   `json:"allowed"`
	IPAddress     string `json:"ipAddress"`
	DeviceID      string `json:"deviceId"`
	Signature     string `json:"signature"`
	Used          int    `json:"used"`
	Limit         int    `json:"limit"`
	Remaining     int    `json:"remaining"`
	WindowMinutes int    `json:"windowMinutes"`
	ResetAt       int64  `json:"resetAt"`
	BurstUsed     int    `json:"burstUsed"`
	BurstLimit    int    `json:"burstLimit"`
	Runtime       string `json:"runtime"`
}

var (
	mu      sync.Mutex
	buckets = make(map[string][]int64)
)

const (
	windowSec = 15 * 60
	maxReq    = 15
	burstSec  = 60
	maxBurst  = 5
)

func extractIP(r *http.Request) string {
	xff := r.Header.Get("X-Forwarded-For")
	if xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	xri := r.Header.Get("X-Real-Ip")
	if xri != "" {
		return strings.TrimSpace(xri)
	}
	addr := r.RemoteAddr
	if idx := strings.LastIndex(addr, ":"); idx != -1 {
		return addr[:idx]
	}
	if addr == "" {
		return "127.0.0.1"
	}
	return addr
}

// Handler is the Vercel Go Serverless Function entrypoint
func Handler(w http.ResponseWriter, r *http.Request) {
	ip := extractIP(r)
	deviceID := strings.TrimSpace(r.Header.Get("X-Device-ID"))
	if deviceID == "" {
		deviceID = "TINA-DEV-ANONYMOUS"
	}

	consume := r.URL.Query().Get("consume") == "1" || r.Method == http.MethodPost
	now := time.Now().Unix()
	key := ip + "::" + deviceID

	mu.Lock()
	history := buckets[key]
	var valid []int64
	var burstCount int
	for _, ts := range history {
		if now-ts < windowSec {
			valid = append(valid, ts)
			if now-ts < burstSec {
				burstCount++
			}
		}
	}

	allowed := len(valid) < maxReq && burstCount < maxBurst
	if consume && allowed {
		valid = append(valid, now)
		burstCount++
	}
	buckets[key] = valid
	mu.Unlock()

	hash := sha256.Sum256([]byte(key + "::tina-golang-guard"))
	sig := hex.EncodeToString(hash[:8])

	resetAt := (now + windowSec) * 1000
	if len(valid) > 0 {
		resetAt = (valid[0] + windowSec) * 1000
	}

	rem := maxReq - len(valid)
	if rem < 0 {
		rem = 0
	}

	resp := RateLimitResponse{
		Allowed:       allowed,
		IPAddress:     ip,
		DeviceID:      deviceID,
		Signature:     sig,
		Used:          len(valid),
		Limit:         maxReq,
		Remaining:     rem,
		WindowMinutes: 15,
		ResetAt:       resetAt,
		BurstUsed:     burstCount,
		BurstLimit:    maxBurst,
		Runtime:       "go1.22",
	}

	w.Header().Set("Content-Type", "application/json")
	if !allowed && consume {
		w.WriteHeader(http.StatusTooManyRequests)
	}
	_ = json.NewEncoder(w).Encode(resp)
}