"use client";

import { useState, useRef, useEffect } from "react";

interface ProjectSummary {
  name: string;
  description: string;
  howToUse: string;
  filesCreated: string[];
  techStack: string;
  runInstructions: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  agent?: string;
  content: string;
  timestamp: string;
  type?: "text" | "action_card" | "status" | "build_complete" | "code_preview" | "project_summary";
  actionData?: {
    intent?: string;
    projectName?: string;
    stack?: string;
    estimatedFiles?: number;
    estimatedTime?: string;
    requiresConfirmation?: boolean;
    taskId?: string;
  };
  codePreview?: {
    files: Array<{ name: string; content: string; language: string }>;
  };
  projectSummary?: ProjectSummary;
}

interface ChatStreamProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  onAction?: (action: string, data?: any) => void;
  isLoading?: boolean;
  onStop?: () => void;
  isRunning?: boolean;
  currentTaskId?: string | null;
}

export default function ChatStream({
  messages,
  onSendMessage,
  onAction,
  isLoading = false,
  onStop,
  isRunning = false,
  currentTaskId,
}: ChatStreamProps) {
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue.trim());
      setInputValue("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
    setInputValue(e.target.value);
  };

  const handleAction = (action: string, data?: any) => {
    if (onAction) {
      onAction(action, data);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getAgentColor = (agent?: string) => {
    const colors: Record<string, string> = {
      interface: "#4a9eff",
      planner: "#4a9eff",
      researcher: "#00d9ff",
      architect: "#4eff4e",
      coder: "#7fff00",
      reviewer: "#fff700",
      executor: "#ff6b6b",
      debugger: "#ffa500",
      resource: "#ff69b4",
      marketing: "#9b59b6",
      social: "#e91e63",
      system: "#888888",
    };
    return colors[agent || "system"] || "#888888";
  };

  const getAgentIcon = (agent?: string) => {
    const icons: Record<string, string> = {
      interface: "🤖",
      planner: "📋",
      researcher: "🔍",
      architect: "🏗️",
      coder: "💻",
      reviewer: "✅",
      executor: "⚡",
      debugger: "🐛",
      resource: "🔧",
      marketing: "📢",
      social: "📱",
      system: "⚙️",
    };
    return icons[agent || "system"] || "💬";
  };

  return (
    <div className="chat-stream">
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="welcome-screen">
            <div className="welcome-icon">👋</div>
            <div className="welcome-title">Welcome to comp03!</div>
            <div className="welcome-subtitle">Your AI-powered development partner</div>
            
            <div className="welcome-section">
              <div className="section-title">What I can do:</div>
              <div className="capability-list">
                <div className="capability">
                  <span className="cap-icon">🏗️</span>
                  <span className="cap-text">Build complete applications from descriptions</span>
                </div>
                <div className="capability">
                  <span className="cap-icon">📢</span>
                  <span className="cap-text">Create marketing materials for your projects</span>
                </div>
                <div className="capability">
                  <span className="cap-icon">📱</span>
                  <span className="cap-text">Generate social media content</span>
                </div>
                <div className="capability">
                  <span className="cap-icon">💬</span>
                  <span className="cap-text">Answer questions about your built projects</span>
                </div>
              </div>
            </div>

            <div className="welcome-section">
              <div className="section-title">Quick Start:</div>
              <div className="example-chips">
                <div className="example-chip" onClick={() => onSendMessage("Create a todo list app with React")}>
                  📝 Todo app
                </div>
                <div className="example-chip" onClick={() => onSendMessage("Build a weather dashboard")}>
                  🌤️ Weather dashboard
                </div>
                <div className="example-chip" onClick={() => onSendMessage("Make a landing page for a SaaS product")}>
                  🚀 Landing page
                </div>
              </div>
            </div>

            <div className="welcome-hint">
              Type a description of what you want to build, or ask me anything!
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`chat-message ${message.role} ${message.type === "action_card" ? "action-card-message" : ""} ${message.type === "build_complete" ? "build-complete-message" : ""} ${message.type === "project_summary" ? "project-summary-message" : ""}`}
            >
              {message.role === "assistant" && (
                <div className="message-avatar">{getAgentIcon(message.agent)}</div>
              )}

              <div className="message-content">
                {message.type === "action_card" && message.actionData ? (
                  <ActionCard
                    intent={message.actionData.intent}
                    projectName={message.actionData.projectName}
                    stack={message.actionData.stack}
                    estimatedFiles={message.actionData.estimatedFiles}
                    estimatedTime={message.actionData.estimatedTime}
                    requiresConfirmation={message.actionData.requiresConfirmation}
                    onAction={handleAction}
                  />
                ) : message.type === "build_complete" && message.actionData ? (
                  <BuildCompleteCard
                    projectName={message.actionData.projectName || "Project"}
                    taskId={message.actionData.taskId || currentTaskId || ""}
                    onAction={handleAction}
                  />
                ) : message.type === "project_summary" && message.projectSummary ? (
                  <ProjectSummaryCard summary={message.projectSummary} />
                ) : (
                  <>
                    <div className="message-header">
                      <span className="message-agent" style={{ color: getAgentColor(message.agent) }}>
                        {message.agent || "Assistant"}
                      </span>
                      <span className="message-time">{formatTime(message.timestamp)}</span>
                    </div>
                    <div className="message-text">{message.content}</div>
                  </>
                )}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="chat-message assistant">
            <div className="message-avatar">🤖</div>
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        {isRunning && onStop && (
          <button className="stop-button" onClick={onStop}>
            ⏹️ Stop
          </button>
        )}

        <form onSubmit={handleSubmit} className="chat-input-form">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Describe your project or ask anything..."
            disabled={isLoading}
            rows={1}
            className="chat-textarea"
          />
          <button type="submit" disabled={!inputValue.trim() || isLoading} className="send-button">
            ▶️
          </button>
        </form>

        <div className="chat-hints">
          <span>Press Enter to send, Shift+Enter for new line</span>
        </div>
      </div>

      <style jsx>{`
        .chat-stream {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #1e1e1e;
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }

        .welcome-screen {
          text-align: center;
          padding: 40px 20px;
          color: #ccc;
        }

        .welcome-icon {
          font-size: 64px;
          margin-bottom: 16px;
        }

        .welcome-title {
          font-size: 28px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 8px;
        }

        .welcome-subtitle {
          font-size: 16px;
          color: #888;
          margin-bottom: 32px;
        }

        .welcome-section {
          margin-bottom: 24px;
          text-align: left;
          max-width: 400px;
          margin-left: auto;
          margin-right: auto;
        }

        .section-title {
          font-size: 13px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 12px;
        }

        .capability-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .capability {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          background: #252526;
          border-radius: 8px;
        }

        .cap-icon {
          font-size: 18px;
        }

        .cap-text {
          font-size: 13px;
          color: #ccc;
        }

        .example-chips {
          display: flex;
          gap: 10px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .example-chip {
          background: #2d2d2d;
          color: #4a9eff;
          padding: 10px 16px;
          border-radius: 20px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .example-chip:hover {
          background: #37373d;
          transform: translateY(-2px);
        }

        .welcome-hint {
          margin-top: 24px;
          font-size: 13px;
          color: #666;
        }

        .chat-message {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .chat-message.user {
          flex-direction: row-reverse;
        }

        .message-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #2d2d2d;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
        }

        .message-content {
          max-width: 70%;
          background: #2d2d2d;
          border-radius: 12px;
          padding: 12px 16px;
        }

        .chat-message.user .message-content {
          background: #4a9eff;
          color: #fff;
        }

        .message-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          font-size: 12px;
        }

        .message-agent {
          font-weight: 600;
        }

        .message-time {
          color: #666;
        }

        .message-text {
          font-size: 14px;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .typing-indicator {
          display: flex;
          gap: 4px;
          padding: 8px 0;
        }

        .typing-indicator span {
          width: 8px;
          height: 8px;
          background: #888;
          border-radius: 50%;
          animation: typing 1.4s infinite;
        }

        .typing-indicator span:nth-child(2) {
          animation-delay: 0.2s;
        }

        .typing-indicator span:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes typing {
          0%,
          60%,
          100% {
            transform: translateY(0);
          }
          30% {
            transform: translateY(-8px);
          }
        }

        .chat-input-area {
          border-top: 1px solid #404040;
          padding: 16px;
          background: #252526;
        }

        .stop-button {
          width: 100%;
          background: #ff4444;
          color: #fff;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          margin-bottom: 12px;
          transition: background 0.2s;
        }

        .stop-button:hover {
          background: #ff6666;
        }

        .chat-input-form {
          display: flex;
          gap: 12px;
          align-items: flex-end;
        }

        .chat-textarea {
          flex: 1;
          background: #2d2d2d;
          border: 1px solid #404040;
          border-radius: 8px;
          padding: 12px;
          color: #fff;
          font-size: 14px;
          font-family: inherit;
          resize: none;
          min-height: 44px;
          max-height: 200px;
          transition: border-color 0.2s;
        }

        .chat-textarea:focus {
          outline: none;
          border-color: #4a9eff;
        }

        .send-button {
          background: #4a9eff;
          color: #fff;
          border: none;
          border-radius: 8px;
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.2s;
          font-size: 16px;
        }

        .send-button:hover:not(:disabled) {
          background: #5aafff;
        }

        .send-button:disabled {
          background: #404040;
          cursor: not-allowed;
        }

        .chat-hints {
          text-align: center;
          font-size: 11px;
          color: #666;
          margin-top: 8px;
        }

        .action-card-message,
        .build-complete-message,
        .project-summary-message {
          margin: 20px 0;
        }
      `}</style>
    </div>
  );
}

