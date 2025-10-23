import { NextResponse } from "next/server";
import { handleFunctionsAction } from "@/server/functionsHandler";

interface RouteParams {
  params: {
    action: string;
  };
}

export async function POST(request: Request, { params }: RouteParams) {
  const action = params.action;
  if (!action) {
    return NextResponse.json(
      {
        status: "error",
        result: { errors: ["Action parameter is required."] },
      },
      { status: 400 },
    );
  }

  let body: Record<string, unknown> = {};
  if (request.headers.get("content-type")?.includes("application/json")) {
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch (error) {
      return NextResponse.json(
        {
          status: "error",
          result: {
            errors: [
              error instanceof Error ? error.message : "Invalid JSON payload.",
            ],
          },
        },
        { status: 400 },
      );
    }
  }

  const result = await handleFunctionsAction(action, body);
  return NextResponse.json(result.body, { status: result.status });
}
