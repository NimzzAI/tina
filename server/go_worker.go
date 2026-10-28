package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type RateState struct {
	Buckets map[string][]int64 `json:"buckets"`
}

type GoSecurityResult struct {
	Allowed       bool   `json:"allowed"`
	Reason        string `json:"reason,omitempty"`
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

type ProbeResult struct {
	URL               string `json:"url"`
	ContentType       string `json:"contentType"`
	ContentLength     int64  `json:"contentLength"`
	FilesizeFormatted string `json:"filesizeFormatted"`
	Status            int    `json:"status"`
	Runtime           string `json:"runtime"`
}

const (
	windowSec = 15 * 60
	maxReq    = 15
	burstSec  = 60
	maxBurst  = 5
)

func formatBytes(b int64) string {
	if b <= 0 {
		return ""
	}
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(b)/float64(div), "KMGTPE"[exp])
}

func main() {
	if len(os.Args) < 2 {
		fmt.Println(`{"error":"missing command"}`)
		os.Exit(1)
	}

	cmd := os.Args[1]

	if cmd == "ratelimit" {
		ip := "127.0.0.1"
		deviceID := "TINA-DEV-LOCAL"
		consume := false
		stateFile := "/tmp/tina_go_ratelimit.json"

		if len(os.Args) > 2 {
			ip = os.Args[2]
		}
		if len(os.Args) > 3 {
			deviceID = os.Args[3]
		}
		if len(os.Args) > 4 {
			consume = os.Args[4] == "1" || os.Args[4] == "true"
		}
		if len(os.Args) > 5 {
			stateFile = os.Args[5]
		}

		var state RateState
		state.Buckets = make(map[string][]int64)
		if raw, err := os.ReadFile(stateFile); err == nil {
			_ = json.Unmarshal(raw, &state)
			if state.Buckets == nil {
				state.Buckets = make(map[string][]int64)
			}
		}

		now := time.Now().Unix()
		key := ip + "::" + deviceID
		history := state.Buckets[key]

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

		isWindowExceeded := len(valid) >= maxReq
		isBurstExceeded := burstCount >= maxBurst
		allowed := !isWindowExceeded && !isBurstExceeded

		reason := ""
		if isBurstExceeded {
			reason = "Batas kecepatan terlampaui (maksimal 5 permintaan per menit)."
		} else if isWindowExceeded {
			reason = "Kuota 15 unduhan per 15 menit untuk IP & Device ID ini telah habis."
		}

		if consume && allowed {
			valid = append(valid, now)
			burstCount++
		}
		state.Buckets[key] = valid

		_ = os.MkdirAll(filepath.Dir(stateFile), 0755)
		if outBytes, err := json.Marshal(state); err == nil {
			_ = os.WriteFile(stateFile, outBytes, 0644)
		}

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

		res := GoSecurityResult{
			Allowed:       allowed,
			Reason:        reason,
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
			Runtime:       "go1.22.8",
		}
		enc, _ := json.Marshal(res)
		fmt.Println(string(enc))
		return
	}

	if cmd == "probe" {
		targetURL := ""
		if len(os.Args) > 2 {
			targetURL = os.Args[2]
		}
		client := &http.Client{
			Timeout: 4 * time.Second,
		}
		req, err := http.NewRequest("HEAD", targetURL, nil)
		if err != nil || !strings.HasPrefix(targetURL, "http") {
			fmt.Println(`{"status":0,"runtime":"go1.22.8"}`)
			return
		}
		req.Header.Set("User-Agent", "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/122.0.0.0 Mobile Safari/537.36")
		resp, err := client.Do(req)
		if err != nil {
			fmt.Println(`{"status":0,"runtime":"go1.22.8"}`)
			return
		}
		defer resp.Body.Close()

		cl, _ := strconv.ParseInt(resp.Header.Get("Content-Length"), 10, 64)
		out := ProbeResult{
			URL:               targetURL,
			ContentType:       resp.Header.Get("Content-Type"),
			ContentLength:     cl,
			FilesizeFormatted: formatBytes(cl),
			Status:            resp.StatusCode,
			Runtime:           "go1.22.8",
		}
		enc, _ := json.Marshal(out)
		fmt.Println(string(enc))
		return
	}
}