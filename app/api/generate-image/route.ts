import { type NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import OpenAI from "openai";
import {
  getAIModel,
  getProviderSpecificOptions,
  getAIProvider,
  AI_PROVIDERS,
} from "@/lib/ai-provider";

export const dynamic = "force-dynamic";

const MAX_PROMPT_LENGTH = 5000;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

interface GenerateImageResponse {
  url: string;
  prompt: string;
  description?: string;
}

interface ErrorResponse {
  error: string;
  message?: string;
  details?: string;
  availableProviders?: {
    provider: string;
    name: string;
    supportsImageGeneration: boolean;
    howToUse?: string;
  }[];
  suggestedAction?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Get AI provider configuration
    const { provider, providerInfo } = getAIProvider();

    const formData = await request.formData();
    const mode = formData.get("mode") as string;
    const prompt = formData.get("prompt") as string;
    const aspectRatio = formData.get("aspectRatio") as string;

    if (!mode) {
      return NextResponse.json<ErrorResponse>(
        { error: "Mode is required" },
        { status: 400 }
      );
    }

    if (!prompt?.trim()) {
      return NextResponse.json<ErrorResponse>(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json<ErrorResponse>(
        {
          error: `Prompt too long. Maximum ${MAX_PROMPT_LENGTH} characters allowed.`,
        },
        { status: 400 }
      );
    }

    // Check if provider supports image generation
    if (!providerInfo.supportsImageGeneration) {
      const supportedProviders = Object.entries(AI_PROVIDERS)
        .filter(([_, info]) => info.supportsImageGeneration)
        .map(([key, info]) => ({
          provider: key,
          name: info.name,
          supportsImageGeneration: true,
          howToUse: `Set API_SOURCE=${key} and ${info.envKeyName}=your_api_key in .env`,
        }));

      return NextResponse.json<ErrorResponse>(
        {
          error: "Provider does not support image generation",
          details: `${providerInfo.name} does not support image generation through this API.`,
          availableProviders: supportedProviders,
          suggestedAction:
            supportedProviders.length > 0
              ? `Switch to ${supportedProviders[0].name} for image generation. Update your .env file and restart the server.`
              : "No providers currently support image generation.",
        },
        { status: 400 }
      );
    }

    const model = getAIModel(true);

    if (mode === "text-to-image") {
      try {
        // For OpenAI, use DALL-E API directly
        if (provider === "openai") {
          const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
          });

          const sizeMap: Record<
            string,
            "1024x1024" | "1024x1792" | "1792x1024"
          > = {
            square: "1024x1024",
            portrait: "1024x1792",
            landscape: "1792x1024",
            "4:3": "1024x1024",
            "3:4": "1024x1792",
            "16:9": "1792x1024",
            "9:16": "1024x1792",
          };

          const size = sizeMap[aspectRatio] || "1024x1024";

          const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: size,
            quality: "standard",
            response_format: "url",
          });

          const imageUrl = response.data[0]?.url;

          if (!imageUrl) {
            throw new Error("No image URL returned from DALL-E");
          }

          // Download and convert to base64
          const imageResponse = await fetch(imageUrl);
          const arrayBuffer = await imageResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64 = buffer.toString("base64");
          const dataUrl = `data:image/png;base64,${base64}`;

          return NextResponse.json<GenerateImageResponse>({
            url: dataUrl,
            prompt: prompt,
            description:
              response.data[0]?.revised_prompt ||
              `Generated using ${providerInfo.name}`,
          });
        }

        // For other providers (future support)
        throw new Error(
          `Image generation not yet implemented for ${providerInfo.name}`
        );
      } catch (imageError) {
        console.error("Image generation error:", imageError);

        // Provide helpful error message
        const errorDetails =
          imageError instanceof Error
            ? imageError.message
            : "Unknown error occurred";

        const supportedProviders = Object.entries(AI_PROVIDERS)
          .filter(([_, info]) => info.supportsImageGeneration)
          .map(([key, info]) => ({
            provider: key,
            name: info.name,
            supportsImageGeneration: true,
            howToUse: `Set API_SOURCE=${key} and ${info.envKeyName}=your_api_key`,
          }));

        return NextResponse.json<ErrorResponse>(
          {
            error: "Image generation failed",
            details: errorDetails,
            message: `The current provider (${providerInfo.name}) encountered an error during image generation.`,
            availableProviders: supportedProviders,
            suggestedAction:
              "Try using OpenAI for reliable image generation with DALL-E 3.",
          },
          { status: 500 }
        );
      }
    } else if (mode === "image-editing") {
      const image1 = formData.get("image1") as File;
      const image2 = formData.get("image2") as File;
      const image1Url = formData.get("image1Url") as string;
      const image2Url = formData.get("image2Url") as string;

      const hasImage1 = image1 || image1Url;
      const hasImage2 = image2 || image2Url;

      if (!hasImage1) {
        return NextResponse.json<ErrorResponse>(
          { error: "At least one image is required for editing mode" },
          { status: 400 }
        );
      }

      if (image1) {
        if (image1.size > MAX_FILE_SIZE) {
          return NextResponse.json<ErrorResponse>(
            {
              error: `Image 1 too large. Maximum ${
                MAX_FILE_SIZE / 1024 / 1024
              }MB allowed.`,
            },
            { status: 400 }
          );
        }
        if (!ALLOWED_IMAGE_TYPES.includes(image1.type)) {
          return NextResponse.json<ErrorResponse>(
            {
              error:
                "Image 1 has invalid format. Allowed: JPEG, PNG, WebP, GIF",
            },
            { status: 400 }
          );
        }
      }

      if (image2) {
        if (image2.size > MAX_FILE_SIZE) {
          return NextResponse.json<ErrorResponse>(
            {
              error: `Image 2 too large. Maximum ${
                MAX_FILE_SIZE / 1024 / 1024
              }MB allowed.`,
            },
            { status: 400 }
          );
        }
        if (!ALLOWED_IMAGE_TYPES.includes(image2.type)) {
          return NextResponse.json<ErrorResponse>(
            {
              error:
                "Image 2 has invalid format. Allowed: JPEG, PNG, WebP, GIF",
            },
            { status: 400 }
          );
        }
      }

      const convertToDataUrl = async (
        source: File | string
      ): Promise<string> => {
        if (typeof source === "string") {
          const response = await fetch(source);
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64 = buffer.toString("base64");
          const contentType =
            response.headers.get("content-type") || "image/jpeg";
          return `data:${contentType};base64,${base64}`;
        } else {
          const arrayBuffer = await source.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64 = buffer.toString("base64");
          return `data:${source.type};base64,${base64}`;
        }
      };

      const image1DataUrl = await convertToDataUrl(
        hasImage1 ? image1 || image1Url : ""
      );
      const image2DataUrl = hasImage2
        ? await convertToDataUrl(image2 || image2Url)
        : null;

      const messageParts: Array<{
        type: "text" | "image";
        text?: string;
        image?: string;
      }> = [];

      messageParts.push({ type: "image", image: image1DataUrl });
      if (image2DataUrl) {
        messageParts.push({ type: "image", image: image2DataUrl });
      }

      const editingPrompt = hasImage2
        ? `${prompt}. Combine these two images creatively while following the instructions.`
        : `${prompt}. Edit or transform this image based on the instructions.`;

      messageParts.push({ type: "text", text: editingPrompt });

      // Get provider-specific options
      const providerOptions = getProviderSpecificOptions(provider, aspectRatio);

      const result = await generateText({
        model,
        messages: [
          {
            role: "user",
            // @ts-ignore - Type issue with content parts
            content: messageParts,
          },
        ],
        providerOptions,
      });

      const imageFiles =
        result.files?.filter((f) => f.mediaType?.startsWith("image/")) || [];

      if (imageFiles.length === 0) {
        return NextResponse.json<ErrorResponse>(
          {
            error: "No image generated",
            details: "The model did not return any images",
          },
          { status: 500 }
        );
      }

      const firstImage = imageFiles[0];
      const imageUrl = `data:${firstImage.mediaType};base64,${firstImage.base64}`;

      return NextResponse.json<GenerateImageResponse>({
        url: imageUrl,
        prompt: editingPrompt,
        description: result.text || "",
      });
    } else {
      return NextResponse.json<ErrorResponse>(
        {
          error: "Invalid mode",
          details: "Mode must be 'text-to-image' or 'image-editing'",
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error in generate-image route:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    const supportedProviders = Object.entries(AI_PROVIDERS).map(
      ([key, info]) => ({
        provider: key,
        name: info.name,
        supportsImageGeneration: info.supportsImageGeneration,
        howToUse: info.supportsImageGeneration
          ? `Set API_SOURCE=${key} and ${info.envKeyName}=your_api_key in .env`
          : `${info.name} - Text generation only`,
      })
    );

    return NextResponse.json<ErrorResponse>(
      {
        error: "Failed to process request",
        details: errorMessage,
        message: "An error occurred while processing your image request.",
        availableProviders: supportedProviders,
        suggestedAction:
          "For image generation, use OpenAI (most reliable). For text processing, you can use any provider. Update your .env file with API_SOURCE and the corresponding API key.",
      },
      { status: 500 }
    );
  }
}
