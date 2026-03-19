"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ChatStream from "./ChatStream";
import AgentSummaryPanel from "./AgentSummaryPanel";

interface TreeNode {
  name: string;
  type: "file" | "directory";
  path: string;
  children?: TreeNode[];
}

interface LogMessage {
  type: "log";
  agent: string;
  level: "info" | "warn" | "error";
  message: string;
  ts: string;
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

interface AgentStates {
  [key: string]: string;
}

interface AgentSummary {
  agent: string;
  status: "waiting" | "running" | "done" | "failed";
  summary: string;
  lastOutput?: string;
  timestamp?: string;
}

interface RecentProject {
  taskId: string;
  projectName: string;
  status: string;
  createdAt: string;
  hasMarketing: boolean;
  hasSocial: boolean;
}

interface AgentStatusMessage {
  type: "agent_status";
  agent: string;
  status: "waiting" | "running" | "done" | "failed";
  task_id?: string;
}

interface FsChangeMessage {
  type: "fs_change";
  path: string;
  action: "created" | "modified" | "deleted";
}

interface TaskCompleteMessage {
  type: "task_complete";
  task_id: string;
  verdict: "pass" | "fail";
  project_name?: string;
  files_created?: string[];
  project_summary?: ProjectSummary;
}

interface ProjectSummary {
  name: string;
  description: string;
  howToUse: string;
  filesCreated: string[];
  techStack: string;
  runInstructions: string;
}

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

type WsMessage = LogMessage | AgentStatusMessage | FsChangeMessage | TaskCompleteMessage;

function TopNav({ projectName, model, buildStatus }: { projectName?: string; model?: string; buildStatus?: string }) {
  return (
    <div className="top-nav">
      <Link href="/" className="nav-brand">comp03</Link>
      <div className="nav-links">
        <Link href="/create" className="nav-link">Create</Link>
        <Link href="/" className="nav-link active">Build</Link>
        <Link href="/results" className="nav-link">Results</Link>
      </div>
      <div className="nav-status">
        {projectName && (
          <span className={`status-indicator ${buildStatus || ""}`}>
            {buildStatus === "running" ? "🔄" : buildStatus === "complete" ? "✅" : buildStatus === "failed" ? "❌" : ""}
          </span>
        )}
        <span className="project-name">{projectName || "No project"}</span>
        {model && <span className="model-badge">{model}</span>}
      </div>

      <style jsx>{`
        .top-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 24px;
          background: #111;
          border-bottom: 1px solid #222;
        }
        .nav-brand {
          font-size: 18px;
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
        .nav-status {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .status-indicator {
          font-size: 14px;
        }
        .project-name {
          font-size: 13px;
          color: #ccc;
        }
        .model-badge {
          font-size: 11px;
          padding: 2px 8px;
          background: #222;
          border-radius: 10px;
          color: #888;
        }
      `}</style>
    </div>
  );
}

function BuildStatusBanner({
  status,
  projectName,
  taskId,
  onViewResults
}: {
  status: "idle" | "running" | "complete" | "failed";
  projectName?: string;
  taskId?: string;
  onViewResults?: () => void;
}) {
  if (status === "idle") return null;

  return (
    <div className={`build-banner ${status}`}>
      <div className="banner-content">
        {status === "running" && (
          <>
            <span className="banner-icon">🔄</span>
            <span className="banner-text">Building: {projectName || "Project"}...</span>
          </>
        )}
        {status === "complete" && (
          <>
            <span className="banner-icon">✅</span>
            <span className="banner-text">Build Complete: {projectName || "Project"}</span>
            {taskId && (
              <Link href={`/results/${taskId}`} className="banner-link">
                View Results →
              </Link>
            )}
          </>
        )}
        {status === "failed" && (
          <>
            <span className="banner-icon">❌</span>
            <span className="banner-text">Build Failed</span>
            <button className="banner-retry" onClick={() => window.location.reload()}>
              Retry
            </button>
          </>
        )}
      </div>

      <style jsx>{`
        .build-banner {
          padding: 12px 24px;
          border-bottom: 1px solid #222;
        }
        .build-banner.running {
          background: rgba(74, 158, 255, 0.1);
          border-bottom-color: #4a9eff;
        }
        .build-banner.complete {
          background: rgba(78, 255, 78, 0.1);
          border-bottom-color: #4eff4e;
        }
        .build-banner.failed {
          background: rgba(255, 68, 68, 0.1);
          border-bottom-color: #ff4444;
        }
        .banner-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .banner-icon {
          font-size: 18px;
        }
        .banner-text {
          font-size: 14px;
          color: #ccc;
        }
        .banner-link {
          color: #4a9eff;
          text-decoration: none;
          font-size: 13px;
          margin-left: auto;
        }
        .banner-link:hover {
          text-decoration: underline;
        }
        .banner-retry {
          background: #ff4444;
          border: none;
          color: #fff;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          margin-left: auto;
        }
      `}</style>
    </div>
  );
}

function AgentStatusStrip({ agentStates }: { agentStates: AgentStates }) {
  const agents = Object.entries(agentStates).filter(
    ([key]) => !["orchestrator", "system"].includes(key)
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running": return "🟡";
      case "done": return "🟢";
      case "failed": return "🔴";
      default: return "⚪";
    }
  };

