import { NextRequest, NextResponse } from "next/server";

const BACKEND_PORT = 3030;

// #region agent log
function agentDebugLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
  runId: string
) {
  fetch("http://127.0.0.1:7397/ingest/75d655f7-13a4-4896-be82-175c568767a4", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "278b81",
    },
    body: JSON.stringify({
      sessionId: "278b81",
      location,
      message,
      data,
      hypothesisId,
      runId,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}
// #endregion

export async function GET(request: NextRequest) {
  const runId = `run_${Date.now()}`;
  const backendUrl = `http://localhost:${BACKEND_PORT}/api/config`;
  
  try {
    agentDebugLog(
      "src/app/api/config/route.ts:GET",
      "proxy start",
      { backendUrl },
      "H1",
      runId
    );
    const response = await fetch(backendUrl, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    
    const bodyText = await response.text();
    agentDebugLog(
      "src/app/api/config/route.ts:GET",
      "proxy response",
      { status: response.status, ok: response.ok, bodyPrefix: bodyText.slice(0, 200) },
      "H1",
      runId
    );

    const data = JSON.parse(bodyText);
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    agentDebugLog(
      "src/app/api/config/route.ts:GET",
      "proxy error",
      { error: String(error) },
      "H1",
      runId
    );
    return NextResponse.json({ error: "Backend not available" }, { status: 503 });
  }
}
