import { NextRequest, NextResponse } from "next/server";
import { createDevReadyRowFromTodo } from "@/lib/mls-sheets";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { todoRowNumber?: number };
    if (!body.todoRowNumber) {
      return NextResponse.json({ error: "Provide todoRowNumber." }, { status: 400 });
    }

    const result = await createDevReadyRowFromTodo(body.todoRowNumber);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create MLS_READY dev row." },
      { status: 500 },
    );
  }
}