function ActionCard({
  intent,
  projectName,
  stack,
  estimatedFiles,
  estimatedTime,
  requiresConfirmation,
  onAction,
}: {
  intent?: string;
  projectName?: string;
  stack?: string;
  estimatedFiles?: number;
  estimatedTime?: string;
  requiresConfirmation?: boolean;
  onAction: (action: string, data?: any) => void;
}) {
  return (
    <div className="action-card">
      <div className="action-card-header">
        <span className="action-card-icon">
          {intent === "BUILD" ? "🚀" : intent === "MARKETING" ? "📢" : "📱"}
        </span>
        <span className="action-card-title">
          {intent === "BUILD" ? "Ready to Build" : intent === "MARKETING" ? "Marketing Materials" : "Social Media Content"}
        </span>
      </div>

      {projectName && (
        <div className="action-card-body">
          <div className="action-card-row">
            <span className="action-card-label">Project:</span>
            <span className="action-card-value">{projectName}</span>
          </div>

          {stack && (
            <div className="action-card-row">
              <span className="action-card-label">Stack:</span>
              <span className="action-card-value">{stack}</span>
            </div>
          )}

          {estimatedFiles && (
            <div className="action-card-row">
              <span className="action-card-label">Files:</span>
              <span className="action-card-value">~{estimatedFiles} files</span>
            </div>
          )}

          {estimatedTime && (
            <div className="action-card-row">
              <span className="action-card-label">Time:</span>
              <span className="action-card-value">{estimatedTime}</span>
            </div>
          )}
        </div>
      )}

      {requiresConfirmation ? (
        <div className="action-card-actions">
          <button className="action-btn confirm" onClick={() => onAction("confirm")}>
            ✅ Start Building
          </button>
          <button className="action-btn edit" onClick={() => onAction("edit")}>
            ✏️ Edit Request
          </button>
        </div>
      ) : (
        <div className="action-card-note">
          {intent === "MARKETING" || intent === "SOCIAL_MEDIA" ? "Click below to generate" : "Processing..."}
        </div>
      )}

      <style jsx>{`
        .action-card {
          background: #2d2d2d;
          border: 1px solid #404040;
          border-radius: 12px;
          overflow: hidden;
          max-width: 500px;
        }

        .action-card-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: #37373d;
          border-bottom: 1px solid #404040;
        }

        .action-card-icon {
          font-size: 20px;
        }

        .action-card-title {
          font-weight: 600;
          color: #fff;
          font-size: 14px;
        }

        .action-card-body {
          padding: 16px;
        }

        .action-card-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 13px;
        }

        .action-card-row:last-child {
          margin-bottom: 0;
        }

        .action-card-label {
          color: #888;
        }

        .action-card-value {
          color: #fff;
          font-weight: 500;
        }

        .action-card-actions {
          display: flex;
          gap: 8px;
          padding: 12px 16px;
          border-top: 1px solid #404040;
        }

        .action-btn {
          flex: 1;
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .action-btn.confirm {
          background: #4eff4e;
          color: #000;
        }

        .action-btn.confirm:hover {
          background: #5fff5f;
        }

        .action-btn.edit {
          background: #4a9eff;
          color: #fff;
        }

        .action-btn.edit:hover {
          background: #5aafff;
        }

        .action-card-note {
          padding: 12px 16px;
          color: #888;
          font-size: 13px;
          text-align: center;
          border-top: 1px solid #404040;
        }
      `}</style>
    </div>
  );
}

