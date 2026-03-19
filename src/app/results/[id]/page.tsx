"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface ProjectSummary {
  name: string;
  description: string;
  howToUse: string;
  filesCreated: string[];
  techStack: string;
  runInstructions: string;
}

interface MajorDecision {
  decision: string;
  reason: string;
}

interface TaskData {
  task_id: string;
  project_name: string;
  status: string;
  summary: string;
  created_at: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface FileContent {
  path: string;
  content: string;
}

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params?.id as string;

  const [taskData, setTaskData] = useState<TaskData | null>(null);
  const [projectSummary, setProjectSummary] = useState<ProjectSummary | null>(null);
  const [majorDecisions, setMajorDecisions] = useState<MajorDecision[]>([]);
  const [files, setFiles] = useState<FileContent[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (taskId) {
      fetchProjectData();
    }
  }, [taskId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const fetchProjectData = async () => {
    setIsLoading(true);
    try {
      const taskRes = await fetch(`http://localhost:3030/api/tasks/${taskId}`);
      if (taskRes.ok) {
        const taskJson = await taskRes.json();
        setTaskData(taskJson);
      }

      const summaryRes = await fetch(`http://localhost:3030/api/tasks/${taskId}/summary`);
      if (summaryRes.ok) {
        const summaryJson = await summaryRes.json();
        setProjectSummary(summaryJson);
      }

      const decisionsRes = await fetch(`http://localhost:3030/api/tasks/${taskId}/decisions`);
      if (decisionsRes.ok) {
        const decisionsJson = await decisionsRes.json();
        setMajorDecisions(decisionsJson.decisions || []);
      }

      const filesRes = await fetch(`http://localhost:3030/api/tasks/${taskId}/files`);
      if (filesRes.ok) {
        const filesJson = await filesRes.json();
        setFiles(filesJson.files || []);
      }
    } catch (error) {
      console.error("Failed to fetch project data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: chatInput,
      timestamp: new Date().toISOString(),
    };

setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const response = await fetch("http://localhost:3030/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: chatInput,
          conversationHistory: chatMessages.slice(-5).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          projectContext: {
            projectName: taskData?.project_name || "Project",
            taskDescription: projectSummary?.description || taskData?.summary || "",
            filesCreated: projectSummary?.filesCreated || [],
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response?.text || "I can help you understand your project. What would you like to know?",
        timestamp: new Date().toISOString(),
      };

      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I'm here to help you understand your project. Ask me about how it works, the architecture, or how to modify it.",
        timestamp: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleDownloadZip = async () => {
    try {
      const response = await fetch(`http://localhost:3030/api/tasks/${taskId}/download`);
      if (response.ok) {
        const data = await response.json();
        alert(`Project files ready!\n\nFiles: ${data.files?.slice(0, 5).join(", ")}${data.files?.length > 5 ? "..." : ""}\n\nNavigate to the project folder to access all files.`);
      } else {
        alert("Failed to prepare download");
      }
    } catch (error) {
      console.error("Failed to download:", error);
      alert("Failed to prepare download");
    }
  };

  const handleGenerateMarketing = async () => {
    try {
      const response = await fetch("http://localhost:3030/api/marketing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      const data = await response.json();
      if (data.success) {
        alert("Marketing materials generated! Check MARKETING.md in your project folder.");
      } else {
        alert("Failed to generate: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Failed to generate marketing:", error);
      alert("Failed to generate marketing materials");
    }
  };

  const handleGenerateSocial = async () => {
    try {
      const response = await fetch("http://localhost:3030/api/social/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      const data = await response.json();
      if (data.success) {
        alert("Social media content generated! Check SOCIAL_MEDIA.md in your project folder.");
      } else {
        alert("Failed to generate: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Failed to generate social:", error);
      alert("Failed to generate social media content");
    }
  };

  if (isLoading) {
    return (
      <div className="loading-page">
        <div className="loader"></div>
        <p>Loading project results...</p>
        <style jsx>{`
          .loading-page {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            background: #0a0a0a;
            color: #888;
          }
          .loader {
            width: 40px;
            height: 40px;
            border: 3px solid #222;
            border-top-color: #4a9eff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 16px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="results-page">
      <nav className="top-nav">
        <Link href="/" className="nav-brand">comp03</Link>
        <div className="nav-links">
          <Link href="/create" className="nav-link">Create</Link>
          <Link href="/" className="nav-link">Build</Link>
          <Link href="/results" className="nav-link active">Results</Link>
        </div>
      </nav>

      <div className="main-content">
        <div className="results-main">
          <div className="results-header">
            <div className="status-badge success">
              ✅ Build Complete
            </div>
            <h1 className="project-title">{taskData?.project_name || "Project"}</h1>
            <p className="project-date">
              Created {taskData?.created_at ? new Date(taskData.created_at).toLocaleString() : "Unknown"}
            </p>
          </div>

          <section className="results-section">
            <h2>📦 Project Summary</h2>
            <p className="summary-text">
              {projectSummary?.description || taskData?.summary || "No description available."}
            </p>
            {projectSummary?.techStack && (
              <div className="tech-tags">
                {projectSummary.techStack.split(", ").map((tech, i) => (
                  <span key={i} className="tech-tag">{tech}</span>
                ))}
              </div>
            )}
          </section>

          <section className="results-section">
            <h2>🚀 Quick Start</h2>
            <div className="terminal">
              <div className="terminal-line">
                <span className="prompt">$</span>
                <span>cd projects/{taskId}</span>
                <button className="copy-btn" onClick={() => navigator.clipboard.writeText(`cd projects/${taskId}`)}>Copy</button>
              </div>
              {projectSummary?.runInstructions ? (
                projectSummary.runInstructions
                  .split(/[.;.]/)
                  .map(cmd => cmd.trim())
                  .filter(cmd => cmd && (cmd.includes('`') || cmd.startsWith('Run') || cmd.includes('npm') || cmd.includes('pip') || cmd.includes('python') || cmd.includes('go ') || cmd.includes('cargo')))
                  .map((cmd, i) => {
                    const cleanCmd = cmd.replace(/Run `?/gi, '').replace(/`/g, '').replace(/to start\.?/gi, '').replace(/to install dependencies\.?/gi, '').trim();
                    if (!cleanCmd) return null;
                    return (
                      <div key={i} className="terminal-line">
                        <span className="prompt">$</span>
                        <span>{cleanCmd}</span>
                        <button className="copy-btn" onClick={() => navigator.clipboard.writeText(cleanCmd)}>Copy</button>
                      </div>
                    );
                  })
              ) : (
                <>
                  <div className="terminal-line">
                    <span className="prompt">$</span>
                    <span>npm install</span>
                    <button className="copy-btn" onClick={() => navigator.clipboard.writeText("npm install")}>Copy</button>
                  </div>
                  <div className="terminal-line">
                    <span className="prompt">$</span>
                    <span>npm run dev</span>
                    <button className="copy-btn" onClick={() => navigator.clipboard.writeText("npm run dev")}>Copy</button>
                  </div>
                </>
              )}
            </div>
            <p className="run-hint">
              {projectSummary?.techStack && (
                <span className="tech-badge">{projectSummary.techStack}</span>
              )}
              {projectSummary?.runInstructions?.includes('python') && " Python app will open a GUI window."}
              {projectSummary?.runInstructions?.includes('npm run dev') && " Open http://localhost:5173 in your browser."}
              {projectSummary?.runInstructions?.includes('npm start') && " Open http://localhost:3000 in your browser."}
            </p>
          </section>

          <section className="results-section">
            <h2>📁 Files Created ({files.length} files)</h2>
            <div className="files-container">
              <div className="files-list">
                {files.length === 0 ? (
                  <p className="no-files">No files to display</p>
                ) : (
                  files.map((file, i) => (
                    <button
                      key={i}
                      className={`file-item ${selectedFile?.path === file.path ? "active" : ""}`}
                      onClick={() => setSelectedFile(file)}
                    >
                      <span className="file-icon">📄</span>
                      <span className="file-name">{file.path}</span>
                    </button>
                  ))
                )}
              </div>
              <div className="file-preview">
                {selectedFile ? (
                  <>
                    <div className="preview-header">
                      <span>{selectedFile.path}</span>
                      <button onClick={() => navigator.clipboard.writeText(selectedFile.content)}>Copy</button>
                    </div>
                    <pre className="preview-code">{selectedFile.content}</pre>
                  </>
                ) : (
                  <div className="preview-placeholder">
                    Select a file to preview
                  </div>
                )}
              </div>
            </div>
          </section>

          {majorDecisions.length > 0 && (
            <section className="results-section">
              <h2>🧠 Major Decisions Made</h2>
              <div className="decisions-list">
                {majorDecisions.map((decision, i) => (
                  <div key={i} className="decision-item">
                    <div className="decision-title">{decision.decision}</div>
                    <div className="decision-reason">{decision.reason}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {projectSummary?.howToUse && (
            <section className="results-section">
              <h2>📖 How It Works</h2>
              <p className="how-to-use">{projectSummary.howToUse}</p>
            </section>
          )}

          <section className="results-section">
            <h2>📥 Actions</h2>
            <div className="action-buttons">
              <button className="action-btn" onClick={handleDownloadZip}>
                📥 Download ZIP
              </button>
              <button className="action-btn" onClick={handleGenerateMarketing}>
                📢 Generate Marketing
              </button>
              <button className="action-btn" onClick={handleGenerateSocial}>
                📱 Generate Social Posts
              </button>
            </div>
          </section>

          <div className="nav-buttons">
            <Link href="/create" className="nav-btn secondary">Build Another Project</Link>
            <Link href="/" className="nav-btn primary">Back to Builder</Link>
          </div>
        </div>

        <div className="chat-panel">
          <div className="chat-header">
            <h3>💬 Ask About This Project</h3>
            <span>Chat with AI about what was built</span>
          </div>

          <div className="chat-messages">
            {chatMessages.length === 0 ? (
              <div className="chat-welcome">
                <p>👋 I can help you understand this project!</p>
                <p>Ask me about:</p>
                <ul>
                  <li>How the code works</li>
                  <li>Why certain decisions were made</li>
                  <li>How to modify or extend it</li>
                  <li>How to run or deploy it</li>
                </ul>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div key={msg.id} className={`chat-message ${msg.role}`}>
                  <div className="message-avatar">{msg.role === "user" ? "👤" : "🤖"}</div>
                  <div className="message-content">{msg.content}</div>
                </div>
              ))
            )}
            {isChatLoading && (
              <div className="chat-message assistant">
                <div className="message-avatar">🤖</div>
                <div className="message-content">Thinking...</div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="chat-input-area">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
              placeholder="Ask about your project..."
              className="chat-input"
              disabled={isChatLoading}
            />
            <button onClick={handleSendChat} className="chat-send" disabled={!chatInput.trim() || isChatLoading}>
              Send
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .results-page {
          min-height: 100vh;
          background: #0a0a0a;
          color: #fff;
        }

        .top-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 32px;
          background: #111;
          border-bottom: 1px solid #222;
        }

        .nav-brand {
          font-size: 20px;
          font-weight: 700;
          color: #4a9eff;
          text-decoration: none;
        }

        .nav-links {
          display: flex;
          gap: 24px;
        }

        .nav-link {
          color: #888;
          text-decoration: none;
          font-size: 14px;
          transition: color 0.2s;
        }

        .nav-link:hover {
          color: #fff;
        }

        .nav-link.active {
          color: #4a9eff;
        }

        .main-content {
          display: flex;
          gap: 24px;
          padding: 32px;
          max-width: 1600px;
          margin: 0 auto;
        }

        .results-main {
          flex: 1;
          max-width: 900px;
        }

        .results-header {
          margin-bottom: 32px;
        }

        .status-badge {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 16px;
        }

        .status-badge.success {
          background: rgba(78, 255, 78, 0.1);
          color: #4eff4e;
        }

        .project-title {
          font-size: 36px;
          margin-bottom: 8px;
        }

        .project-date {
          color: #888;
          font-size: 14px;
        }

        .results-section {
          background: #111;
          border: 1px solid #222;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }

        .results-section h2 {
          font-size: 18px;
          margin-bottom: 16px;
          color: #fff;
        }

        .summary-text {
          font-size: 14px;
          line-height: 1.7;
          color: #ccc;
          margin-bottom: 16px;
        }

        .tech-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .tech-tag {
          padding: 4px 12px;
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 16px;
          font-size: 12px;
          color: #4a9eff;
        }

        .terminal {
          background: #0a0a0a;
          border-radius: 8px;
          padding: 16px;
          font-family: monospace;
          font-size: 13px;
        }

        .terminal-line {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 0;
        }

        .prompt {
          color: #4eff4e;
        }

        .copy-btn {
          background: #222;
          border: none;
          color: #888;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
          margin-left: auto;
        }

        .copy-btn:hover {
          background: #333;
          color: #fff;
        }

        .run-hint {
          margin-top: 12px;
          font-size: 13px;
          color: #888;
        }

        .tech-badge {
          display: inline-block;
          padding: 4px 10px;
          background: #1a3a5c;
          border: 1px solid #4a9eff;
          border-radius: 12px;
          font-size: 11px;
          color: #4a9eff;
          margin-right: 8px;
        }

        .files-container {
          display: flex;
          gap: 16px;
          min-height: 300px;
        }

        .files-list {
          width: 250px;
          background: #0a0a0a;
          border-radius: 8px;
          overflow-y: auto;
          max-height: 400px;
        }

        .file-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 10px 12px;
          background: transparent;
          border: none;
          text-align: left;
          cursor: pointer;
          color: #888;
          font-size: 12px;
          transition: background 0.2s;
        }

        .file-item:hover {
          background: #1a1a1a;
        }

        .file-item.active {
          background: #1a1a1a;
          color: #fff;
        }

        .file-icon {
          font-size: 14px;
        }

        .file-name {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .file-preview {
          flex: 1;
          background: #0a0a0a;
          border-radius: 8px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .preview-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 12px;
          background: #1a1a1a;
          font-size: 12px;
          color: #888;
        }

        .preview-header button {
          background: #333;
          border: none;
          color: #ccc;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
        }

        .preview-code {
          flex: 1;
          overflow: auto;
          padding: 12px;
          margin: 0;
          font-family: monospace;
          font-size: 12px;
          line-height: 1.5;
          white-space: pre-wrap;
          color: #ccc;
        }

        .preview-placeholder {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #666;
        }

        .no-files {
          padding: 20px;
          color: #666;
          text-align: center;
        }

        .decisions-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .decision-item {
          background: #0a0a0a;
          padding: 12px 16px;
          border-radius: 8px;
          border-left: 3px solid #4a9eff;
        }

        .decision-title {
          font-weight: 600;
          color: #fff;
          margin-bottom: 4px;
        }

        .decision-reason {
          font-size: 13px;
          color: #888;
        }

        .how-to-use {
          font-size: 14px;
          line-height: 1.7;
          color: #ccc;
          white-space: pre-wrap;
        }

        .action-buttons {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .action-btn {
          padding: 12px 20px;
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 8px;
          color: #ccc;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-btn:hover {
          background: #222;
          border-color: #444;
        }

        .nav-buttons {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 32px;
        }

        .nav-btn {
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s;
        }

        .nav-btn.secondary {
          background: #1a1a1a;
          border: 1px solid #333;
          color: #ccc;
        }

        .nav-btn.secondary:hover {
          background: #222;
        }

        .nav-btn.primary {
          background: #4a9eff;
          color: #fff;
        }

        .nav-btn.primary:hover {
          background: #5ab0ff;
        }

        .chat-panel {
          width: 350px;
          background: #111;
          border: 1px solid #222;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          height: calc(100vh - 130px);
          position: sticky;
          top: 100px;
        }

        .chat-header {
          padding: 16px;
          border-bottom: 1px solid #222;
        }

        .chat-header h3 {
          margin: 0 0 4px 0;
          font-size: 14px;
        }

        .chat-header span {
          font-size: 12px;
          color: #888;
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .chat-welcome {
          color: #888;
          font-size: 13px;
          line-height: 1.6;
        }

        .chat-welcome ul {
          padding-left: 20px;
          margin: 8px 0;
        }

        .chat-welcome li {
          margin-bottom: 4px;
        }

        .chat-message {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .message-avatar {
          font-size: 20px;
          flex-shrink: 0;
        }

        .message-content {
          background: #1a1a1a;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          line-height: 1.5;
        }

        .chat-message.user .message-content {
          background: #4a9eff;
        }

        .chat-input-area {
          display: flex;
          gap: 8px;
          padding: 16px;
          border-top: 1px solid #222;
        }

        .chat-input {
          flex: 1;
          padding: 10px 14px;
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 8px;
          color: #fff;
          font-size: 13px;
        }

        .chat-input:focus {
          outline: none;
          border-color: #4a9eff;
        }

        .chat-send {
          padding: 10px 16px;
          background: #4a9eff;
          border: none;
          border-radius: 8px;
          color: #fff;
          font-size: 13px;
          cursor: pointer;
        }

        .chat-send:disabled {
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
}