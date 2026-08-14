package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
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

// HTTP Server running on port 8080
func (a *App) startHTTPServer() {
	mux := http.NewServeMux()

	// OpenAI Compatible Routes
	mux.HandleFunc("/v1/chat/completions", a.handleChatCompletions)
	mux.HandleFunc("/v1/models", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"object":"list","data":[{"id":"gpt-4o","object":"model","created":1686935002,"owned_by":"mimic-lm"}]}`))
	})

	fmt.Println("MimicLM HTTP Server listening on http://localhost:8080")
	if err := http.ListenAndServe(":8080", mux); err != nil {
		fmt.Printf("HTTP Server Error: %v\n", err)
	}
}

func (a *App) handleChatCompletions(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	var reqPayload ChatCompletionRequest
	if err := json.NewDecoder(r.Body).Decode(&reqPayload); err != nil {
		http.Error(w, "Invalid JSON payload", http.StatusBadRequest)
		return
	}

	reqID := uuid.New().String()
	pending := &PendingRequest{
		ID:        reqID,
		Timestamp: time.Now().Format("15:04:05"),
		Payload:   reqPayload,
		RespChan:  make(chan MockResponse),
	}

	a.store.Add(pending)

	// Notify Frontend GUI via Wails Event
	runtime.EventsEmit(a.ctx, "new_request", PendingRequestDTO{
		ID:        pending.ID,
		Timestamp: pending.Timestamp,
		Payload:   pending.Payload,
	})

	// BLOCK UNTIL HUMAN RESPONDS IN GUI OR CLIENT DISCONNECTS
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

// --- Methods Exposed to Wails GUI ---

func (a *App) GetPendingRequests() []PendingRequestDTO {
	return a.store.List()
}

// ResolveRequest unblocks the HTTP Handler and returns response to client
func (a *App) ResolveRequest(reqID string, responseText string, statusCode int) bool {
	pending, ok := a.store.Get(reqID)
	if !ok {
		return false
	}

	// If response text is raw string, wrap it into standard OpenAI Chat Completion JSON format
	var finalJSON string
	var js map[string]interface{}
	if err := json.Unmarshal([]byte(responseText), &js); err == nil {
		// Valid JSON provided by human
		finalJSON = responseText
	} else {
		// Plain text provided -> format automatically into OpenAI schema
		openAIResp := map[string]interface{}{
			"id":      "chatcmpl-" + reqID[:8],
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

	pending.RespChan <- MockResponse{
		StatusCode: statusCode,
		Body:       finalJSON,
	}

	a.store.Remove(reqID)
	return true
}
