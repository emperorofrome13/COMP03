"use client";

import { useState } from "react";

interface AgentSummary {
  agent: string;
  status: "waiting" | "running" | "done" | "failed";
  summary: string;
  lastOutput?: string;
  timestamp?: string;
}

interface AgentSummaryPanelProps {
  agentSummaries: Record<string, AgentSummary>;
  recentProjects: RecentProject[];
  onSelectProject: (taskId: string) => void;
  onGenerateMarketing: (taskId: string) => void;
  onGenerateSocial: (taskId: string) => void;
}

interface RecentProject {
  taskId: string;
  projectName: string;
  status: string;
  createdAt: string;
  hasMarketing: boolean;
  hasSocial: boolean;
}

const AGENT_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  interface: { icon: "🤖", color: "#4a9eff", label: "Interface" },
  decomposer: { icon: "🔧", color: "#9b59b6", label: "Decomposer" },
  planner: { icon: "📋", color: "#4a9eff", label: "Planner" },
  researcher: { icon: "🔍", color: "#00d9ff", label: "Researcher" },
  architect: { icon: "🏗️", color: "#4eff4e", label: "Architect" },
  coder: { icon: "💻", color: "#7fff00", label: "Coder" },
  reviewer: { icon: "✅", color: "#fff700", label: "Reviewer" },
  tester: { icon: "🧪", color: "#ff69b4", label: "Tester" },
  qa: { icon: "🔬", color: "#e91e63", label: "QA" },
  executor: { icon: "⚡", color: "#ff6b6b", label: "Executor" },
  debugger: { icon: "🐛", color: "#ffa500", label: "Debugger" },
  resource: { icon: "🔧", color: "#ff69b4", label: "Resource" },
  marketing: { icon: "📢", color: "#9b59b6", label: "Marketing" },
  social: { icon: "📱", color: "#e91e63", label: "Social" },
  system: { icon: "⚙️", color: "#888888", label: "System" },
};

