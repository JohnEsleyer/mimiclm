import React, { useState, useEffect, useRef } from 'react';
import { EventsOn } from '../wailsjs/runtime/runtime';
import { GetPendingRequests, ResolveRequest } from '../wailsjs/go/main/App';

// --- TYPES ---
interface ChatMessage {
  role: string;
  content: any;
}

interface PendingRequest {
  id: string;
  timestamp: string;
  payload: {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    tools?: any;
  };
}

interface DropdownOption {
  label: string;
  value: string | number;
  description?: string;
}

const ENDPOINT_BASE = "http://localhost:8080/v1";

const TEMPLATES: DropdownOption[] = [
  { 
    label: "Simple Text Response", 
    value: "Hello! I am MimicLM pretending to be an AI. How can I assist you today?",
    description: "Standard text output wrapped in OpenAI format"
  },
  { 
    label: "JSON Object Output", 
    value: `{\n  "status": "success",\n  "data": {\n    "user_id": "usr_99182",\n    "role": "administrator",\n    "active": true\n  }\n}`,
    description: "Pre-formatted JSON payload for testing schemas"
  },
  { 
    label: "Tool / Function Call", 
    value: `{\n  "id": "chatcmpl-tool-123",\n  "object": "chat.completion",\n  "choices": [{\n    "message": {\n      "role": "assistant",\n      "tool_calls": [{\n        "id": "call_abc123",\n        "type": "function",\n        "function": {\n          "name": "get_current_weather",\n          "arguments": "{\\"location\\": \\"San Francisco, CA\\"}"\n        }\n      }]\n    },\n    "finish_reason": "tool_calls"\n  }]\n}`,
    description: "Simulates an LLM triggering a tool call"
  }
];

const STATUS_CODES: DropdownOption[] = [
  { label: "200 OK", value: 200, description: "Normal successful completion" },
  { label: "429 Rate Limit Exceeded", value: 429, description: "Simulate API rate limiting" },
  { label: "500 Internal Server Error", value: 500, description: "Simulate LLM backend failure" },
  { label: "401 Unauthorized", value: 401, description: "Simulate invalid API key" },
];

