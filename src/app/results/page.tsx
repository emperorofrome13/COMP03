"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Project {
  taskId: string;
  projectName: string;
  status: string;
  createdAt: string;
}

export default function ResultsListPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("http://localhost:3030/api/tasks");
      if (res.ok) {
        const tasks = await res.json();
        const formatted = tasks.map((t: any) => ({
          taskId: t.task_id,
          projectName: t.project_name || "Unknown",
          status: t.status || "unknown",
          createdAt: t.created_at || new Date().toISOString(),
        }));
        setProjects(formatted);
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="results-list-page">
      <nav className="top-nav">
        <Link href="/" className="nav-brand">comp03</Link>
        <div className="nav-links">
          <Link href="/create" className="nav-link">Create</Link>
          <Link href="/" className="nav-link">Build</Link>
          <Link href="/results" className="nav-link active">Results</Link>
        </div>
      </nav>

      <div className="main-content">
        <div className="page-header">
          <h1>📁 Your Projects</h1>
          <p>View results and documentation for all your built projects</p>
        </div>

        {isLoading ? (
          <div className="loading">
            <div className="loader"></div>
            <p>Loading projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📂</div>
            <h2>No Projects Yet</h2>
            <p>Build your first project to see results here.</p>
            <Link href="/create" className="create-btn">Create New Project</Link>
          </div>
        ) : (
          <div className="projects-grid">
            {projects.map((project) => (
              <Link
                key={project.taskId}
                href={`/results/${project.taskId}`}
                className="project-card"
              >
                <div className="card-header">
                  <span className="project-name">{project.projectName}</span>
                  <span className={`status-badge ${project.status}`}>
                    {project.status === "complete" ? "✅" : project.status === "in_progress" ? "🔄" : "❌"}
                  </span>
                </div>
                <div className="card-body">
                  <div className="project-id">ID: {project.taskId}</div>
                  <div className="project-date">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="card-footer">
                  <span>View Results →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .results-list-page {
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
          padding: 32px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 32px;
        }

        .page-header h1 {
          font-size: 32px;
          margin-bottom: 8px;
        }

        .page-header p {
          color: #888;
        }

        .loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px;
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

        .empty-state {
          text-align: center;
          padding: 60px;
        }

        .empty-icon {
          font-size: 64px;
          margin-bottom: 16px;
        }

        .empty-state h2 {
          margin-bottom: 8px;
        }

        .empty-state p {
          color: #888;
          margin-bottom: 24px;
        }

        .create-btn {
          display: inline-block;
          padding: 12px 24px;
          background: #4a9eff;
          color: #fff;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
        }

        .create-btn:hover {
          background: #5ab0ff;
        }

        .projects-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }

        .project-card {
          background: #111;
          border: 1px solid #222;
          border-radius: 12px;
          padding: 20px;
          text-decoration: none;
          color: inherit;
          transition: all 0.2s;
        }

        .project-card:hover {
          border-color: #333;
          transform: translateY(-2px);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .project-name {
          font-size: 18px;
          font-weight: 600;
        }

        .status-badge {
          font-size: 16px;
        }

        .card-body {
          margin-bottom: 16px;
        }

        .project-id {
          font-size: 12px;
          color: #666;
          font-family: monospace;
          margin-bottom: 4px;
        }

        .project-date {
          font-size: 13px;
          color: #888;
        }

        .card-footer {
          font-size: 13px;
          color: #4a9eff;
        }
      `}</style>
    </div>
  );
}