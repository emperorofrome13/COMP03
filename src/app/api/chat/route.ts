import { NextRequest, NextResponse } from "next/server";

const BACKEND_PORT = 3030;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, conversationHistory = [] } = body;

    const backendUrl = `http://localhost:${BACKEND_PORT}/api/chat`;
    
    const response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        conversationHistory
      }),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Backend not available", message: error.message },
      { status: 503 }
    );
  }
}
