import { NextRequest, NextResponse } from "next/server";

const BACKEND_PORT = 3030;

export async function GET(request: NextRequest) {
  const backendUrl = `http://localhost:${BACKEND_PORT}/api/logs`;
  
  try {
    const response = await fetch(backendUrl, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ logs: [] });
  }
}