  return (
    <div className="agent-status-strip">
      <div className="agent-pills">
        {agents.map(([agent, status]) => (
          <div key={agent} className={`agent-pill ${status}`}>
            <span className="pill-dot">{getStatusIcon(status)}</span>
            {agent}
          </div>
        ))}
      </div>
      <div className="status-text">
        {agents.some(([, s]) => s === "running") ? "Running..." : "Ready"}
      </div>

      <style jsx>{`
        .agent-status-strip {
          height: 40px;
          background: #2d2d2d;
          border-top: 1px solid #404040;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 16px;
        }
        .agent-pills {
          display: flex;
          gap: 8px;
          overflow-x: auto;
        }
        .agent-pill {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 12px;
          background: #404040;
          border-radius: 12px;
          font-size: 12px;
          color: #cccccc;
          white-space: nowrap;
        }
        .pill-dot { font-size: 10px; }
        .agent-pill.running { background: #4a4a00; color: #fff700; }
        .agent-pill.done { background: #004a00; color: #4eff4e; }
        .agent-pill.failed { background: #4a0000; color: #ff4444; }
        .status-text { font-size: 11px; color: #888; }
      `}</style>
    </div>
  );
}

export default function DevTeamApp() {
  const router = useRouter();
  const [agentStates, setAgentStates] = useState<AgentStates>({});
  const [agentSummaries, setAgentSummaries] = useState<Record<string, AgentSummary>>({});
  const [projectName, setProjectName] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const [buildStatus, setBuildStatus] = useState<"idle" | "running" | "complete" | "failed">("idle");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    taskId: string;
    intent: string;
    projectName: string;
    stack: string;
    estimatedFiles: number;
    estimatedTime: string;
  } | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [incomingSpec, setIncomingSpec] = useState<ProjectSpec | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const specData = localStorage.getItem("projectSpec");
    if (specData) {
      try {
        const spec = JSON.parse(specData);
        setIncomingSpec(spec);
        setProjectName(spec.projectName || "");
        localStorage.removeItem("projectSpec");
      } catch (e) {
        console.error("Failed to parse spec:", e);
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let ws: WebSocket | null = null;
    
    const connectWebSocket = () => {
      if (!isMounted) return;
      
      ws = new WebSocket("ws://localhost:3030/ws/main");
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        console.log("WebSocket connected");
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const message: WsMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
        }
      };

      ws.onerror = () => {
        console.log("WebSocket error - backend may not be running");
      };

      ws.onclose = () => {
        if (!isMounted) return;
        console.log("WebSocket disconnected");
        setBuildStatus("idle");
        setIsRunning(false);
      };
    };

    const initTimeout = setTimeout(connectWebSocket, 1000);

    return () => {
      isMounted = false;
      clearTimeout(initTimeout);
      if (ws) {
        ws.close();
      }
    };
  }, []);

  const handleMessage = (message: WsMessage) => {
    switch (message.type) {
      case "log":
        updateAgentSummary(message);
        break;
      case "agent_status":
        setAgentStates((prev) => ({ ...prev, [message.agent]: message.status }));
        if (message.status === "running") {
          setIsRunning(true);
          setBuildStatus("running");
          setAgentSummaries((prev) => ({
            ...prev,
            [message.agent]: {
              agent: message.agent,
              status: "running",
              summary: "Starting...",
              lastOutput: prev[message.agent]?.lastOutput,
            },
          }));
        } else if (message.status === "done") {
          setAgentSummaries((prev) => ({
            ...prev,
            [message.agent]: {
              ...prev[message.agent],
              status: "done",
            },
          }));
        }
        break;
      case "fs_change":
        fetchRecentProjects();
        break;
      case "task_complete":
        setIsRunning(false);
        setBuildStatus(message.verdict === "pass" ? "complete" : "failed");
        handleTaskComplete(message);
        break;
    }
  };

  const updateAgentSummary = (log: LogMessage) => {
    setAgentSummaries((prev) => {
      const existing = prev[log.agent] || {
        agent: log.agent,
        status: "waiting",
        summary: "",
      };

      let summary = log.message;
      if (log.message.length > 100) {
        summary = log.message.substring(0, 100) + "...";
      }

      if (log.level === "info" && !log.message.includes("completed")) {
        return {
          ...prev,
          [log.agent]: {
            ...existing,
            summary,
            lastOutput: log.message,
            timestamp: log.ts,
          },
        };
      }

      return prev;
    });
  };

  const handleTaskComplete = async (message: TaskCompleteMessage) => {
    setCurrentTaskId(message.task_id);

    const completeMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: "assistant",
      agent: "system",
      content: `Build ${message.verdict === "pass" ? "completed successfully" : "failed"}!`,
      timestamp: new Date().toISOString(),
      type: "build_complete",
      actionData: {
        taskId: message.task_id,
        projectName: message.project_name || "Project",
      },
      projectSummary: message.project_summary,
    };
    setChatMessages((prev) => [...prev, completeMessage]);

    await fetchRecentProjects();

    if (message.verdict === "pass" && message.project_summary) {
      setTimeout(() => {
        const summaryMsg: ChatMessage = {
          id: `msg_${Date.now() + 1}`,
          role: "assistant",
          agent: "interface",
          content: "",
          timestamp: new Date().toISOString(),
          type: "project_summary",
          projectSummary: message.project_summary,
        };
        setChatMessages((prev) => [...prev, summaryMsg]);
      }, 300);

      setTimeout(() => {
        addSystemMessage(
          `Your project is ready! Click "View Results" above to see documentation, or generate marketing materials below.`,
          "interface"
        );
      }, 800);
    }
  };

  const addSystemMessage = (content: string, agent?: string) => {
    const newMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: "assistant",
      agent: agent || "system",
      content,
      timestamp: new Date().toISOString(),
      type: "text",
    };
    setChatMessages((prev) => [...prev, newMessage]);
  };

  const fetchRecentProjects = async () => {
    try {
      const res = await fetch("http://localhost:3030/api/tasks");
      const tasks = await res.json();

      const projects: RecentProject[] = await Promise.all(
        tasks.slice(0, 10).map(async (task: any) => {
          let hasMarketing = false;
          let hasSocial = false;

          try {
            const filesRes = await fetch(`http://localhost:3030/api/files/projects/${task.task_id}`);
            if (filesRes.ok) {
              const filesData = await filesRes.json();
              hasMarketing = filesData.content?.includes("MARKETING.md") || false;
              hasSocial = filesData.content?.includes("SOCIAL_MEDIA.md") || false;
            }
          } catch (err) {
            console.warn("Failed to fetch project files:", err);
          }

          return {
            taskId: task.task_id,
            projectName: task.project_name || "Unknown",
            status: task.status || "unknown",
            createdAt: task.created_at || new Date().toISOString(),
            hasMarketing,
            hasSocial,
          };
        })
      );

      setRecentProjects(projects);
    } catch (error) {
      console.error("Failed to fetch recent projects:", error);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch("http://localhost:3030/api/config");
      const data = await res.json();
      if (data.model) {
        setModel(data.model);
      }
    } catch (error) {
      console.error("Failed to fetch config:", error);
    }
  };

  useEffect(() => {
    fetchRecentProjects();
    fetchConfig();
  }, []);

  useEffect(() => {
    if (incomingSpec && chatMessages.length === 0) {
      const initialMessage = `I want to build: ${incomingSpec.projectName}\n\n${incomingSpec.description}\n\nTech: ${incomingSpec.language}, ${incomingSpec.framework}\nStyle: ${incomingSpec.projectStyle}\nFeatures: ${incomingSpec.features.join(", ")}`;
      handleSendMessage(initialMessage);
      setIncomingSpec(null);
    }
  }, [incomingSpec]);

  const handleSendMessage = async (content: string) => {
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date().toISOString(),
      type: "text",
    };
    setChatMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:3030/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          conversationHistory: chatMessages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
            agent: m.agent,
          })),
          currentTaskId,
        }),
      });

      const data = await response.json();

      if (data.response) {
        const assistantMessage: ChatMessage = {
          id: `msg_${Date.now() + 1}`,
          role: "assistant",
          agent: "interface",
          content: data.response.text || "",
          timestamp: new Date().toISOString(),
          type: data.response.needsConfirmation ? "action_card" : "text",
          actionData: data.response.needsConfirmation
            ? {
                intent: data.response.intent,
                projectName: data.response.projectSummary?.name,
                stack: data.response.projectSummary?.stack,
                estimatedFiles: data.response.projectSummary?.estimatedFiles,
                estimatedTime: data.response.projectSummary?.estimatedTime,
                requiresConfirmation: true,
              }
            : undefined,
        };
        setChatMessages((prev) => [...prev, assistantMessage]);

        if (data.response.needsConfirmation && data.response.refinedRequirements) {
          setPendingConfirmation({
            taskId: "",
            intent: data.response.intent,
            projectName: data.response.projectSummary?.name || "Project",
            stack: data.response.projectSummary?.stack || "Unknown",
            estimatedFiles: data.response.projectSummary?.estimatedFiles || 15,
            estimatedTime: data.response.projectSummary?.estimatedTime || "3-5 minutes",
          });
        } else if (data.response.intent === "MARKETING" && currentTaskId) {
          await handleGenerateMarketing(currentTaskId);
        } else if (data.response.intent === "SOCIAL_MEDIA" && currentTaskId) {
          await handleGenerateSocial(currentTaskId);
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      addSystemMessage("Error: Failed to process your message", "system");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (action: string, data?: any) => {
    if (action === "confirm" && pendingConfirmation) {
      try {
        const response = await fetch("http://localhost:3030/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: pendingConfirmation.projectName,
            project_name: pendingConfirmation.projectName,
            stack_hint: pendingConfirmation.stack,
          }),
        });

        const taskData = await response.json();
        setCurrentTaskId(taskData.task_id);
        setProjectName(pendingConfirmation.projectName);

        addSystemMessage(`Starting build: ${pendingConfirmation.projectName}`, "system");
        setPendingConfirmation(null);
      } catch (error) {
        console.error("Failed to start build:", error);
        addSystemMessage("Error: Failed to start build", "system");
      }
    } else if (action === "edit") {
      setPendingConfirmation(null);
      addSystemMessage("What would you like to change?", "interface");
    } else if (action === "marketing" && data?.taskId) {
      await handleGenerateMarketing(data.taskId);
    } else if (action === "social" && data?.taskId) {
      await handleGenerateSocial(data.taskId);
    }
  };

  const handleGenerateMarketing = async (taskId: string) => {
    addSystemMessage("Generating marketing materials...", "marketing");
    setAgentSummaries((prev) => ({
      ...prev,
      marketing: { agent: "marketing", status: "running", summary: "Creating marketing materials..." },
    }));

    try {
      const response = await fetch("http://localhost:3030/api/marketing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setAgentSummaries((prev) => ({
          ...prev,
          marketing: { agent: "marketing", status: "done", summary: "Marketing materials generated!" },
        }));
        addSystemMessage(
          `Marketing materials created! Check MARKETING.md in your project files.`,
          "marketing"
        );
        await fetchRecentProjects();
      } else {
        throw new Error(data.error || "Failed to generate marketing materials");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setAgentSummaries((prev) => ({
        ...prev,
        marketing: { agent: "marketing", status: "failed", summary: "Generation failed" },
      }));
      addSystemMessage(`Error: ${message}`, "system");
    }
  };

  const handleGenerateSocial = async (taskId: string) => {
    addSystemMessage("Generating social media content...", "social");
    setAgentSummaries((prev) => ({
      ...prev,
      social: { agent: "social", status: "running", summary: "Creating social media posts..." },
    }));

    try {
      const response = await fetch("http://localhost:3030/api/social/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setAgentSummaries((prev) => ({
          ...prev,
          social: { agent: "social", status: "done", summary: "Social media content generated!" },
        }));
        addSystemMessage(
          `Social media content created! Check SOCIAL_MEDIA.md in your project files.`,
          "social"
        );
        await fetchRecentProjects();
      } else {
        throw new Error(data.error || "Failed to generate social media content");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setAgentSummaries((prev) => ({
        ...prev,
        social: { agent: "social", status: "failed", summary: "Generation failed" },
      }));
      addSystemMessage(`Error: ${message}`, "system");
    }
  };

  const handleStop = async () => {
    setIsRunning(false);
    setBuildStatus("idle");
    addSystemMessage("Stopping current operation...", "system");
  };

  const handleSelectProject = async (taskId: string) => {
    setCurrentTaskId(taskId);
    try {
      const res = await fetch(`http://localhost:3030/api/tasks/${taskId}`);
      if (res.ok) {
        const data = await res.json();
        setProjectName(data.project_name || "Unknown Project");
        addSystemMessage(`Selected project: ${data.project_name || "Unknown Project"}`, "system");
      }
    } catch (error) {
      console.error("Failed to select project:", error);
    }
  };

  return (
    <div className="app-shell">
      <TopNav projectName={projectName} model={model} buildStatus={buildStatus} />

      <BuildStatusBanner
        status={buildStatus}
        projectName={projectName}
        taskId={currentTaskId || undefined}
      />

      <div className="main-container">
        <div className="content-area">
          <div className="split-view">
            <div className="chat-section">
              <ChatStream
                messages={chatMessages}
                onSendMessage={handleSendMessage}
                onAction={handleAction}
                isLoading={isLoading}
                onStop={handleStop}
                isRunning={isRunning}
                currentTaskId={currentTaskId}
              />
            </div>

            <AgentSummaryPanel
              agentSummaries={agentSummaries}
              recentProjects={recentProjects}
              onSelectProject={handleSelectProject}
              onGenerateMarketing={handleGenerateMarketing}
              onGenerateSocial={handleGenerateSocial}
            />
          </div>

          <AgentStatusStrip agentStates={agentStates} />
        </div>
      </div>

      <style jsx global>{`
        .app-shell {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: #1e1e1e;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .main-container {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .content-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .split-view {
          flex: 1;
          display: flex;
          overflow: hidden;
        }

        .chat-section {
          flex: 1;
          min-width: 400px;
        }
      `}</style>
    </div>
  );
}