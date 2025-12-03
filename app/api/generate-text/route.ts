import { NextResponse } from "next/server";
import { generateText } from "ai";
import { getAIProvider, getAIModel } from "@/lib/ai-provider";

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Invalid prompt provided" },
        { status: 400 }
      );
    }

    // Get the provider and model
    const providerConfig = getAIProvider();
    const model = getAIModel();

    console.log(
      `Using provider: ${providerConfig.providerInfo.name} with model: ${providerConfig.providerInfo.defaultModel}`
    );

    // Generate text using AI SDK
    const { text } = await generateText({
      model: model,
      prompt: prompt,
    });

    return NextResponse.json({
      text,
      provider: providerConfig.providerInfo.name,
      model: providerConfig.providerInfo.defaultModel,
    });
  } catch (error: unknown) {
    console.error("Text generation error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Failed to generate text",
        details: errorMessage,
        suggestion:
          "Make sure your AI provider API key is correctly configured in .env file",
      },
      { status: 500 }
    );
  }
}