function BuildCompleteCard({
  projectName,
  taskId,
  onAction,
}: {
  projectName: string;
  taskId: string;
  onAction: (action: string, data?: any) => void;
}) {
  return (
    <div className="build-complete-card">
      <div className="build-header">
        <span className="build-icon">✅</span>
        <span className="build-title">Build Complete!</span>
      </div>

      <div className="build-body">
        <div className="build-project">{projectName}</div>
        <div className="build-message">Your project is ready!</div>
      </div>

      <div className="build-actions">
        <button
          className="build-btn marketing"
          onClick={() => onAction("marketing", { taskId })}
        >
          📢 Create Marketing
        </button>
        <button
          className="build-btn social"
          onClick={() => onAction("social", { taskId })}
        >
          📱 Create Social Posts
        </button>
      </div>

      <style jsx>{`
        .build-complete-card {
          background: linear-gradient(135deg, #1a3a1a 0%, #1e1e1e 100%);
          border: 1px solid #4eff4e;
          border-radius: 12px;
          overflow: hidden;
          max-width: 500px;
        }

        .build-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 16px;
          background: rgba(78, 255, 78, 0.1);
        }

        .build-icon {
          font-size: 24px;
        }

        .build-title {
          font-weight: 700;
          color: #4eff4e;
          font-size: 16px;
        }

        .build-body {
          padding: 16px;
        }

        .build-project {
          font-size: 18px;
          font-weight: 600;
          color: #fff;
          margin-bottom: 4px;
        }

        .build-message {
          font-size: 13px;
          color: #888;
        }

        .build-actions {
          display: flex;
          gap: 8px;
          padding: 12px 16px;
          border-top: 1px solid #404040;
        }

        .build-btn {
          flex: 1;
          padding: 12px 16px;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .build-btn.marketing {
          background: #3d2066;
          color: #b388ff;
        }

        .build-btn.marketing:hover {
          background: #4d3080;
        }

        .build-btn.social {
          background: #4a1a3a;
          color: #ff69b4;
        }

        .build-btn.social:hover {
          background: #5a2a4a;
        }
      `}</style>
    </div>
  );
}

