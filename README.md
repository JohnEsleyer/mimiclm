# MimicLM

**MimicLM** is a desktop tool for intercepting, inspecting, and mocking OpenAI-compatible HTTP API requests in real time. Built with **Go**, **Wails v2**, **React**, and **TypeScript**, MimicLM provides a local proxy server along with a desktop GUI to inspect incoming LLM requests and draft custom responses.

---

## Features

- **OpenAI-Compatible HTTP Server**: Listens locally on `http://localhost:8080/v1` for `/v1/chat/completions` and `/v1/models`.
- **Blocking Request Queue**: Uses Go channels to block client HTTP requests until you manually respond or the client disconnects.
- **High-Contrast Dark GUI**: Monochromatic, dark-themed React UI (Vercel/Linear-inspired) with custom popover dropdowns and monospaced code inspectors.
- **Preset Templates & Status Selector**: Choose preset responses (text, JSON object, function/tool call) or custom HTTP status codes (`200 OK`, `429 Rate Limit`, `500 Internal Error`, `401 Unauthorized`).
- **Auto-Formatting**: Automatically wraps plain text into standard OpenAI Chat Completion JSON format while preserving raw JSON responses.

---

## Project Structure

```text
mimic-lm/
├── app.go          # Go Wails app struct, HTTP server handlers, and JS bindings
├── server.go       # In-memory thread-safe PendingRequest store
├── types.go        # OpenAI request/response models & internal DTOs
├── main.go         # Application entry point & Wails startup configuration
├── frontend/       # React + TypeScript UI
│   └── src/
│       ├── App.tsx # Main GUI workspace with custom dropdowns & request queue
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

1. **Clone the repository and navigate into the project directory:**
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

Start MimicLM in development mode with live reload:

```bash
wails dev
```

This launches the desktop GUI and starts the embedded HTTP proxy server listening on:
```text
http://localhost:8080/v1
```

---

## Usage Example

Point any client application or SDK using the OpenAI API to `http://localhost:8080/v1`.

### Example 1: `curl`

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello MimicLM!"}
    ]
  }'
```

**Workflow:**
1. The `curl` command will pause and await a server response.
2. The **MimicLM** GUI immediately updates the **Pending Intercepts** queue with the incoming request.
3. Select the request in the GUI to inspect payload messages.
4. Draft your response (or pick a template) and click **SEND MOCK RESPONSE TO CLIENT ➔**.
5. The `curl` command unblocks and receives the formatted response.

### Example 2: Python OpenAI SDK

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="mock-key-not-needed"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Generate a mock user profile"}]
)

print(response.choices[0].message.content)
```

---

## License

MIT