export default function AgentSummaryPanel({
  agentSummaries,
  recentProjects,
  onSelectProject,
  onGenerateMarketing,
  onGenerateSocial,
}: AgentSummaryPanelProps) {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"agents" | "projects">("agents");

  const getStatusDot = (status: string) => {
    switch (status) {
      case "running": return "🟡";
      case "done": return "🟢";
      case "failed": return "🔴";
      default: return "⚪";
    }
  };

  const agents = Object.entries(agentSummaries).filter(
    ([key]) => !["orchestrator", "system"].includes(key)
  );

  return (
    <div className="agent-summary-panel">
      <div className="panel-tabs">
        <button 
          className={`tab ${activeTab === "agents" ? "active" : ""}`}
          onClick={() => setActiveTab("agents")}
        >
          Agents
        </button>
        <button 
          className={`tab ${activeTab === "projects" ? "active" : ""}`}
          onClick={() => setActiveTab("projects")}
        >
          Projects
        </button>
      </div>

      {activeTab === "agents" && (
        <div className="agents-list">
          {agents.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🤖</div>
              <div className="empty-text">No active agents</div>
              <div className="empty-hint">Start a project to see agent activity</div>
            </div>
          ) : (
            agents.map(([key, summary]) => {
              const config = AGENT_CONFIG[key] || AGENT_CONFIG.system;
              const isExpanded = expandedAgent === key;
              
              return (
                <div 
                  key={key} 
                  className={`agent-bubble ${summary.status} ${isExpanded ? "expanded" : ""}`}
                  onClick={() => setExpandedAgent(isExpanded ? null : key)}
                >
                  <div className="bubble-header">
                    <span className="bubble-icon">{config.icon}</span>
                    <span className="bubble-name" style={{ color: config.color }}>
                      {config.label}
                    </span>
                    <span className="bubble-status">{getStatusDot(summary.status)}</span>
                  </div>
                  
                  {summary.summary && (
                    <div className="bubble-summary">{summary.summary}</div>
                  )}
                  
                  {isExpanded && summary.lastOutput && (
                    <div className="bubble-output">
                      <div className="output-label">Last Output:</div>
                      <div className="output-content">{summary.lastOutput}</div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === "projects" && (
        <div className="projects-list">
          {recentProjects.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📁</div>
              <div className="empty-text">No projects yet</div>
              <div className="empty-hint">Your completed projects will appear here</div>
            </div>
          ) : (
            recentProjects.map((project) => (
              <div key={project.taskId} className="project-card">
                <div className="project-header">
                  <span className="project-name">{project.projectName}</span>
                  <span className={`project-status ${project.status}`}>
                    {project.status}
                  </span>
                </div>
                <div className="project-date">
                  {new Date(project.createdAt).toLocaleDateString()}
                </div>
                <div className="project-actions">
                  <button 
                    className="action-btn"
                    onClick={() => onSelectProject(project.taskId)}
                  >
                    View
                  </button>
                  {!project.hasMarketing && (
                    <button 
                      className="action-btn marketing"
                      onClick={() => onGenerateMarketing(project.taskId)}
                    >
                      📢 Marketing
                    </button>
                  )}
                  {!project.hasSocial && (
                    <button 
                      className="action-btn social"
                      onClick={() => onGenerateSocial(project.taskId)}
                    >
                      📱 Social
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <style jsx>{`
        .agent-summary-panel {
          width: 320px;
          background: #252526;
          border-left: 1px solid #404040;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .panel-tabs {
          display: flex;
          border-bottom: 1px solid #404040;
        }

        .tab {
          flex: 1;
          padding: 12px;
          background: transparent;
          border: none;
          color: #888;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tab:hover {
          color: #fff;
        }

        .tab.active {
          color: #4a9eff;
          border-bottom: 2px solid #4a9eff;
        }

        .agents-list, .projects-list {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
        }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: #666;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }

        .empty-text {
          font-size: 14px;
          color: #aaa;
          margin-bottom: 4px;
        }

        .empty-hint {
          font-size: 12px;
        }

        .agent-bubble {
          background: #1e1e1e;
          border: 1px solid #404040;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .agent-bubble:hover {
          border-color: #555;
        }

        .agent-bubble.running {
          border-color: #ffa500;
          background: #2a2a1a;
        }

        .agent-bubble.done {
          border-color: #4eff4e;
        }

        .agent-bubble.failed {
          border-color: #ff4444;
        }

        .bubble-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }

        .bubble-icon {
          font-size: 16px;
        }

        .bubble-name {
          font-size: 13px;
          font-weight: 600;
          flex: 1;
        }

        .bubble-status {
          font-size: 10px;
        }

        .bubble-summary {
          font-size: 12px;
          color: #aaa;
          line-height: 1.4;
        }

        .bubble-output {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid #404040;
        }

        .output-label {
          font-size: 11px;
          color: #666;
          margin-bottom: 6px;
        }

        .output-content {
          font-size: 11px;
          color: #ccc;
          background: #2d2d2d;
          padding: 8px;
          border-radius: 4px;
          max-height: 150px;
          overflow-y: auto;
          white-space: pre-wrap;
          font-family: 'Cascadia Code', monospace;
        }

        .project-card {
          background: #1e1e1e;
          border: 1px solid #404040;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 8px;
        }

        .project-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }

        .project-name {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
        }

        .project-status {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 10px;
          text-transform: uppercase;
        }

        .project-status.complete {
          background: #004a00;
          color: #4eff4e;
        }

        .project-status.in_progress {
          background: #4a4a00;
          color: #fff700;
        }

        .project-status.failed {
          background: #4a0000;
          color: #ff4444;
        }

        .project-date {
          font-size: 11px;
          color: #666;
          margin-bottom: 10px;
        }

        .project-actions {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .action-btn {
          background: #404040;
          border: none;
          color: #ccc;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-btn:hover {
          background: #505050;
          color: #fff;
        }

        .action-btn.marketing {
          background: #3d2066;
          color: #b388ff;
        }

        .action-btn.marketing:hover {
          background: #4d3080;
        }

        .action-btn.social {
          background: #4a1a3a;
          color: #ff69b4;
        }

        .action-btn.social:hover {
          background: #5a2a4a;
        }
      `}</style>
    </div>
  );
}