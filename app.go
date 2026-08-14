package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx   context.Context
	store *RequestStore
}

func NewApp() *App {
	return &App{
		store: NewRequestStore(),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	go a.startHTTPServer()
}

func (a *App) startHTTPServer() {
	mux := http.NewServeMux()

	// OpenAI & OpenRouter Endpoints
	mux.HandleFunc("/v1/chat/completions", a.handleOpenAIOrOpenRouter)
	mux.HandleFunc("/api/v1/chat/completions", a.handleOpenRouterExplicit)
	mux.HandleFunc("/v1/models", a.handleModels)

	// Anthropic Endpoints
	mux.HandleFunc("/v1/messages", a.handleAnthropic)

	// Ollama Endpoints
	mux.HandleFunc("/api/chat", a.handleOllama)

	fmt.Println("MimicLM Multi-Provider HTTP Server listening on http://localhost:8080")
	if err := http.ListenAndServe(":8080", mux); err != nil {
		fmt.Printf("HTTP Server Error: %v\n", err)
	}
}

func (a *App) handleOpenAIOrOpenRouter(w http.ResponseWriter, r *http.Request) {
	provider := "OpenAI"
	// Detect OpenRouter via specific headers or model slug (e.g. anthropic/claude-3)
	if r.Header.Get("HTTP-Referer") != "" || r.Header.Get("X-Title") != "" || strings.Contains(r.URL.Path, "/api/v1") {
		provider = "OpenRouter"
	}
	a.processGenericRequest(w, r, provider)
}

func (a *App) handleOpenRouterExplicit(w http.ResponseWriter, r *http.Request) {
	a.processGenericRequest(w, r, "OpenRouter")
}

func (a *App) handleAnthropic(w http.ResponseWriter, r *http.Request) {
	a.processGenericRequest(w, r, "Anthropic")
}

func (a *App) handleOllama(w http.ResponseWriter, r *http.Request) {
	a.processGenericRequest(w, r, "Ollama")
}

func (a *App) handleModels(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"object":"list","data":[{"id":"openai/gpt-4o","object":"model"},{"id":"anthropic/claude-3.5-sonnet","object":"model"}]}`))
}

func (a *App) processGenericRequest(w http.ResponseWriter, r *http.Request, provider string) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "*")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	var reqPayload ChatCompletionRequest
	json.NewDecoder(r.Body).Decode(&reqPayload)

	// If model contains provider prefix (e.g. anthropic/claude-3), mark as OpenRouter
	if strings.Contains(reqPayload.Model, "/") && provider == "OpenAI" {
		provider = "OpenRouter"
	}

	headers := make(map[string]string)
	for k, v := range r.Header {
		if len(v) > 0 {
			headers[k] = v[0]
		}
	}

	reqID := uuid.New().String()
	pending := &PendingRequest{
		ID:        reqID,
		Timestamp: time.Now().Format("15:04:05"),
		Provider:  provider,
		Headers:   headers,
		Payload:   reqPayload,
		RespChan:  make(chan MockResponse),
	}

	a.store.Add(pending)

	runtime.EventsEmit(a.ctx, "new_request", PendingRequestDTO{
		ID:        pending.ID,
		Timestamp: pending.Timestamp,
		Provider:  pending.Provider,
		Headers:   pending.Headers,
		Payload:   pending.Payload,
	})

	select {
	case resp := <-pending.RespChan:
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(resp.StatusCode)
		w.Write([]byte(resp.Body))

	case <-r.Context().Done():
		a.store.Remove(reqID)
		runtime.EventsEmit(a.ctx, "request_cancelled", reqID)
	}
}

func (a *App) GetPendingRequests() []PendingRequestDTO {
	var dtos []PendingRequestDTO
	for _, req := range a.store.List() {
		dtos = append(dtos, PendingRequestDTO{
			ID:        req.ID,
			Timestamp: req.Timestamp,
			Provider:  req.Provider,
			Headers:   req.Headers,
			Payload:   req.Payload,
		})
	}
	return dtos
}

func (a *App) ResolveRequest(reqID string, responseText string, statusCode int) bool {
	pending, ok := a.store.Get(reqID)
	if !ok {
		return false
	}

	var finalJSON string
	var js map[string]interface{}

	// If user wrote raw valid JSON, use as-is
	if err := json.Unmarshal([]byte(responseText), &js); err == nil {
		finalJSON = responseText
	} else {
		// Format plain text based on Provider target
		switch pending.Provider {
		case "Anthropic":
			anthropicResp := map[string]interface{}{
				"id":    "msg_" + reqID[:8],
				"type":  "message",
				"role":  "assistant",
				"model": pending.Payload.Model,
				"content": []map[string]interface{}{
					{"type": "text", "text": responseText},
				},
				"stop_reason": "end_turn",
			}
			bytes, _ := json.Marshal(anthropicResp)
			finalJSON = string(bytes)

		case "Ollama":
			ollamaResp := map[string]interface{}{
				"model":      pending.Payload.Model,
				"created_at": time.Now().Format(time.RFC3339),
				"message": map[string]string{
					"role":    "assistant",
					"content": responseText,
				},
				"done": true,
			}
			bytes, _ := json.Marshal(ollamaResp)
			finalJSON = string(bytes)

		default: // OpenAI & OpenRouter standard
			openAIResp := map[string]interface{}{
				"id":      "gen-" + reqID[:8],
				"object":  "chat.completion",
				"created": time.Now().Unix(),
				"model":   pending.Payload.Model,
				"choices": []map[string]interface{}{
					{
						"index": 0,
						"message": map[string]string{
							"role":    "assistant",
							"content": responseText,
						},
						"finish_reason": "stop",
					},
				},
			}
			bytes, _ := json.Marshal(openAIResp)
			finalJSON = string(bytes)
		}
	}

	pending.RespChan <- MockResponse{
		StatusCode: statusCode,
		Body:       finalJSON,
	}

	a.store.Remove(reqID)
	return true
}
