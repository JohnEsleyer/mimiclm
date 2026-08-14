package main

// Standard OpenAI Chat Completion Request
type ChatMessage struct {
	Role    string      `json:"role"`
	Content interface{} `json:"content"` // String or Array of parts
}

type ChatCompletionRequest struct {
	Model       string        `json:"model"`
	Messages    []ChatMessage `json:"messages"`
	Temperature float64       `json:"temperature,omitempty"`
	Stream      bool          `json:"stream,omitempty"`
	Tools       interface{}   `json:"tools,omitempty"`
}

// Internal Pending Request structure
type PendingRequest struct {
	ID        string                `json:"id"`
	Timestamp string                `json:"timestamp"`
	Payload   ChatCompletionRequest `json:"payload"`
	RespChan  chan MockResponse     `json:"-"`
}

type MockResponse struct {
	StatusCode int
	Body       string
}

// Wails Data Transfer Object (Without Channel)
type PendingRequestDTO struct {
	ID        string                `json:"id"`
	Timestamp string                `json:"timestamp"`
	Payload   ChatCompletionRequest `json:"payload"`
}
