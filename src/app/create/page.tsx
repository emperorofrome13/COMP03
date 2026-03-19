"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ProjectSpec {
  projectName: string;
  folder: string;
  description: string;
  language: string;
  projectType: string;
  projectStyle: string;
  features: string[];
  framework: string;
  additionalNotes: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const LANGUAGES = [
  { id: "typescript", name: "TypeScript/JavaScript", icon: "🟨", description: "Most popular for web apps. Great ecosystem, runs everywhere." },
  { id: "python", name: "Python", icon: "🐍", description: "Great for AI/ML, scripting, and backends. Easy to learn." },
  { id: "go", name: "Go", icon: "🔷", description: "Fast, compiled. Great for CLI tools and microservices." },
  { id: "rust", name: "Rust", icon: "🦀", description: "Memory-safe, blazing fast. For systems programming." },
  { id: "java", name: "Java", icon: "☕", description: "Enterprise standard. Great for large-scale applications." },
  { id: "csharp", name: "C#", icon: "💜", description: "Microsoft ecosystem. Great for Windows and enterprise." },
  { id: "php", name: "PHP", icon: "🐘", description: "Web-focused. Powers WordPress and many CMS platforms." },
];

const PROJECT_TYPES = [
  { id: "web-app", name: "Web Application", icon: "🌐", description: "Browser-based application" },
  { id: "cli-tool", name: "CLI Tool", icon: "⌨️", description: "Command-line interface" },
  { id: "api-server", name: "API Server", icon: "🔌", description: "Backend REST/GraphQL API" },
  { id: "desktop-app", name: "Desktop App", icon: "🖥️", description: "Native desktop application" },
  { id: "mobile-app", name: "Mobile App", icon: "📱", description: "iOS/Android application" },
  { id: "library", name: "Library/Package", icon: "📦", description: "Reusable code library" },
];

const PROJECT_STYLES = [
  { id: "hobby", name: "Hobby", icon: "🎮", description: "Quick, minimal setup. No tests, basic error handling." },
  { id: "production", name: "Production", icon: "🚀", description: "Tests, TypeScript, docs, Docker, CI/CD ready." },
  { id: "enterprise", name: "Enterprise", icon: "🏢", description: "Security, auth, logging, audit trails, compliance." },
];

const FEATURES = [
  { id: "auth", name: "User Authentication", icon: "🔐" },
  { id: "database", name: "Database Storage", icon: "🗄️" },
  { id: "api", name: "API Endpoints", icon: "🔌" },
  { id: "admin", name: "Admin Dashboard", icon: "📊" },
  { id: "file-upload", name: "File Upload", icon: "📁" },
  { id: "email", name: "Email Notifications", icon: "📧" },
  { id: "payments", name: "Payment Processing", icon: "💳" },
  { id: "realtime", name: "Real-time Updates", icon: "⚡" },
  { id: "search", name: "Search Functionality", icon: "🔍" },
  { id: "analytics", name: "Analytics/Tracking", icon: "📈" },
  { id: "i18n", name: "Internationalization", icon: "🌍" },
  { id: "dark-mode", name: "Dark Mode", icon: "🌙" },
];

const FRAMEWORKS: Record<string, { id: string; name: string }[]> = {
  typescript: [
    { id: "react", name: "React" },
    { id: "vue", name: "Vue.js" },
    { id: "next", name: "Next.js" },
    { id: "svelte", name: "Svelte" },
    { id: "express", name: "Express.js" },
    { id: "fastify", name: "Fastify" },
  ],
  python: [
    { id: "django", name: "Django" },
    { id: "flask", name: "Flask" },
    { id: "fastapi", name: "FastAPI" },
    { id: "streamlit", name: "Streamlit" },
  ],
  go: [
    { id: "gin", name: "Gin" },
    { id: "echo", name: "Echo" },
    { id: "fiber", name: "Fiber" },
  ],
  rust: [
    { id: "actix", name: "Actix Web" },
    { id: "rocket", name: "Rocket" },
    { id: "axum", name: "Axum" },
  ],
  java: [
    { id: "spring", name: "Spring Boot" },
    { id: "quarkus", name: "Quarkus" },
    { id: "micronaut", name: "Micronaut" },
  ],
  csharp: [
    { id: "aspnet", name: "ASP.NET Core" },
    { id: "blazor", name: "Blazor" },
  ],
  php: [
    { id: "laravel", name: "Laravel" },
    { id: "symfony", name: "Symfony" },
  ],
};

