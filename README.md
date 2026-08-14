# MimicLM

**MimicLM** is a desktop tool for intercepting, inspecting, and mocking requests across multiple LLM API providers (**OpenRouter**, **OpenAI**, **Anthropic**, and **Ollama**). Built with **Go**, **Wails v2**, **React**, and **TypeScript**, MimicLM provides a local proxy server along with a desktop GUI to inspect incoming requests and draft provider-formatted mock responses in real time.

---

## Features

- **Multi-Provider API Endpoints**:
  - **OpenRouter**: `/api/v1/chat/completions` or `/v1/chat/completions` (`http://localhost:8080/api/v1`)
  - **OpenAI**: `/v1/chat/completions` (`http://localhost:8080/v1`)
  - **Anthropic**: `/v1/messages` (`http://localhost:8080/v1`)
  - **Ollama**: `/api/chat` (`http://localhost:8080/api`)
- **Automatic Provider Response Formatting**: Automatically wraps plain text responses into Anthropic (`/v1/messages`), Ollama (`/api/chat`), or OpenAI/OpenRouter (`/v1/chat/completions`) schemas.
- **Provider & Header Detection**: Automatically detects OpenRouter requests via headers (`HTTP-Referer`, `X-Title`) or model slugs (`anthropic/claude-3.5-sonnet`).
- **Blocking Request Queue**: Uses Go channels to block client HTTP requests until you manually respond or the client disconnects.
- **High-Contrast Dark GUI**: Monochromatic, dark-themed React UI with provider badges, header inspection, and custom popover dropdowns.
- **Presets & Status Selector**: Choose provider presets or custom HTTP status codes (`200 OK`, `429 Rate Limit`, `500 Internal Error`).

---

## Project Structure

```text
mimic-lm/
├── app.go          # Multi-provider route handlers, response formatters, and Wails bindings
├── server.go       # In-memory thread-safe PendingRequest store
├── types.go        # Provider data models, header maps, and DTOs
├── main.go         # Application entry point & Wails startup configuration
├── frontend/       # React + TypeScript UI
│   └── src/
│       ├── App.tsx # Multi-provider GUI with endpoint selector and request inspector
│       └── ...
└── README.md
```

---

## Getting Started

### Prerequisites

- [Go](https://go.dev/) (1.18 or higher)
- [Node.js](https://nodejs.org/) & `npm`
- [Wails CLI v2](https://wails.io/docs/gettingstarted/installation)

### Installation & Setup

1. **Navigate into the project directory:**
   ```bash
   cd mimic-lm
   ```

2. **Install frontend dependencies:**
   ```bash
   npm --prefix frontend install
   ```

3. **Generate Wails bindings:**
   ```bash
   wails generate module
   ```

---

## Running MimicLM

Start MimicLM in development mode:

```bash
wails dev
```

This launches the desktop GUI and starts the embedded HTTP server listening on `http://localhost:8080`.

---

## Usage Examples

### OpenRouter (`curl`)

```bash
curl http://localhost:8080/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "HTTP-Referer: https://mytestapp.com" \
  -H "X-Title: My Test App" \
  -d '{
    "model": "anthropic/claude-3.5-sonnet",
    "messages": [{"role": "user", "content": "Test OpenRouter interception!"}]
  }'
```

### Anthropic (`curl`)

```bash
curl http://localhost:8080/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: mock-key" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [{"role": "user", "content": "Hello Anthropic endpoint"}]
  }'
```

---

## License

MIT