function ProjectSummaryCard({ summary }: { summary: ProjectSummary }) {
  const [showFiles, setShowFiles] = useState(false);

  return (
    <div className="project-summary-card">
      <div className="summary-header">
        <span className="summary-icon">🎉</span>
        <span className="summary-title">Your App is Ready!</span>
      </div>

      <div className="summary-body">
        <div className="summary-section">
          <div className="section-label">📱 What was built:</div>
          <div className="section-content">{summary.description}</div>
        </div>

        <div className="summary-section">
          <div className="section-label">🛠️ Tech Stack:</div>
          <div className="tech-tags">
            {summary.techStack.split(", ").map((tech, i) => (
              <span key={i} className="tech-tag">{tech}</span>
            ))}
          </div>
        </div>

        <div className="summary-section">
          <div className="section-label">🚀 How to Run:</div>
          <div className="run-instructions">{summary.runInstructions}</div>
        </div>

        <div className="summary-section">
          <div className="section-label">📖 How to Use:</div>
          <div className="usage-text">{summary.howToUse}</div>
        </div>

        <div className="summary-section">
          <div 
            className="files-toggle"
            onClick={() => setShowFiles(!showFiles)}
          >
            <span>{showFiles ? "▼" : "▶"}</span>
            <span>{summary.filesCreated.length} files created</span>
          </div>
          {showFiles && (
            <div className="files-list">
              {summary.filesCreated.map((file, i) => (
                <div key={i} className="file-item">
                  <span className="file-icon">📄</span>
                  <span className="file-name">{file}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .project-summary-card {
          background: linear-gradient(135deg, #1a2a3a 0%, #1e1e1e 100%);
          border: 1px solid #4a9eff;
          border-radius: 12px;
          overflow: hidden;
          max-width: 500px;
        }

        .summary-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 16px;
          background: rgba(74, 158, 255, 0.1);
        }

        .summary-icon {
          font-size: 24px;
        }

        .summary-title {
          font-weight: 700;
          color: #4a9eff;
          font-size: 16px;
        }

        .summary-body {
          padding: 16px;
        }

        .summary-section {
          margin-bottom: 16px;
        }

        .summary-section:last-child {
          margin-bottom: 0;
        }

        .section-label {
          font-size: 13px;
          font-weight: 600;
          color: #888;
          margin-bottom: 6px;
        }

        .section-content {
          font-size: 14px;
          color: #fff;
          line-height: 1.5;
        }

        .tech-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .tech-tag {
          background: #2d2d2d;
          border: 1px solid #404040;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          color: #4a9eff;
        }

        .run-instructions {
          background: #2d2d2d;
          padding: 10px 12px;
          border-radius: 6px;
          font-size: 13px;
          color: #4eff4e;
          font-family: 'Cascadia Code', monospace;
        }

        .usage-text {
          font-size: 13px;
          color: #ccc;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .files-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          padding: 8px 0;
          color: #4a9eff;
          font-size: 13px;
        }

        .files-toggle:hover {
          color: #5abfff;
        }

        .files-list {
          margin-top: 8px;
          max-height: 200px;
          overflow-y: auto;
        }

        .file-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 0;
          font-size: 12px;
          color: #888;
        }

        .file-icon {
          font-size: 14px;
        }

        .file-name {
          color: #ccc;
          font-family: 'Cascadia Code', monospace;
        }
      `}</style>
    </div>
  );
}