export default function CreatePage() {
  const router = useRouter();
  const [spec, setSpec] = useState<ProjectSpec>({
    projectName: "",
    folder: "./projects/",
    description: "",
    language: "typescript",
    projectType: "web-app",
    projectStyle: "production",
    features: [],
    framework: "react",
    additionalNotes: "",
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLanguageInfo, setSelectedLanguageInfo] = useState(LANGUAGES[0]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const lang = LANGUAGES.find((l) => l.id === spec.language);
    if (lang) setSelectedLanguageInfo(lang);
  }, [spec.language]);

  useEffect(() => {
    const frameworks = FRAMEWORKS[spec.language] || [];
    if (frameworks.length > 0 && !frameworks.find((f) => f.id === spec.framework)) {
      setSpec((prev) => ({ ...prev, framework: frameworks[0].id }));
    }
  }, [spec.language]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleFeatureToggle = (featureId: string) => {
    setSpec((prev) => ({
      ...prev,
      features: prev.features.includes(featureId)
        ? prev.features.filter((f) => f !== featureId)
        : [...prev.features, featureId],
    }));
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: chatInput,
      timestamp: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setIsLoading(true);

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
          specContext: spec,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response?.text || "I can help you refine your project specifications. What questions do you have?",
        timestamp: new Date().toISOString(),
      };

      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I'm here to help you design your project. You can ask me about best practices, technology choices, or architecture decisions.",
        timestamp: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuild = () => {
    localStorage.setItem("projectSpec", JSON.stringify(spec));
    router.push("/?build=true");
  };

  const availableFrameworks = FRAMEWORKS[spec.language] || [];

  return (
    <div className="create-page">
      <nav className="top-nav">
        <Link href="/" className="nav-brand">comp03</Link>
        <div className="nav-links">
          <Link href="/create" className="nav-link active">Create</Link>
          <Link href="/" className="nav-link">Build</Link>
          <Link href="/results" className="nav-link">Results</Link>
        </div>
      </nav>

      <div className="main-content">
        <div className="spec-form">
          <h1 className="page-title">📝 Create New Project</h1>
          <p className="page-subtitle">Define your project specifications manually, then let AI build it.</p>

          <div className="form-section">
            <h2 className="section-title">Project Info</h2>
            
            <div className="form-group">
              <label>Project Name</label>
              <input
                type="text"
                value={spec.projectName}
                onChange={(e) => setSpec({ ...spec, projectName: e.target.value })}
                placeholder="my-awesome-project"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Project Folder</label>
              <div className="input-with-button">
                <input
                  type="text"
                  value={spec.folder}
                  onChange={(e) => setSpec({ ...spec, folder: e.target.value })}
                  placeholder="./projects/my-awesome-project"
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={spec.description}
                onChange={(e) => setSpec({ ...spec, description: e.target.value })}
                placeholder="Describe what you want to build..."
                className="form-textarea"
                rows={4}
              />
            </div>
          </div>

          <div className="form-section">
            <h2 className="section-title">Programming Language</h2>
            <div className="option-grid">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.id}
                  className={`option-card ${spec.language === lang.id ? "selected" : ""}`}
                  onClick={() => setSpec({ ...spec, language: lang.id })}
                >
                  <span className="option-icon">{lang.icon}</span>
                  <span className="option-name">{lang.name}</span>
                </button>
              ))}
            </div>
            <div className="info-box">
              <strong>{selectedLanguageInfo.icon} {selectedLanguageInfo.name}</strong>
              <p>{selectedLanguageInfo.description}</p>
            </div>
          </div>

          <div className="form-section">
            <h2 className="section-title">Project Type</h2>
            <div className="option-grid small">
              {PROJECT_TYPES.map((type) => (
                <button
                  key={type.id}
                  className={`option-card ${spec.projectType === type.id ? "selected" : ""}`}
                  onClick={() => setSpec({ ...spec, projectType: type.id })}
                >
                  <span className="option-icon">{type.icon}</span>
                  <span className="option-name">{type.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-section">
            <h2 className="section-title">Project Style</h2>
            <div className="style-options">
              {PROJECT_STYLES.map((style) => (
                <button
                  key={style.id}
                  className={`style-card ${spec.projectStyle === style.id ? "selected" : ""}`}
                  onClick={() => setSpec({ ...spec, projectStyle: style.id })}
                >
                  <span className="style-icon">{style.icon}</span>
                  <div className="style-info">
                    <span className="style-name">{style.name}</span>
                    <span className="style-desc">{style.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {availableFrameworks.length > 0 && (
            <div className="form-section">
              <h2 className="section-title">Framework</h2>
              <div className="option-grid small">
                {availableFrameworks.map((fw) => (
                  <button
                    key={fw.id}
                    className={`option-card ${spec.framework === fw.id ? "selected" : ""}`}
                    onClick={() => setSpec({ ...spec, framework: fw.id })}
                  >
                    <span className="option-name">{fw.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-section">
            <h2 className="section-title">Features</h2>
            <div className="features-grid">
              {FEATURES.map((feature) => (
                <button
                  key={feature.id}
                  className={`feature-chip ${spec.features.includes(feature.id) ? "selected" : ""}`}
                  onClick={() => handleFeatureToggle(feature.id)}
                >
                  <span>{feature.icon}</span>
                  <span>{feature.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-section">
            <h2 className="section-title">Additional Notes</h2>
            <textarea
              value={spec.additionalNotes}
              onChange={(e) => setSpec({ ...spec, additionalNotes: e.target.value })}
              placeholder="Any specific requirements, constraints, or preferences..."
              className="form-textarea"
              rows={3}
            />
          </div>

          <div className="form-actions">
            <Link href="/" className="btn btn-secondary">Cancel</Link>
            <button onClick={handleBuild} className="btn btn-primary" disabled={!spec.projectName || !spec.description}>
              Build Project →
            </button>
          </div>
        </div>

        <div className="chat-panel">
          <div className="chat-header">
            <h3>💬 Ask Questions</h3>
            <span>Get help refining your spec</span>
          </div>
          
          <div className="chat-messages">
            {chatMessages.length === 0 ? (
              <div className="chat-welcome">
                <p>👋 Hi! I can help you design your project.</p>
                <p>Ask me about:</p>
                <ul>
                  <li>Which language/framework to choose</li>
                  <li>What features you might need</li>
                  <li>Best practices for your project type</li>
                  <li>Architecture recommendations</li>
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
            {isLoading && (
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
              disabled={isLoading}
            />
            <button onClick={handleSendChat} className="chat-send" disabled={!chatInput.trim() || isLoading}>
              Send
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .create-page {
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

        .spec-form {
          flex: 1;
          max-width: 800px;
        }

        .page-title {
          font-size: 32px;
          margin-bottom: 8px;
        }

        .page-subtitle {
          color: #888;
          margin-bottom: 32px;
        }

        .form-section {
          background: #111;
          border: 1px solid #222;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }

        .section-title {
          font-size: 16px;
          margin-bottom: 16px;
          color: #ccc;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group:last-child {
          margin-bottom: 0;
        }

        .form-group label {
          display: block;
          font-size: 13px;
          color: #888;
          margin-bottom: 8px;
        }

        .form-input {
          width: 100%;
          padding: 12px 16px;
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 8px;
          color: #fff;
          font-size: 14px;
        }

        .form-input:focus {
          outline: none;
          border-color: #4a9eff;
        }

        .form-textarea {
          width: 100%;
          padding: 12px 16px;
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 8px;
          color: #fff;
          font-size: 14px;
          resize: vertical;
          font-family: inherit;
        }

        .form-textarea:focus {
          outline: none;
          border-color: #4a9eff;
        }

        .option-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 12px;
        }

        .option-grid.small {
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        }

        .option-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px;
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .option-card:hover {
          border-color: #444;
        }

        .option-card.selected {
          border-color: #4a9eff;
          background: rgba(74, 158, 255, 0.1);
        }

        .option-icon {
          font-size: 24px;
        }

        .option-name {
          font-size: 13px;
          color: #ccc;
        }

        .info-box {
          margin-top: 16px;
          padding: 12px 16px;
          background: #1a1a1a;
          border-radius: 8px;
          border-left: 3px solid #4a9eff;
        }

        .info-box strong {
          color: #fff;
        }

        .info-box p {
          margin: 4px 0 0 0;
          color: #888;
          font-size: 13px;
        }

        .style-options {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .style-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }

        .style-card:hover {
          border-color: #444;
        }

        .style-card.selected {
          border-color: #4a9eff;
          background: rgba(74, 158, 255, 0.1);
        }

        .style-icon {
          font-size: 28px;
        }

        .style-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .style-name {
          font-weight: 600;
          color: #fff;
        }

        .style-desc {
          font-size: 13px;
          color: #888;
        }

        .features-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .feature-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 20px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 13px;
          color: #ccc;
        }

        .feature-chip:hover {
          border-color: #444;
        }

        .feature-chip.selected {
          border-color: #4a9eff;
          background: rgba(74, 158, 255, 0.2);
          color: #fff;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
        }

        .btn {
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
        }

        .btn-secondary {
          background: #1a1a1a;
          border: 1px solid #333;
          color: #ccc;
        }

        .btn-secondary:hover {
          background: #222;
        }

        .btn-primary {
          background: #4a9eff;
          border: none;
          color: #fff;
        }

        .btn-primary:hover:not(:disabled) {
          background: #5ab0ff;
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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