// --- CUSTOM REUSABLE DROPDOWN COMPONENT ---
function CustomDropdown({ 
  options, 
  value, 
  onChange, 
  placeholder = "Select an option..." 
}: { 
  options: DropdownOption[]; 
  value: string | number; 
  onChange: (val: any) => void; 
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} style={{ position: 'relative', minWidth: '180px' }}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#09090b',
          color: '#ffffff',
          border: '1px solid #27272a',
          borderRadius: '6px',
          padding: '8px 12px',
          fontSize: '0.8rem',
          fontFamily: 'monospace',
          cursor: 'pointer',
          outline: 'none',
          transition: 'all 0.15s ease'
        }}
      >
        <span>{selectedOption ? selectedOption.label : placeholder}</span>
        <span style={{ fontSize: '0.65rem', marginLeft: '8px', opacity: 0.6 }}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {/* High-Contrast Dropdown Menu */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          right: 0,
          marginBottom: '6px',
          width: '260px',
          backgroundColor: '#ffffff', // High-contrast popover background
          color: '#000000',           // Dark text
          border: '1px solid #e4e4e7',
          borderRadius: '8px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          overflow: 'hidden',
          padding: '4px'
        }}>
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                style={{
                  padding: '8px 10px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? '#000000' : 'transparent',
                  color: isSelected ? '#ffffff' : '#000000',
                  fontSize: '0.8rem',
                  fontFamily: 'sans-serif',
                  transition: 'background-color 0.1s ease'
                }}
              >
                <div style={{ fontWeight: '600' }}>{opt.label}</div>
                {opt.description && (
                  <div style={{ 
                    fontSize: '0.7rem', 
                    color: isSelected ? '#a1a1aa' : '#71717a', 
                    marginTop: '2px' 
                  }}>
                    {opt.description}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- MAIN APP COMPONENT ---
export default function App() {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [responseInput, setResponseInput] = useState<string>(TEMPLATES[0].value as string);
  const [statusCode, setStatusCode] = useState<number>(200);
  const [copied, setCopied] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const selectedReq = requests.find(r => r.id === selectedId);

  useEffect(() => {
    GetPendingRequests().then((res: any) => {
      setRequests(res || []);
      if (res && res.length > 0) setSelectedId(res[0].id);
    });

    EventsOn('new_request', (req: PendingRequest) => {
      setRequests(prev => [...prev, req]);
      setSelectedId(prev => prev ?? req.id);
    });

    EventsOn('request_cancelled', (id: string) => {
      setRequests(prev => prev.filter(r => r.id !== id));
      setSelectedId(prev => (prev === id ? null : prev));
    });
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(ENDPOINT_BASE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async () => {
    if (!selectedId) return;
    await ResolveRequest(selectedId, responseInput, statusCode);
    setRequests(prev => prev.filter(r => r.id !== selectedId));
    const remaining = requests.filter(r => r.id !== selectedId);
    setSelectedId(remaining.length > 0 ? remaining[0].id : null);
  };

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh', 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', 
      backgroundColor: '#09090b', 
      color: '#f4f4f5',
      letterSpacing: '-0.01em'
    }}>
      
      {/* Sidebar */}
      <div style={{ 
        width: '320px', 
        borderRight: '1px solid #27272a', 
        padding: '20px', 
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: '#000000'
      }}>
        
        {/* App Title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ffffff' }}></div>
            <h1 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#ffffff', margin: 0, letterSpacing: '0.05em' }}>
              MIMIC<span style={{ color: '#71717a' }}>LM</span>
            </h1>
          </div>
          <span style={{ fontSize: '0.65rem', border: '1px solid #27272a', padding: '2px 6px', borderRadius: '4px', color: '#a1a1aa', fontFamily: 'monospace' }}>
            v1.0.0
          </span>
        </div>

        {/* --- ENDPOINT CARD --- */}
        <div style={{
          backgroundColor: '#09090b',
          border: '1px solid #27272a',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '20px'
        }}>
          <div style={{ fontSize: '0.65rem', color: '#71717a', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Target API Base URL
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <code style={{ fontSize: '0.75rem', color: '#ffffff', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
              {ENDPOINT_BASE}
            </code>
            <button 
              onClick={handleCopy}
              style={{
                backgroundColor: copied ? '#ffffff' : '#18182b',
                color: copied ? '#000000' : '#ffffff',
                border: '1px solid #27272a',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '0.65rem',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'all 0.15s ease'
              }}
            >
              {copied ? 'COPIED' : 'COPY'}
            </button>
          </div>
          <button 
            onClick={() => setShowGuide(!showGuide)}
            style={{ marginTop: '10px', background: 'none', border: 'none', color: '#a1a1aa', fontSize: '0.7rem', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
          >
            {showGuide ? 'Hide integration code' : 'View integration code'}
          </button>
        </div>

        {/* Integration Code Helper */}
        {showGuide && (
          <div style={{ backgroundColor: '#09090b', padding: '10px', borderRadius: '6px', fontSize: '0.7rem', marginBottom: '20px', border: '1px solid #27272a', fontFamily: 'monospace' }}>
            <div style={{ color: '#71717a', marginBottom: '4px' }}># Python OpenAI SDK</div>
            <div style={{ color: '#a1a1aa', whiteSpace: 'pre-wrap' }}>
              client = OpenAI(<br/>
              &nbsp;&nbsp;base_url="{ENDPOINT_BASE}",<br/>
              &nbsp;&nbsp;api_key="mock"<br/>
              )
            </div>
          </div>
        )}

        {/* Queue Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', marginBottom: '12px', color: '#71717a', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span>Pending Intercepts</span>
          <span style={{ backgroundColor: '#18182b', padding: '2px 6px', borderRadius: '10px', color: '#ffffff' }}>
            {requests.length}
          </span>
        </div>

        {/* Request List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {requests.length === 0 ? (
            <div style={{ padding: '30px 10px', color: '#3f3f46', fontSize: '0.8rem', textAlign: 'center', border: '1px dashed #18181b', borderRadius: '8px' }}>
              Listening for outgoing API requests...
            </div>
          ) : (
            requests.map(req => {
              const isActive = selectedId === req.id;
              return (
                <div
                  key={req.id}
                  onClick={() => setSelectedId(req.id)}
                  style={{
                    padding: '12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: isActive ? '#18181b' : '#09090b',
                    border: isActive ? '1px solid #52525b' : '1px solid #18181b',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: '600', color: isActive ? '#ffffff' : '#a1a1aa' }}>
                      {req.payload.model || 'gpt-4o'}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: '#52525b', fontFamily: 'monospace' }}>
                      {req.timestamp}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#71717a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {req.payload.messages?.length || 0} messages in payload
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Workspace */}
      {selectedReq ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px', gap: '20px', overflowY: 'auto' }}>
          
          {/* Top Panel: Incoming Request Inspector */}
          <div style={{ backgroundColor: '#000000', borderRadius: '8px', padding: '16px', border: '1px solid #27272a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Payload Inspector — {selectedReq.payload.model}
              </div>
              <div style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#52525b' }}>
                ID: {selectedReq.id}
              </div>
            </div>

            {/* Message History Feed */}
            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedReq.payload.messages?.map((msg, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    fontSize: '0.8rem', 
                    padding: '10px 12px', 
                    borderRadius: '6px', 
                    backgroundColor: '#09090b',
                    border: '1px solid #18181b',
                    fontFamily: 'monospace',
                    lineHeight: '1.4'
                  }}
                >
                  <span style={{ 
                    display: 'inline-block',
                    fontSize: '0.65rem',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    marginRight: '8px',
                    backgroundColor: msg.role === 'system' ? '#27272a' : msg.role === 'user' ? '#ffffff' : '#3f3f46',
                    color: msg.role === 'user' ? '#000000' : '#ffffff'
                  }}>
                    {msg.role}
                  </span>
                  <span style={{ color: '#d4d4d8' }}>
                    {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Panel: Response Composer */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Draft Response Output
              </div>
              
              {/* Custom Dropdowns */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <CustomDropdown
                  options={TEMPLATES}
                  value={responseInput}
                  onChange={(val) => setResponseInput(val)}
                  placeholder="Load Template..."
                />
                <CustomDropdown
                  options={STATUS_CODES}
                  value={statusCode}
                  onChange={(val) => setStatusCode(Number(val))}
                />
              </div>
            </div>

            {/* Editor Area */}
            <textarea
              value={responseInput}
              onChange={(e) => setResponseInput(e.target.value)}
              placeholder="Type your pretend LLM response or raw JSON payload here..."
              style={{
                flex: 1,
                minHeight: '220px',
                backgroundColor: '#000000',
                color: '#ffffff',
                border: '1px solid #27272a',
                borderRadius: '8px',
                padding: '16px',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '0.85rem',
                lineHeight: '1.5',
                resize: 'none',
                outline: 'none'
              }}
            />

            {/* Stark White Primary Action Button */}
            <button
              onClick={handleSend}
              style={{
                backgroundColor: '#ffffff',
                color: '#000000',
                border: 'none',
                padding: '14px',
                borderRadius: '6px',
                fontWeight: '700',
                cursor: 'pointer',
                fontSize: '0.85rem',
                letterSpacing: '0.02em',
                transition: 'opacity 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              SEND MOCK RESPONSE TO CLIENT ➔
            </button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#52525b', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid #27272a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: '#a1a1aa' }}>
            ⚡
          </div>
          <div style={{ fontSize: '0.9rem', color: '#a1a1aa' }}>Waiting for incoming API requests...</div>
          <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#52525b' }}>
            Target: {ENDPOINT_BASE}/chat/completions
          </div>
        </div>
      )}
    </div>
  );
}
