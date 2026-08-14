package main

type ChatMessage struct {
	Role    string      `json:"role"`
	Content interface{} `json:"content"`
}

type ChatCompletionRequest struct {
	Model       string        `json:"model"`
	Messages    []ChatMessage `json:"messages"`
	Temperature float64       `json:"temperature,omitempty"`
	Stream      bool          `json:"stream,omitempty"`
	Tools       interface{}   `json:"tools,omitempty"`
}

type PendingRequest struct {
	ID        string                `json:"id"`
	Timestamp string                `json:"timestamp"`
	Provider  string                `json:"provider"` // "OpenRouter", "OpenAI", "Anthropic", "Ollama"
	Headers   map[string]string     `json:"headers"`
	Payload   ChatCompletionRequest `json:"payload"`
	RespChan  chan MockResponse     `json:"-"`
}

type MockResponse struct {
	StatusCode int
	Body       string
}

type PendingRequestDTO struct {
	ID        string                `json:"id"`
	Timestamp string                `json:"timestamp"`
	Provider  string                `json:"provider"`
	Headers   map[string]string     `json:"headers"`
	Payload   ChatCompletionRequest `json:"payload"`
}
