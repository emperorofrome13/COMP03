"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";

interface LogMessage {
  type: "log";
  agent: string;
  level: "info" | "warn" | "error";
  message: string;
  ts: string;
}

interface TerminalPanelProps {
  logs: LogMessage[];
}

// Agent colors for terminal (ANSI escape codes)
const agentColors: Record<string, string> = {
  orchestrator: "\x1b[35m", // magenta
  planner: "\x1b[34m", // blue
  researcher: "\x1b[36m", // cyan
  architect: "\x1b[32m", // green
  coder: "\x1b[92m", // bright green
  reviewer: "\x1b[33m", // yellow
  system: "\x1b[90m", // dim gray
};

const reset = "\x1b[0m";
const dim = "\x1b[2m";

function formatLogLine(log: LogMessage): string {
  const col = agentColors[log.agent] || "\x1b[37m";
  return `${dim}[${log.ts}]${reset} ${col}${log.agent.padEnd(10)}${reset} ${log.message}\r\n`;
}

export default function TerminalPanel({ logs }: TerminalPanelProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastLogCountRef = useRef(0);

  useEffect(() => {
    if (!terminalRef.current || termRef.current) return;

    const term = new Terminal({
      fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
      fontSize: 12,
      lineHeight: 1.4,
      theme: {
        background: "#1a1a1a",
        foreground: "#cccccc",
        cursor: "#EF9F27",
        cursorAccent: "#1a1a1a",
        selectionBackground: "rgba(239, 159, 39, 0.3)",
        selectionForeground: "#ffffff",
        black: "#1a1a1a",
        red: "#E24B4A",
        green: "#639922",
        yellow: "#EF9F27",
        blue: "#6b9dff",
        magenta: "#d16cd6",
        cyan: "#4ec9b0",
        white: "#e6e6e6",
        brightBlack: "#666666",
        brightRed: "#ff6b6b",
        brightGreen: "#92d16c",
        brightYellow: "#ffd93d",
        brightBlue: "#8bb8ff",
        brightMagenta: "#e08cff",
        brightCyan: "#7ee8d4",
        brightWhite: "#ffffff",
      },
      cursorBlink: false,
      cursorStyle: "block",
      scrollback: 1000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    
    // Fit terminal to container
    setTimeout(() => {
      fitAddon.fit();
    }, 100);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle resize
    const handleResize = () => {
      if (fitAddonRef.current && termRef.current) {
        fitAddonRef.current.fit();
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
      term.dispose();
      termRef.current = null;
    };
  }, []);

  // Write new logs to terminal
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;

    // Only write new logs since last render
    const newLogs = logs.slice(lastLogCountRef.current);
    lastLogCountRef.current = logs.length;

    for (const log of newLogs) {
      term.write(formatLogLine(log));
    }
  }, [logs]);

  return (
    <div
      ref={terminalRef}
      className="terminal-panel"
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    />
  );
}
