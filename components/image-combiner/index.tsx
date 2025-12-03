"use client";

import type React from "react";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { Dithering } from "@paper-design/shaders-react";
import { useMobile } from "@/hooks/use-mobile";
import { useImageUpload } from "./hooks/use-image-upload";
import { useImageGeneration } from "./hooks/use-image-generation";
import { useAspectRatio } from "./hooks/use-aspect-ratio";
import { HowItWorksModal } from "./how-it-works-modal";
import { usePersistentHistory } from "./hooks/use-persistent-history";
import { InputSection } from "./input-section";
import { OutputSection } from "./output-section";
import { ToastNotification } from "./toast-notification";
import { GenerationHistory } from "./generation-history";
import { GlobalDropZone } from "./global-drop-zone";
import { FullscreenViewer } from "./fullscreen-viewer";
import { ApiKeyWarning } from "@/components/api-key-warning";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MemoizedDithering = memo(Dithering);

export function ImageCombiner() {
  const isMobile = useMobile();
  const [generationType, setGenerationType] = useState<
    "text" | "image" | "coding" | "other"
  >("image");
  const [prompt, setPrompt] = useState(
    "A beautiful landscape with mountains and a lake at sunset"
  );
  const [textPrompt, setTextPrompt] = useState("");
  const [textConversations, setTextConversations] = useState<
    Array<{
      id: string;
      prompt: string;
      response: string;
      timestamp: number;
    }>
  >([]);
  const [isGeneratingText, setIsGeneratingText] = useState(false);

  // Other tab state
  const [selectedOtherFeature, setSelectedOtherFeature] = useState<
    "code" | "audio" | "video" | "data" | null
  >(null);
  const [codePrompt, setCodePrompt] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState<string>("javascript");
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [pendingLanguage, setPendingLanguage] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Detect language from generated code
  const detectLanguage = (code: string): string => {
    if (
      code.includes("import React") ||
      code.includes("useState") ||
      code.includes("useEffect") ||
      code.includes("jsx") ||
      code.includes("tsx")
    ) {
      return code.includes("interface") ||
        code.includes(": string") ||
        code.includes(": number")
        ? "typescript"
        : "javascript";
    }
    if (
      code.includes("def ") ||
      (code.includes("import ") && code.includes("from "))
    )
      return "python";
    if (
      code.includes("<?php") ||
      code.includes("$_GET") ||
      code.includes("$_POST")
    )
      return "php";
    if (
      code.includes("package ") ||
      (code.includes("func ") && code.includes("go"))
    )
      return "go";
    if (
      code.includes("fn ") ||
      code.includes("let mut") ||
      code.includes("impl ")
    )
      return "rust";
    if (code.includes("public class") || code.includes("public static void"))
      return "java";
    if (code.includes("using System") || code.includes("namespace "))
      return "csharp";
    if (
      code.includes("SELECT") ||
      code.includes("INSERT INTO") ||
      code.includes("CREATE TABLE")
    )
      return "sql";
    if (code.includes("<html") || code.includes("<!DOCTYPE")) return "html";
    if (
      code.includes("display:") ||
      code.includes("background:") ||
      code.includes(".class")
    )
      return "css";
    if (code.includes("#!/bin/bash") || code.includes("#!/bin/sh"))
      return "bash";
    return "javascript";
  };

  // Syntax highlighting function
  const highlightCode = (line: string, language: string) => {
    if (!line.trim()) return line;

    // Keywords for different languages
    const jsKeywords = [
      "import",
      "export",
      "default",
      "from",
      "const",
      "let",
      "var",
      "function",
      "return",
      "if",
      "else",
      "for",
      "while",
      "try",
      "catch",
      "async",
      "await",
      "class",
      "extends",
      "new",
      "this",
      "typeof",
      "instanceof",
    ];
    const reactKeywords = [
      "useState",
      "useEffect",
      "useCallback",
      "useMemo",
      "useRef",
      "useContext",
      "React",
      "Component",
      "Props",
      "PropTypes",
    ];

    // Comments
    if (line.trim().startsWith("//")) {
      return <span className="text-gray-500 italic">{line}</span>;
    }
    if (line.trim().startsWith("/*") || line.trim().startsWith("*")) {
      return <span className="text-gray-500 italic">{line}</span>;
    }

    const parts: React.ReactNode[] = [];
    let key = 0;

    // Split by various patterns
    const tokenRegex =
      /(\b(?:import|export|default|from|const|let|var|function|return|if|else|for|while|try|catch|async|await|class|extends|new|this|typeof|instanceof|useState|useEffect|useCallback|useMemo|useRef|useContext|React|Component|Props|PropTypes)\b|'[^']*'|"[^"]*"|`[^`]*`|\/\/.*$|\/\*[\s\S]*?\*\/|\b\d+\b|=>|[{}()[\];,.])/g;

    const tokens = line.split(tokenRegex);

    tokens.forEach((token, i) => {
      if (!token) return;

      // Comments
      if (token.startsWith("//") || token.startsWith("/*")) {
        parts.push(
          <span key={key++} className="text-gray-500 italic">
            {token}
          </span>
        );
      }
      // Strings
      else if (
        (token.startsWith("'") && token.endsWith("'")) ||
        (token.startsWith('"') && token.endsWith('"')) ||
        (token.startsWith("`") && token.endsWith("`"))
      ) {
        parts.push(
          <span key={key++} className="text-green-400">
            {token}
          </span>
        );
      }
      // Numbers
      else if (/^\d+$/.test(token)) {
        parts.push(
          <span key={key++} className="text-orange-400">
            {token}
          </span>
        );
      }
      // Keywords
      else if (jsKeywords.includes(token)) {
        parts.push(
          <span key={key++} className="text-purple-400">
            {token}
          </span>
        );
      }
      // React/Hooks
      else if (reactKeywords.includes(token)) {
        parts.push(
          <span key={key++} className="text-cyan-400">
            {token}
          </span>
        );
      }
      // Function names (word followed by parenthesis)
      else if (tokens[i + 1] === "(") {
        parts.push(
          <span key={key++} className="text-blue-400">
            {token}
          </span>
        );
      }
      // Punctuation
      else if (/^[{}()[\];,.]$/.test(token)) {
        parts.push(
          <span key={key++} className="text-gray-400">
            {token}
          </span>
        );
      }
      // Arrow functions
      else if (token === "=>") {
        parts.push(
          <span key={key++} className="text-purple-400">
            {token}
          </span>
        );
      }
      // Default text
      else {
        parts.push(<span key={key++}>{token}</span>);
      }
    });

    return <>{parts}</>;
  };

  // Handle code generation
  const handleGenerateCode = async (targetLanguage?: string) => {
    if (!codePrompt.trim() || isGeneratingCode) return;

    setIsGeneratingCode(true);

    try {
      const languageInstruction = targetLanguage ? ` in ${targetLanguage}` : "";
      const fullPrompt =
        targetLanguage && generatedCode
          ? `Convert this code to ${targetLanguage}:\n\n${generatedCode}`
          : codePrompt;

      const response = await fetch("/api/generate-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: fullPrompt + languageInstruction,
          language: targetLanguage,
          aiModel: selectedAiModel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate code");
      }

      const data = await response.json();
      setGeneratedCode(data.code);
      // Auto-detect language or use target language
      if (targetLanguage) {
        setCodeLanguage(targetLanguage);
      } else {
        const detectedLang = detectLanguage(data.code);
        setCodeLanguage(detectedLang);
      }
    } catch (error) {
      console.error("Code generation error:", error);
      alert(error instanceof Error ? error.message : "Failed to generate code");
    } finally {
      setIsGeneratingCode(false);
    }
  };

  // Handle language change - convert existing code
  const handleLanguageChange = (newLanguage: string) => {
    const oldLanguage = codeLanguage;

    // If we have existing code, show conversion modal
    if (generatedCode && oldLanguage !== newLanguage) {
      setPendingLanguage(newLanguage);
      setShowConversionModal(true);
    } else {
      setCodeLanguage(newLanguage);
    }
  };

  const confirmLanguageConversion = () => {
    if (pendingLanguage) {
      setCodeLanguage(pendingLanguage);
      setShowConversionModal(false);
      handleGenerateCode(pendingLanguage);
      setPendingLanguage(null);
    }
  };

  const cancelLanguageConversion = () => {
    setShowConversionModal(false);
    setPendingLanguage(null);
  };

  // Handle text generation
  const handleGenerateText = async () => {
    if (!textPrompt.trim() || isGeneratingText) return;

    const conversationId = Date.now().toString();
    setIsGeneratingText(true);

    try {
      const response = await fetch("/api/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: textPrompt,
          aiModel: selectedAiModel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate text");
      }

      const data = await response.json();

      setTextConversations((prev) => [
        ...prev,
        {
          id: conversationId,
          prompt: textPrompt,
          response: data.text,
          timestamp: Date.now(),
        },
      ]);

      setTextPrompt("");
    } catch (error) {
      console.error("Text generation error:", error);
      alert(error instanceof Error ? error.message : "Failed to generate text");
    } finally {
      setIsGeneratingText(false);
    }
  };
  const [mode, setMode] = useState<"text-to-image" | "image-editing">(
    "text-to-image"
  );
  const [useUrls, setUseUrls] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [dropZoneHover, setDropZoneHover] = useState<1 | 2 | null>(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [selectedAiModel, setSelectedAiModel] = useState("Gemini 2.5 Flash");
  const [availableKeys, setAvailableKeys] = useState<Record<string, boolean>>({
    gemini: false,
    openai: false,
    claude: false,
    llama: false,
    dalle: false,
    stability: false,
  });

  const [leftWidth, setLeftWidth] = useState(50); // percentage
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

  const showToast = (
    message: string,
    type: "success" | "error" = "success"
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Check for available API keys
  useEffect(() => {
    const checkApiKeys = async () => {
      try {
        const response = await fetch("/api/check-api-keys");
        if (response.ok) {
          const data = await response.json();
          setAvailableKeys(data.available || {});
        }
      } catch (error) {
        console.error("Failed to check API keys:", error);
      }
    };
    checkApiKeys();
  }, []);

  const {
    image1,
    image1Preview,
    image1Url,
    image2,
    image2Preview,
    image2Url,
    isConvertingHeic,
    heicProgress,
    handleImageUpload,
    handleUrlChange,
    clearImage,
    showToast: uploadShowToast,
  } = useImageUpload();

  const { aspectRatio, setAspectRatio, availableAspectRatios } =
    useAspectRatio();

  const {
    generations: persistedGenerations,
    setGenerations: setPersistedGenerations,
    addGeneration,
    clearHistory,
    deleteGeneration,
    isLoading: historyLoading,
    hasMore,
    loadMore,
    isLoadingMore,
  } = usePersistentHistory(showToast);

  const {
    selectedGenerationId,
    setSelectedGenerationId,
    imageLoaded,
    setImageLoaded,
    generateImage: runGeneration,
    cancelGeneration,
    loadGeneratedAsInput,
  } = useImageGeneration({
    prompt,
    aspectRatio,
    image1,
    image2,
    image1Url,
    image2Url,
    useUrls,
    aiModel: selectedAiModel,
    generations: persistedGenerations,
    setGenerations: setPersistedGenerations,
    addGeneration,
    onToast: showToast,
    onImageUpload: handleImageUpload,
    onApiKeyMissing: () => setApiKeyMissing(true),
  });

  const selectedGeneration =
    persistedGenerations.find((g) => g.id === selectedGenerationId) ||
    persistedGenerations[0];
  const isLoading = persistedGenerations.some((g) => g.status === "loading");
  const generatedImage =
    selectedGeneration?.status === "complete" && selectedGeneration.imageUrl
      ? { url: selectedGeneration.imageUrl, prompt: selectedGeneration.prompt }
      : null;

  const hasImages = Boolean(
    useUrls ? image1Url || image2Url : image1 || image2
  );
  const currentMode = mode;
  const canGenerate = Boolean(
    prompt.trim().length > 0 &&
      (currentMode === "text-to-image" || (useUrls ? image1Url : image1))
  );

  useEffect(() => {
    if (
      selectedGeneration?.status === "complete" &&
      selectedGeneration?.imageUrl
    ) {
      setImageLoaded(false);
    }
  }, [selectedGenerationId, selectedGeneration?.imageUrl, setImageLoaded]);

  useEffect(() => {
    uploadShowToast.current = showToast;
  }, [uploadShowToast]);

  // Update prompt based on generation type
  useEffect(() => {
    if (generationType === "text") {
      setPrompt(
        "Write a short poem about artificial intelligence and creativity"
      );
    } else if (generationType === "image") {
      setPrompt("A beautiful landscape with mountains and a lake at sunset");
    } else {
      setPrompt("Explore AI capabilities...");
    }
  }, [generationType]);

  useEffect(() => {
    const checkApiKey = async () => {
      try {
        const response = await fetch("/api/check-api-key");
        const data = await response.json();
        if (!data.configured) {
          setApiKeyMissing(true);
        }
      } catch (error) {
        console.error("Error checking API key:", error);
      }
    };

    checkApiKey();
  }, []);
  // </CHANGE>

  const openFullscreen = useCallback(() => {
    if (generatedImage?.url) {
      setFullscreenImageUrl(generatedImage.url);
      setShowFullscreen(true);
      document.body.style.overflow = "hidden";
    }
  }, [generatedImage?.url]);

  const openImageFullscreen = useCallback((imageUrl: string) => {
    setFullscreenImageUrl(imageUrl);
    setShowFullscreen(true);
    document.body.style.overflow = "hidden";
  }, []);

  const closeFullscreen = useCallback(() => {
    setShowFullscreen(false);
    setFullscreenImageUrl("");
    document.body.style.overflow = "unset";
  }, []);

  const downloadImage = useCallback(async () => {
    if (!generatedImage) return;
    try {
      const response = await fetch(generatedImage.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `nano-banana-pro-${currentMode}-result.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading image:", error);
      window.open(generatedImage.url, "_blank");
    }
  }, [generatedImage, currentMode]);

  const openImageInNewTab = useCallback(() => {
    if (!generatedImage?.url) {
      console.error("No image URL available");
      return;
    }

    try {
      if (generatedImage.url.startsWith("data:")) {
        const parts = generatedImage.url.split(",");
        const mime = parts[0].match(/:(.*?);/)?.[1] || "image/png";
        const bstr = atob(parts[1]);
        const n = bstr.length;
        const u8arr = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
          u8arr[i] = bstr.charCodeAt(i);
        }
        const blob = new Blob([u8arr], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        const newWindow = window.open(blobUrl, "_blank", "noopener,noreferrer");
        if (newWindow) {
          setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
        }
      } else {
        window.open(generatedImage.url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      console.error("Error opening image:", error);
      window.open(generatedImage.url, "_blank");
    }
  }, [generatedImage]);

  const copyImageToClipboard = useCallback(async () => {
    if (!generatedImage) return;
    try {
      const convertToPngBlob = async (imageUrl: string): Promise<Blob> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";

          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");

            if (!ctx) {
              reject(new Error("Failed to get canvas context"));
              return;
            }

            ctx.drawImage(img, 0, 0);
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  resolve(blob);
                } else {
                  reject(new Error("Failed to convert to blob"));
                }
              },
              "image/png",
              1.0
            );
          };

          img.onerror = () => reject(new Error("Failed to load image"));
          img.src = imageUrl;
        });
      };

      if (isMobile) {
        try {
          const pngBlob = await convertToPngBlob(generatedImage.url);
          const clipboardItem = new ClipboardItem({ "image/png": pngBlob });
          await navigator.clipboard.write([clipboardItem]);
          setToast({ message: "Image copied to clipboard!", type: "success" });
          setTimeout(() => setToast(null), 2000);
          return;
        } catch (clipboardError) {
          try {
            const response = await fetch(generatedImage.url);
            const blob = await response.blob();
            const reader = new FileReader();
            reader.onloadend = async () => {
              try {
                await navigator.clipboard.writeText(reader.result as string);
                setToast({
                  message: "Image data copied! Paste in compatible apps.",
                  type: "success",
                });
                setTimeout(() => setToast(null), 3000);
              } catch (err) {
                throw new Error("Clipboard not supported");
              }
            };
            reader.readAsDataURL(blob);
            return;
          } catch (fallbackError) {
            setToast({
              message: "Copy not supported. Use download button instead.",
              type: "error",
            });
            setTimeout(() => setToast(null), 3000);
            return;
          }
        }
      }

      setToast({ message: "Copying image...", type: "success" });
      window.focus();

      const pngBlob = await convertToPngBlob(generatedImage.url);
      const clipboardItem = new ClipboardItem({ "image/png": pngBlob });
      await navigator.clipboard.write([clipboardItem]);

      setToast({ message: "Image copied to clipboard!", type: "success" });
      setTimeout(() => setToast(null), 2000);
    } catch (error) {
      console.error("Error copying image:", error);
      if (error instanceof Error && error.message.includes("not focused")) {
        setToast({
          message: "Please click on the page first, then try copying again",
          type: "error",
        });
      } else {
        setToast({ message: "Failed to copy image", type: "error" });
      }
      setTimeout(() => setToast(null), 2000);
    }
  }, [generatedImage, isMobile]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (canGenerate) {
          runGeneration();
        }
      }
    },
    [canGenerate, runGeneration]
  );

  const handleGlobalKeyboard = useCallback(
    (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isTyping =
        activeElement?.tagName === "TEXTAREA" ||
        activeElement?.tagName === "INPUT";

      if (
        (e.metaKey || e.ctrlKey) &&
        e.key === "c" &&
        generatedImage &&
        !e.shiftKey
      ) {
        if (!isTyping) {
          e.preventDefault();
          copyImageToClipboard();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "d" && generatedImage) {
        if (!isTyping) {
          e.preventDefault();
          downloadImage();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "u" && generatedImage) {
        if (!isTyping) {
          e.preventDefault();
          loadGeneratedAsInput();
        }
      }
      if (e.key === "Escape" && showFullscreen) {
        closeFullscreen();
      }
      if (
        showFullscreen &&
        (e.key === "ArrowLeft" || e.key === "ArrowRight") &&
        !isTyping
      ) {
        e.preventDefault();
        const completedGenerations = persistedGenerations.filter(
          (g) => g.status === "complete" && g.imageUrl
        );
        if (completedGenerations.length <= 1) return;

        const currentIndex = completedGenerations.findIndex(
          (g) => g.imageUrl === fullscreenImageUrl
        );
        if (currentIndex === -1) return;

        if (e.key === "ArrowLeft") {
          const prevIndex =
            currentIndex === 0
              ? completedGenerations.length - 1
              : currentIndex - 1;
          setFullscreenImageUrl(completedGenerations[prevIndex].imageUrl!);
          setSelectedGenerationId(completedGenerations[prevIndex].id);
        } else if (e.key === "ArrowRight") {
          const nextIndex =
            currentIndex === completedGenerations.length - 1
              ? 0
              : currentIndex + 1;
          setFullscreenImageUrl(completedGenerations[nextIndex].imageUrl!);
          setSelectedGenerationId(completedGenerations[nextIndex].id);
        }
      }
    },
    [
      generatedImage,
      showFullscreen,
      copyImageToClipboard,
      downloadImage,
      loadGeneratedAsInput,
      closeFullscreen,
      persistedGenerations,
      fullscreenImageUrl,
      setSelectedGenerationId,
    ]
  );

  const handleGlobalPaste = useCallback(
    async (e: ClipboardEvent) => {
      const activeElement = document.activeElement;
      if (
        activeElement?.tagName !== "TEXTAREA" &&
        activeElement?.tagName !== "INPUT"
      ) {
        const items = e.clipboardData?.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith("image/")) {
              e.preventDefault();
              const file = item.getAsFile();
              if (file) {
                setUseUrls(false);
                if (!image1) {
                  await handleImageUpload(file, 1);
                  showToast("Image pasted successfully", "success");
                } else if (!image2) {
                  await handleImageUpload(file, 2);
                  showToast("Image pasted to second slot", "success");
                } else {
                  await handleImageUpload(file, 1);
                  showToast("Image replaced first slot", "success");
                }
              }
              return;
            }
          }
        }

        const pastedText = e.clipboardData?.getData("text");

        if (!pastedText) return;

        const urlPattern = /https?:\/\/[^\s]+/i;
        const imagePattern =
          /\.(jpg|jpeg|png|gif|webp|bmp|svg)|format=(jpg|jpeg|png|gif|webp)/i;

        const match = pastedText.match(urlPattern);

        if (match) {
          const url = match[0];
          if (
            imagePattern.test(url) ||
            url.includes("/media/") ||
            url.includes("/images/")
          ) {
            e.preventDefault();

            const targetSlot = !image1Url ? 1 : !image2Url ? 2 : 1;

            setUseUrls(true);

            setTimeout(() => {
              handleUrlChange(url, targetSlot);
              showToast(
                `Image URL pasted to ${
                  targetSlot === 1 ? "first" : "second"
                } slot`,
                "success"
              );
            }, 150);
          }
        }
      }
    },
    [image1, image2, image1Url, image2Url, handleImageUpload, handleUrlChange]
  );

  const handlePromptPaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const pastedText = e.clipboardData.getData("text");

      const urlPattern = /https?:\/\/[^\s]+/i;
      const imagePattern =
        /\.(jpg|jpeg|png|gif|webp|bmp|svg)|format=(jpg|jpeg|png|gif|webp)/i;

      const match = pastedText.match(urlPattern);

      if (match) {
        const url = match[0];
        if (
          imagePattern.test(url) ||
          url.includes("/media/") ||
          url.includes("/images/")
        ) {
          e.preventDefault();

          if (!useUrls) {
            setUseUrls(true);
          }

          if (!image1Url) {
            handleUrlChange(url, 1);
            showToast("Image URL loaded into first slot", "success");
          } else if (!image2Url) {
            handleUrlChange(url, 2);
            showToast("Image URL loaded into second slot", "success");
          } else {
            handleUrlChange(url, 1);
            showToast("Image URL replaced first slot", "success");
          }
        }
      }
    },
    [useUrls, image1Url, image2Url, handleUrlChange]
  );

  const handleGlobalDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragCounter((prev) => prev + 1);
    const items = e.dataTransfer?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === "file" && items[i].type.startsWith("image/")) {
          setIsDraggingOver(true);
          break;
        }
      }
    }
  }, []);

  const handleGlobalDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const handleGlobalDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragCounter((prev) => {
      const newCount = prev - 1;
      if (newCount <= 0) {
        setIsDraggingOver(false);
        return 0;
      }
      return newCount;
    });
  }, []);

  const handleGlobalDrop = useCallback(
    async (e: DragEvent | React.DragEvent, slot?: 1 | 2) => {
      e.preventDefault();
      setIsDraggingOver(false);
      setDragCounter(0);
      setDropZoneHover(null);

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type.startsWith("image/")) {
          setUseUrls(false);
          const targetSlot = slot || 1;
          await handleImageUpload(file, targetSlot);
          showToast(
            `Image dropped to ${targetSlot === 1 ? "first" : "second"} slot`,
            "success"
          );
        }
      }
    },
    [handleImageUpload]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleGlobalKeyboard);
    document.addEventListener("paste", handleGlobalPaste);
    document.addEventListener("dragover", handleGlobalDragOver);
    document.addEventListener("dragleave", handleGlobalDragLeave);
    document.addEventListener("dragenter", handleGlobalDragEnter);
    return () => {
      document.removeEventListener("keydown", handleGlobalKeyboard);
      document.removeEventListener("paste", handleGlobalPaste);
      document.removeEventListener("dragover", handleGlobalDragOver);
      document.removeEventListener("dragleave", handleGlobalDragLeave);
      document.removeEventListener("dragenter", handleGlobalDragEnter);
    };
  }, [
    handleGlobalKeyboard,
    handleGlobalPaste,
    handleGlobalDragOver,
    handleGlobalDragLeave,
    handleGlobalDragEnter,
  ]);

  const clearAll = useCallback(() => {
    setPrompt("");
    clearImage(1);
    clearImage(2);
    setTimeout(() => {
      promptTextareaRef.current?.focus();
    }, 0);
  }, [clearImage]);

  const handleFullscreenNavigate = useCallback(
    (direction: "prev" | "next") => {
      const completedGenerations = persistedGenerations.filter(
        (g) => g.status === "complete" && g.imageUrl
      );
      const currentIndex = completedGenerations.findIndex(
        (g) => g.imageUrl === fullscreenImageUrl
      );
      if (currentIndex === -1) return;

      let newIndex: number;
      if (direction === "prev") {
        newIndex =
          currentIndex === 0
            ? completedGenerations.length - 1
            : currentIndex - 1;
      } else {
        newIndex =
          currentIndex === completedGenerations.length - 1
            ? 0
            : currentIndex + 1;
      }

      setFullscreenImageUrl(completedGenerations[newIndex].imageUrl!);
      setSelectedGenerationId(completedGenerations[newIndex].id);
    },
    [persistedGenerations, fullscreenImageUrl, setSelectedGenerationId]
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const offsetX = e.clientX - containerRect.left;
      const percentage = (offsetX / containerRect.width) * 100;

      // Limit between 30% and 70%
      const clampedPercentage = Math.max(30, Math.min(70, percentage));
      setLeftWidth(clampedPercentage);
    },
    [isResizing]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  const handleDoubleClick = useCallback(() => {
    setLeftWidth(50);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div className="bg-background min-h-screen flex items-center justify-center select-none">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Nano Banana Pro",
            alternateName: "NB Pro",
            description:
              "Nano Banana Pro is a powerful AI image generation and editing tool powered by Google Gemini 2.5 Flash Image. Create, edit, and transform images with natural language prompts.",
            url: "https://v0nanobananapro.vercel.app",
            applicationCategory: "MultimediaApplication",
            operatingSystem: "Web Browser",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
            },
            creator: {
              "@type": "Organization",
              name: "v0",
              url: "https://v0.app",
            },
            keywords:
              "nano banana pro, nb pro, AI image generation, AI image editor, free AI image generator, text to image, Gemini image generation",
          }),
        }}
      />

      {toast && <ToastNotification message={toast.message} type={toast.type} />}

      {isDraggingOver && (
        <GlobalDropZone
          dropZoneHover={dropZoneHover}
          onSetDropZoneHover={setDropZoneHover}
          onDrop={handleGlobalDrop}
        />
      )}

      <div className="fixed inset-0 z-0 select-none shader-background bg-black">
        <MemoizedDithering
          colorBack="#00000000"
          colorFront="#005B5B"
          speed={0.43}
          shape="wave"
          type="4x4"
          pxSize={3}
          scale={1.13}
          style={{
            backgroundColor: "#000000",
            height: "100vh",
            width: "100vw",
          }}
        />
      </div>

      <div className="relative z-10 w-full h-screen flex flex-col">
        {/* Header */}
        <header className="bg-black/80 backdrop-blur-sm border-b border-white/10 px-4 py-3 md:px-6 md:py-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-xl md:text-3xl font-bold text-white select-none leading-none">
                    Nano Banana Pro
                  </h1>
                  <p className="text-[10px] md:text-xs text-gray-400 select-none mt-1">
                    AI-Powered Creative Playground
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAiModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 rounded-lg transition-all group"
              >
                <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse" />
                <div className="text-left">
                  <div className="text-xs font-semibold text-teal-300">
                    {selectedAiModel}
                  </div>
                  <div className="text-[9px] text-teal-400/60">
                    Click to change
                  </div>
                </div>
                <svg
                  className="w-4 h-4 text-teal-400 group-hover:rotate-90 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* Tabs Section */}
        <div className="bg-black/70 backdrop-blur-sm border-b border-white/10 px-4 py-3 md:px-6 md:py-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex gap-2 p-1.5 bg-black/50 rounded-xl border border-white/20">
              <button
                onClick={() => setGenerationType("text")}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 md:py-3.5 rounded-lg transition-all text-xs md:text-base font-semibold ${
                  generationType === "text"
                    ? "bg-linear-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
              >
                <svg
                  className="w-5 h-5 md:w-6 md:h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span className="hidden sm:inline">Text</span>
              </button>
              <button
                onClick={() => setGenerationType("image")}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 md:py-3.5 rounded-lg transition-all text-xs md:text-base font-semibold ${
                  generationType === "image"
                    ? "bg-linear-to-r from-purple-500 to-pink-600 text-white shadow-lg shadow-purple-500/30"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
              >
                <svg
                  className="w-5 h-5 md:w-6 md:h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span className="hidden sm:inline">Image</span>
              </button>
              <button
                onClick={() => setGenerationType("coding")}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 md:py-3.5 rounded-lg transition-all text-xs md:text-base font-semibold ${
                  generationType === "coding"
                    ? "bg-linear-to-r from-yellow-500 to-orange-600 text-white shadow-lg shadow-yellow-500/30"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
              >
                <svg
                  className="w-5 h-5 md:w-6 md:h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                  />
                </svg>
                <span className="hidden sm:inline">Coding</span>
              </button>
              <button
                onClick={() => setGenerationType("other")}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 md:py-3.5 rounded-lg transition-all text-xs md:text-base font-semibold ${
                  generationType === "other"
                    ? "bg-linear-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/30"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
              >
                <svg
                  className="w-5 h-5 md:w-6 md:h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                  />
                </svg>
                <span className="hidden sm:inline">Other</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            <div className="bg-black/70 border-0 px-3 py-3 md:px-4 md:py-4 lg:px-6 lg:py-6 rounded-lg">
              {apiKeyMissing && <ApiKeyWarning />}

              {/* Text Generation Mode */}
              {generationType === "text" && (
                <div className="space-y-6">
                  <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[calc(100vh-280px)] min-h-[500px]">
                    {/* Conversation History */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      {textConversations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                          <svg
                            className="w-16 h-16 text-gray-600 mb-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                            />
                          </svg>
                          <p className="text-gray-400 text-lg font-medium mb-2">
                            Start a conversation
                          </p>
                          <p className="text-gray-500 text-sm max-w-md">
                            Enter a prompt below to generate AI-powered text
                            responses
                          </p>
                        </div>
                      ) : (
                        textConversations.map((conversation) => (
                          <div key={conversation.id} className="space-y-3">
                            {/* User Message */}
                            <div className="flex justify-end">
                              <div className="max-w-[80%] bg-blue-600/90 backdrop-blur-sm text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-lg">
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                  {conversation.prompt}
                                </p>
                                <p className="text-xs text-blue-200 mt-1.5 opacity-70">
                                  {new Date(
                                    conversation.timestamp
                                  ).toLocaleTimeString()}
                                </p>
                              </div>
                            </div>

                            {/* AI Response */}
                            <div className="flex justify-start">
                              <div className="max-w-[80%] bg-gray-800/70 backdrop-blur-sm text-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-lg border border-gray-700/50">
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                  {conversation.response}
                                </p>
                                <p className="text-xs text-gray-400 mt-1.5">
                                  AI Response
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}

                      {/* Loading State */}
                      {isGeneratingText && (
                        <div className="flex justify-start">
                          <div className="max-w-[80%] bg-gray-800/70 backdrop-blur-sm text-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-lg border border-gray-700/50">
                            <div className="flex items-center gap-2">
                              <div className="flex gap-1">
                                <div
                                  className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                                  style={{ animationDelay: "0ms" }}
                                ></div>
                                <div
                                  className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                                  style={{ animationDelay: "150ms" }}
                                ></div>
                                <div
                                  className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                                  style={{ animationDelay: "300ms" }}
                                ></div>
                              </div>
                              <span className="text-sm text-gray-400">
                                Generating...
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Input Area */}
                    <div className="border-t border-gray-800 bg-gray-900/80 backdrop-blur-sm p-6">
                      <div className="flex gap-3">
                        <textarea
                          value={textPrompt}
                          onChange={(e) => setTextPrompt(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleGenerateText();
                            }
                          }}
                          className="flex-1 p-4 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                          rows={3}
                          placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
                          disabled={isGeneratingText}
                        />
                        <button
                          onClick={handleGenerateText}
                          disabled={!textPrompt.trim() || isGeneratingText}
                          className="self-end px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2"
                        >
                          {isGeneratingText ? (
                            <>
                              <svg
                                className="animate-spin h-5 w-5"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                              <span>Sending...</span>
                            </>
                          ) : (
                            <>
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                                />
                              </svg>
                              <span>Send</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Image Generation Mode */}
              {generationType === "image" && (
                <div className="flex flex-col gap-4 xl:gap-0">
                  <div
                    ref={containerRef}
                    className="flex flex-col xl:flex-row gap-4 xl:gap-0 xl:min-h-[60vh] 2xl:min-h-[62vh]"
                  >
                    <div
                      className="flex flex-col xl:pl-4 xl:pr-4 xl:border-r xl:border-white/10 xl:pt-5 flex-shrink-0 xl:overflow-y-auto xl:max-h-[85vh] 2xl:max-h-[80vh]"
                      style={{
                        width: isMobile ? "100%" : `${leftWidth}%`,
                      }}
                    >
                      <InputSection
                        mode={mode}
                        setMode={setMode}
                        prompt={prompt}
                        setPrompt={setPrompt}
                        aspectRatio={aspectRatio}
                        setAspectRatio={setAspectRatio}
                        availableAspectRatios={availableAspectRatios}
                        useUrls={useUrls}
                        setUseUrls={setUseUrls}
                        image1Preview={image1Preview}
                        image2Preview={image2Preview}
                        image1Url={image1Url}
                        image2Url={image2Url}
                        isConvertingHeic={isConvertingHeic}
                        canGenerate={canGenerate}
                        hasImages={hasImages}
                        onGenerate={runGeneration}
                        onClearAll={clearAll}
                        onImageUpload={handleImageUpload}
                        onUrlChange={handleUrlChange}
                        onClearImage={clearImage}
                        onKeyDown={handleKeyDown}
                        onPromptPaste={handlePromptPaste}
                        onImageFullscreen={openImageFullscreen}
                        promptTextareaRef={promptTextareaRef}
                        generations={persistedGenerations}
                        selectedGenerationId={selectedGenerationId}
                        onSelectGeneration={setSelectedGenerationId}
                        onCancelGeneration={cancelGeneration}
                        onDeleteGeneration={deleteGeneration}
                        historyLoading={historyLoading}
                        hasMore={hasMore}
                        onLoadMore={loadMore}
                        isLoadingMore={isLoadingMore}
                      />
                      {/* </CHANGE> */}

                      {/* Desktop History */}
                      <div className="hidden xl:block mt-3 flex-shrink-0">
                        <GenerationHistory
                          generations={persistedGenerations}
                          selectedId={selectedGenerationId ?? undefined}
                          onSelect={setSelectedGenerationId}
                          onCancel={cancelGeneration}
                          onDelete={deleteGeneration}
                          isLoading={historyLoading}
                          hasMore={hasMore}
                          onLoadMore={loadMore}
                          isLoadingMore={isLoadingMore}
                        />
                      </div>
                    </div>

                    <div
                      className="hidden xl:flex items-center justify-center cursor-col-resize hover:bg-white/10 transition-colors relative group"
                      style={{ width: "8px", flexShrink: 0 }}
                      onMouseDown={handleMouseDown}
                      onDoubleClick={handleDoubleClick}
                    >
                      <div className="w-0.5 h-8 bg-white/20 group-hover:bg-white/40 transition-colors rounded-full" />
                    </div>

                    <div
                      className="flex flex-col xl:pl-4 xl:pr-4 h-[400px] sm:h-[500px] md:h-[600px] xl:h-auto flex-shrink-0"
                      style={{
                        width: isMobile ? "100%" : `${100 - leftWidth}%`,
                      }}
                    >
                      <OutputSection
                        selectedGeneration={selectedGeneration}
                        generations={persistedGenerations}
                        selectedGenerationId={selectedGenerationId}
                        setSelectedGenerationId={setSelectedGenerationId}
                        isConvertingHeic={isConvertingHeic}
                        heicProgress={heicProgress}
                        imageLoaded={imageLoaded}
                        setImageLoaded={setImageLoaded}
                        onCancelGeneration={cancelGeneration}
                        onDeleteGeneration={deleteGeneration}
                        onOpenFullscreen={openFullscreen}
                        onLoadAsInput={loadGeneratedAsInput}
                        onCopy={copyImageToClipboard}
                        onDownload={downloadImage}
                        onOpenInNewTab={openImageInNewTab}
                      />
                    </div>
                  </div>

                  {/* Mobile History - After both sections */}
                  <div className="xl:hidden flex-shrink-0">
                    <GenerationHistory
                      generations={persistedGenerations}
                      selectedId={selectedGenerationId ?? undefined}
                      onSelect={setSelectedGenerationId}
                      onCancel={cancelGeneration}
                      onDelete={deleteGeneration}
                      isLoading={historyLoading}
                      hasMore={hasMore}
                      onLoadMore={loadMore}
                      isLoadingMore={isLoadingMore}
                    />
                  </div>
                </div>
              )}

              {/* Coding Generation Mode */}
              {generationType === "coding" && (
                <div className="space-y-6 w-full px-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold text-white">
                        AI Code Generation
                      </h2>
                      {generatedCode && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(generatedCode);
                            setToast({
                              message: "Code copied to clipboard!",
                              type: "success",
                            });
                          }}
                          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all flex items-center gap-2"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                          Copy Code
                        </button>
                      )}
                    </div>

                    {/* Suggestions Dropdown */}
                    <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setShowSuggestions(!showSuggestions)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-all group"
                      >
                        <div className="flex items-center gap-2">
                          <svg
                            className="w-5 h-5 text-yellow-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                            />
                          </svg>
                          <span className="text-yellow-300 font-semibold text-sm">
                            Quick Suggestions
                          </span>
                          <span className="text-yellow-400/60 text-xs">
                            (Click to expand)
                          </span>
                        </div>
                        <svg
                          className={`w-5 h-5 text-yellow-400 transition-transform duration-200 ${
                            showSuggestions ? "rotate-180" : ""
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>

                      {showSuggestions && (
                        <div className="px-4 pb-4 pt-2 bg-gradient-to-r from-yellow-500/5 to-orange-500/5 border-t border-yellow-500/20 animate-in slide-in-from-top-2 duration-200">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            <button
                              onClick={() => {
                                setCodePrompt(
                                  "Write a JavaScript function to validate email addresses"
                                );
                                setShowSuggestions(false);
                              }}
                              className="text-left px-3 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 hover:border-yellow-500/50 rounded-lg text-yellow-100 text-xs transition-all group"
                            >
                              <span className="block font-medium mb-0.5 group-hover:text-yellow-300">
                                📧 Email Validator
                              </span>
                              <span className="text-yellow-200/60 text-[10px]">
                                Validate email format
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                setCodePrompt(
                                  "Create a React hook for fetching data with loading and error states"
                                );
                                setShowSuggestions(false);
                              }}
                              className="text-left px-3 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 hover:border-yellow-500/50 rounded-lg text-yellow-100 text-xs transition-all group"
                            >
                              <span className="block font-medium mb-0.5 group-hover:text-yellow-300">
                                ⚛️ Custom Hook
                              </span>
                              <span className="text-yellow-200/60 text-[10px]">
                                Data fetching hook
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                setCodePrompt(
                                  "Write a Python function to sort a list of dictionaries by a specific key"
                                );
                                setShowSuggestions(false);
                              }}
                              className="text-left px-3 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 hover:border-yellow-500/50 rounded-lg text-yellow-100 text-xs transition-all group"
                            >
                              <span className="block font-medium mb-0.5 group-hover:text-yellow-300">
                                🐍 Python Sort
                              </span>
                              <span className="text-yellow-200/60 text-[10px]">
                                Sort dictionaries
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                setCodePrompt(
                                  "Create a debounce function in JavaScript for search input"
                                );
                                setShowSuggestions(false);
                              }}
                              className="text-left px-3 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 hover:border-yellow-500/50 rounded-lg text-yellow-100 text-xs transition-all group"
                            >
                              <span className="block font-medium mb-0.5 group-hover:text-yellow-300">
                                ⏱️ Debounce
                              </span>
                              <span className="text-yellow-200/60 text-[10px]">
                                Optimize search input
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                setCodePrompt(
                                  "Write a TypeScript interface for a user profile with nested address object"
                                );
                                setShowSuggestions(false);
                              }}
                              className="text-left px-3 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 hover:border-yellow-500/50 rounded-lg text-yellow-100 text-xs transition-all group"
                            >
                              <span className="block font-medium mb-0.5 group-hover:text-yellow-300">
                                📝 TS Interface
                              </span>
                              <span className="text-yellow-200/60 text-[10px]">
                                User profile types
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                setCodePrompt(
                                  "Create a CSS flexbox layout with centered content and responsive design"
                                );
                                setShowSuggestions(false);
                              }}
                              className="text-left px-3 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 hover:border-yellow-500/50 rounded-lg text-yellow-100 text-xs transition-all group"
                            >
                              <span className="block font-medium mb-0.5 group-hover:text-yellow-300">
                                🎨 Flexbox Layout
                              </span>
                              <span className="text-yellow-200/60 text-[10px]">
                                Responsive center
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                setCodePrompt(
                                  "Write a SQL query to join two tables and aggregate data"
                                );
                                setShowSuggestions(false);
                              }}
                              className="text-left px-3 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 hover:border-yellow-500/50 rounded-lg text-yellow-100 text-xs transition-all group"
                            >
                              <span className="block font-medium mb-0.5 group-hover:text-yellow-300">
                                🗄️ SQL Join
                              </span>
                              <span className="text-yellow-200/60 text-[10px]">
                                Join & aggregate
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                setCodePrompt(
                                  "Create a Node.js Express middleware for authentication"
                                );
                                setShowSuggestions(false);
                              }}
                              className="text-left px-3 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 hover:border-yellow-500/50 rounded-lg text-yellow-100 text-xs transition-all group"
                            >
                              <span className="block font-medium mb-0.5 group-hover:text-yellow-300">
                                🔐 Auth Middleware
                              </span>
                              <span className="text-yellow-200/60 text-[10px]">
                                Express auth
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                setCodePrompt(
                                  "Write a regex pattern to validate phone numbers in various formats"
                                );
                                setShowSuggestions(false);
                              }}
                              className="text-left px-3 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 hover:border-yellow-500/50 rounded-lg text-yellow-100 text-xs transition-all group"
                            >
                              <span className="block font-medium mb-0.5 group-hover:text-yellow-300">
                                📞 Phone Regex
                              </span>
                              <span className="text-yellow-200/60 text-[10px]">
                                Format validation
                              </span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 max-w-[1800px] mx-auto">
                      {/* Input Section */}
                      <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Describe the code you want to generate
                          </label>
                          <textarea
                            value={codePrompt}
                            onChange={(e) => setCodePrompt(e.target.value)}
                            disabled={isGeneratingCode}
                            className="w-full p-4 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                            rows={4}
                            placeholder="Example: Create a React component that displays a todo list with add, delete, and mark as complete functionality"
                          />
                        </div>
                        <button
                          onClick={() => handleGenerateCode()}
                          disabled={!codePrompt.trim() || isGeneratingCode}
                          className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-lg shadow-yellow-500/30 transition-all flex items-center justify-center gap-2"
                        >
                          {isGeneratingCode ? (
                            <>
                              <svg
                                className="animate-spin h-5 w-5"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                              Generating...
                            </>
                          ) : (
                            <>
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                                />
                              </svg>
                              Generate Code
                            </>
                          )}
                        </button>
                      </div>

                      {/* Language Conversion Tip */}
                      {generatedCode && (
                        <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
                          <svg
                            className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <div className="flex-1">
                            <p className="text-yellow-300 text-sm font-medium mb-1">
                              💡 Transform & Test Across Languages
                            </p>
                            <p className="text-yellow-200/80 text-xs">
                              Change the language dropdown below to instantly
                              convert your code to another language. Perfect for
                              testing implementations across different tech
                              stacks!
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Output Section */}
                      <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl overflow-hidden code-container">
                        <div className="bg-gray-800/50 px-4 py-2.5 border-b border-gray-700/50 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <div className="flex gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                              </div>
                            </div>
                            <Select
                              value={codeLanguage}
                              onValueChange={handleLanguageChange}
                            >
                              <SelectTrigger className="w-[140px] h-7 bg-gray-700/50 text-gray-300 text-xs border-gray-600 focus:ring-1 focus:ring-yellow-500 font-medium">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-gray-800 border-gray-700">
                                <SelectItem
                                  value="javascript"
                                  className="text-xs cursor-pointer hover:bg-gray-700 focus:bg-gray-700"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-yellow-400">●</span>
                                    <span>JavaScript</span>
                                  </div>
                                </SelectItem>
                                <SelectItem
                                  value="typescript"
                                  className="text-xs cursor-pointer hover:bg-gray-700 focus:bg-gray-700"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-blue-400">●</span>
                                    <span>TypeScript</span>
                                  </div>
                                </SelectItem>
                                <SelectItem
                                  value="python"
                                  className="text-xs cursor-pointer hover:bg-gray-700 focus:bg-gray-700"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-green-400">●</span>
                                    <span>Python</span>
                                  </div>
                                </SelectItem>
                                <SelectItem
                                  value="java"
                                  className="text-xs cursor-pointer hover:bg-gray-700 focus:bg-gray-700"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-red-400">●</span>
                                    <span>Java</span>
                                  </div>
                                </SelectItem>
                                <SelectItem
                                  value="csharp"
                                  className="text-xs cursor-pointer hover:bg-gray-700 focus:bg-gray-700"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-purple-400">●</span>
                                    <span>C#</span>
                                  </div>
                                </SelectItem>
                                <SelectItem
                                  value="go"
                                  className="text-xs cursor-pointer hover:bg-gray-700 focus:bg-gray-700"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-cyan-400">●</span>
                                    <span>Go</span>
                                  </div>
                                </SelectItem>
                                <SelectItem
                                  value="rust"
                                  className="text-xs cursor-pointer hover:bg-gray-700 focus:bg-gray-700"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-orange-400">●</span>
                                    <span>Rust</span>
                                  </div>
                                </SelectItem>
                                <SelectItem
                                  value="php"
                                  className="text-xs cursor-pointer hover:bg-gray-700 focus:bg-gray-700"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-indigo-400">●</span>
                                    <span>PHP</span>
                                  </div>
                                </SelectItem>
                                <SelectItem
                                  value="ruby"
                                  className="text-xs cursor-pointer hover:bg-gray-700 focus:bg-gray-700"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-red-500">●</span>
                                    <span>Ruby</span>
                                  </div>
                                </SelectItem>
                                <SelectItem
                                  value="html"
                                  className="text-xs cursor-pointer hover:bg-gray-700 focus:bg-gray-700"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-orange-500">●</span>
                                    <span>HTML</span>
                                  </div>
                                </SelectItem>
                                <SelectItem
                                  value="css"
                                  className="text-xs cursor-pointer hover:bg-gray-700 focus:bg-gray-700"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-blue-500">●</span>
                                    <span>CSS</span>
                                  </div>
                                </SelectItem>
                                <SelectItem
                                  value="sql"
                                  className="text-xs cursor-pointer hover:bg-gray-700 focus:bg-gray-700"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-pink-400">●</span>
                                    <span>SQL</span>
                                  </div>
                                </SelectItem>
                                <SelectItem
                                  value="bash"
                                  className="text-xs cursor-pointer hover:bg-gray-700 focus:bg-gray-700"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-400">●</span>
                                    <span>Bash</span>
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <span className="text-xs text-gray-500">
                              {generatedCode
                                ? `${generatedCode.split("\n").length} lines`
                                : "Editable"}
                            </span>
                          </div>
                        </div>
                        <div className="relative bg-[#0d1117] h-[600px] overflow-auto">
                          <div className="relative min-h-full">
                            {/* Line Numbers */}
                            {generatedCode && (
                              <div className="absolute left-0 top-0 w-14 bg-[#161b22] border-r border-gray-700/50 py-4 px-2 text-right select-none z-10">
                                {generatedCode.split("\n").map((_, i) => (
                                  <div
                                    key={i}
                                    className="text-xs text-gray-600 leading-6 font-mono"
                                  >
                                    {i + 1}
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Code Display with Syntax Highlighting */}
                            <div
                              className={`relative min-h-full ${
                                generatedCode ? "pl-16" : ""
                              }`}
                            >
                              <pre className="w-full p-4 m-0">
                                <code
                                  className="font-mono text-sm leading-6 block"
                                  style={{
                                    color: "#c9d1d9",
                                    tabSize: 2,
                                  }}
                                >
                                  {generatedCode ? (
                                    generatedCode.split("\n").map((line, i) => (
                                      <div
                                        key={i}
                                        className="whitespace-pre hover:bg-gray-800/30"
                                        style={{ minHeight: "1.5rem" }}
                                      >
                                        {highlightCode(line, codeLanguage)}
                                      </div>
                                    ))
                                  ) : (
                                    <span className="text-gray-600">
                                      {`// Your generated code will appear here...
//
// Example output:
function greet(name) {
  return \`Hello, \${name}!\`;
}`}
                                    </span>
                                  )}
                                </code>
                              </pre>
                              {/* Hidden textarea for editing */}
                              {generatedCode && (
                                <textarea
                                  value={generatedCode}
                                  onChange={(e) =>
                                    setGeneratedCode(e.target.value)
                                  }
                                  className="absolute top-0 left-0 w-full h-full opacity-0 cursor-text font-mono text-sm leading-6 p-4 pl-16 resize-none bg-transparent selection:bg-blue-500/30 selection:text-white"
                                  style={{ caretColor: "white" }}
                                  spellCheck={false}
                                  onFocus={(e) => {
                                    e.currentTarget.style.opacity = "0.05";
                                    e.currentTarget.style.background =
                                      "rgba(255,255,255,0.1)";
                                  }}
                                  onBlur={(e) => {
                                    e.currentTarget.style.opacity = "0";
                                    e.currentTarget.style.background =
                                      "transparent";
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {generatedCode && (
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                        <p className="text-blue-300 text-sm">
                          💡 <strong>Tip:</strong> You can edit the generated
                          code directly in the output area. Copy it when you're
                          ready!
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Other Generation Mode */}
              {generationType === "other" && (
                <div className="space-y-6 w-full px-4">
                  {/* Feature Selection */}
                  {!selectedOtherFeature && (
                    <div className="space-y-6">
                      <div className="text-center">
                        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                          More AI Tools
                        </h2>
                        <p className="text-gray-400">
                          Choose a feature to get started
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Audio Generation - Pro */}
                        <div className="bg-black/50 border border-white/10 rounded-xl p-6 cursor-not-allowed opacity-75 text-left relative overflow-hidden">
                          <div className="absolute top-3 right-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                            PRO
                          </div>
                          <div className="w-12 h-12 mb-4 rounded-full bg-purple-500/20 flex items-center justify-center">
                            <svg
                              className="w-6 h-6 text-purple-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                              />
                            </svg>
                          </div>
                          <h3 className="text-white font-semibold text-lg mb-2">
                            Audio Generation
                          </h3>
                          <p className="text-gray-500 text-sm">
                            Generate AI voices, music, and sound effects
                          </p>
                        </div>

                        {/* Video Generation - Pro */}
                        <div className="bg-black/50 border border-white/10 rounded-xl p-6 cursor-not-allowed opacity-75 text-left relative overflow-hidden">
                          <div className="absolute top-3 right-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                            PRO
                          </div>
                          <div className="w-12 h-12 mb-4 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <svg
                              className="w-6 h-6 text-blue-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                          </div>
                          <h3 className="text-white font-semibold text-lg mb-2">
                            Video Generation
                          </h3>
                          <p className="text-gray-500 text-sm">
                            Create AI-powered videos and animations
                          </p>
                        </div>

                        {/* Data Analysis - Pro */}
                        <div className="bg-black/50 border border-white/10 rounded-xl p-6 cursor-not-allowed opacity-75 text-left relative overflow-hidden">
                          <div className="absolute top-3 right-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                            PRO
                          </div>
                          <div className="w-12 h-12 mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                            <svg
                              className="w-6 h-6 text-red-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                              />
                            </svg>
                          </div>
                          <h3 className="text-white font-semibold text-lg mb-2">
                            Data Analysis
                          </h3>
                          <p className="text-gray-500 text-sm">
                            Analyze data with AI-powered insights
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="mt-8 border-t border-white/10 pt-5 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-white/60">
                <a
                  href="https://v0.dev/chat/template-link-here"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white/80 transition-colors flex items-center gap-1"
                >
                  Make this app your own
                </a>
                <span className="text-white/20 hidden sm:inline">•</span>
                <button
                  onClick={() => setShowHowItWorks(true)}
                  className="hover:text-white/80 transition-colors"
                >
                  How it works
                </button>
                <span className="text-white/20 hidden sm:inline">•</span>
                <a
                  href="https://x.com/estebansuarez"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white/80 transition-colors flex items-center gap-1"
                >
                  Feedback?
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <HowItWorksModal open={showHowItWorks} onOpenChange={setShowHowItWorks} />

      {/* AI Model Selection Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setShowAiModal(false)}
          />

          {/* Modal */}
          <div className="relative bg-gradient-to-br from-gray-900 to-black border border-teal-500/30 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
            {/* Animated gradient border effect */}
            <div className="absolute inset-0 bg-linear-to-r from-teal-500/10 via-cyan-500/10 to-teal-500/10 animate-pulse pointer-events-none" />

            {/* Content */}
            <div className="relative p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-teal-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      Select AI Model
                    </h3>
                    <p className="text-xs text-gray-400">
                      Choose your preferred AI model
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAiModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* AI Models Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-2">
                {/* Gemini 2.5 Flash */}
                <button
                  onClick={() => {
                    if (availableKeys.gemini) {
                      setSelectedAiModel("Gemini 2.5 Flash");
                      setShowAiModal(false);
                    }
                  }}
                  disabled={!availableKeys.gemini}
                  className={`text-left p-4 rounded-xl border-2 transition-all group relative ${
                    !availableKeys.gemini
                      ? "opacity-50 cursor-not-allowed bg-gray-900/50 border-gray-700"
                      : selectedAiModel === "Gemini 2.5 Flash"
                      ? "bg-teal-500/20 border-teal-500 shadow-lg shadow-teal-500/20"
                      : "bg-gray-800/50 border-gray-700 hover:border-teal-500/50 hover:bg-gray-800"
                  }`}
                >
                  {!availableKeys.gemini && (
                    <div className="absolute top-2 right-2 bg-red-500/20 border border-red-500/50 rounded px-2 py-0.5">
                      <span className="text-[10px] text-red-400 font-medium">
                        No API Key
                      </span>
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-sm">G</span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">
                          Gemini 2.5 Flash
                        </h4>
                        <p className="text-xs text-gray-400">Google AI</p>
                      </div>
                    </div>
                    {selectedAiModel === "Gemini 2.5 Flash" &&
                      availableKeys.gemini && (
                        <svg
                          className="w-5 h-5 text-teal-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                  </div>
                  <p className="text-xs text-gray-300 mb-2">
                    Fast, efficient multimodal AI for images, text, and code
                    generation.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-[10px] px-2 py-0.5 bg-teal-500/20 text-teal-300 rounded-full">
                      Image Gen
                    </span>
                    <span className="text-[10px] px-2 py-0.5 bg-teal-500/20 text-teal-300 rounded-full">
                      Text Gen
                    </span>
                    <span className="text-[10px] px-2 py-0.5 bg-teal-500/20 text-teal-300 rounded-full">
                      Code Gen
                    </span>
                  </div>
                </button>

                {/* GPT-4 */}
                <button
                  onClick={() => {
                    if (availableKeys.openai) {
                      setSelectedAiModel("GPT-4 Turbo");
                      setShowAiModal(false);
                    }
                  }}
                  disabled={!availableKeys.openai}
                  className={`text-left p-4 rounded-xl border-2 transition-all group relative ${
                    !availableKeys.openai
                      ? "opacity-50 cursor-not-allowed bg-gray-900/50 border-gray-700"
                      : selectedAiModel === "GPT-4 Turbo"
                      ? "bg-green-500/20 border-green-500 shadow-lg shadow-green-500/20"
                      : "bg-gray-800/50 border-gray-700 hover:border-green-500/50 hover:bg-gray-800"
                  }`}
                >
                  {!availableKeys.openai && (
                    <div className="absolute top-2 right-2 bg-red-500/20 border border-red-500/50 rounded px-2 py-0.5">
                      <span className="text-[10px] text-red-400 font-medium">
                        No API Key
                      </span>
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-sm">4</span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">
                          GPT-4 Turbo
                        </h4>
                        <p className="text-xs text-gray-400">OpenAI</p>
                      </div>
                    </div>
                    {selectedAiModel === "GPT-4 Turbo" &&
                      availableKeys.openai && (
                        <svg
                          className="w-5 h-5 text-green-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                  </div>
                  <p className="text-xs text-gray-300 mb-2">
                    Advanced reasoning and comprehensive knowledge for complex
                    tasks.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-[10px] px-2 py-0.5 bg-green-500/20 text-green-300 rounded-full">
                      Text Gen
                    </span>
                    <span className="text-[10px] px-2 py-0.5 bg-green-500/20 text-green-300 rounded-full">
                      Code Gen
                    </span>
                  </div>
                </button>

                {/* Claude 3.5 Sonnet */}
                <button
                  onClick={() => {
                    if (availableKeys.claude) {
                      setSelectedAiModel("Claude 3.5 Sonnet");
                      setShowAiModal(false);
                    }
                  }}
                  disabled={!availableKeys.claude}
                  className={`text-left p-4 rounded-xl border-2 transition-all group relative ${
                    !availableKeys.claude
                      ? "opacity-50 cursor-not-allowed bg-gray-900/50 border-gray-700"
                      : selectedAiModel === "Claude 3.5 Sonnet"
                      ? "bg-purple-500/20 border-purple-500 shadow-lg shadow-purple-500/20"
                      : "bg-gray-800/50 border-gray-700 hover:border-purple-500/50 hover:bg-gray-800"
                  }`}
                >
                  {!availableKeys.claude && (
                    <div className="absolute top-2 right-2 bg-red-500/20 border border-red-500/50 rounded px-2 py-0.5">
                      <span className="text-[10px] text-red-400 font-medium">
                        No API Key
                      </span>
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-500 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-sm">C</span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">
                          Claude 3.5 Sonnet
                        </h4>
                        <p className="text-xs text-gray-400">Anthropic</p>
                      </div>
                    </div>
                    {selectedAiModel === "Claude 3.5 Sonnet" &&
                      availableKeys.claude && (
                        <svg
                          className="w-5 h-5 text-purple-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                  </div>
                  <p className="text-xs text-gray-300 mb-2">
                    Balanced performance with strong reasoning and creative
                    capabilities.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-[10px] px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full">
                      Text Gen
                    </span>
                    <span className="text-[10px] px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full">
                      Code Gen
                    </span>
                  </div>
                </button>

                {/* DALL-E 3 */}
                <button
                  onClick={() => {
                    if (availableKeys.dalle) {
                      setSelectedAiModel("DALL-E 3");
                      setShowAiModal(false);
                    }
                  }}
                  disabled={!availableKeys.dalle}
                  className={`text-left p-4 rounded-xl border-2 transition-all group relative ${
                    !availableKeys.dalle
                      ? "opacity-50 cursor-not-allowed bg-gray-900/50 border-gray-700"
                      : selectedAiModel === "DALL-E 3"
                      ? "bg-blue-500/20 border-blue-500 shadow-lg shadow-blue-500/20"
                      : "bg-gray-800/50 border-gray-700 hover:border-blue-500/50 hover:bg-gray-800"
                  }`}
                >
                  {!availableKeys.dalle && (
                    <div className="absolute top-2 right-2 bg-red-500/20 border border-red-500/50 rounded px-2 py-0.5">
                      <span className="text-[10px] text-red-400 font-medium">
                        No API Key
                      </span>
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-sm">D</span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">DALL-E 3</h4>
                        <p className="text-xs text-gray-400">OpenAI</p>
                      </div>
                    </div>
                    {selectedAiModel === "DALL-E 3" && availableKeys.dalle && (
                      <svg
                        className="w-5 h-5 text-blue-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  <p className="text-xs text-gray-300 mb-2">
                    Creative image generation with precise prompt following.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-[10px] px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full">
                      Image Gen
                    </span>
                  </div>
                </button>

                {/* Llama 3.1 */}
                <button
                  onClick={() => {
                    if (availableKeys.llama) {
                      setSelectedAiModel("Llama 3.1 405B");
                      setShowAiModal(false);
                    }
                  }}
                  disabled={!availableKeys.llama}
                  className={`text-left p-4 rounded-xl border-2 transition-all group relative ${
                    !availableKeys.llama
                      ? "opacity-50 cursor-not-allowed bg-gray-900/50 border-gray-700"
                      : selectedAiModel === "Llama 3.1 405B"
                      ? "bg-orange-500/20 border-orange-500 shadow-lg shadow-orange-500/20"
                      : "bg-gray-800/50 border-gray-700 hover:border-orange-500/50 hover:bg-gray-800"
                  }`}
                >
                  {!availableKeys.llama && (
                    <div className="absolute top-2 right-2 bg-red-500/20 border border-red-500/50 rounded px-2 py-0.5">
                      <span className="text-[10px] text-red-400 font-medium">
                        No API Key
                      </span>
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-sm">L</span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">
                          Llama 3.1 405B
                        </h4>
                        <p className="text-xs text-gray-400">Meta</p>
                      </div>
                    </div>
                    {selectedAiModel === "Llama 3.1 405B" &&
                      availableKeys.llama && (
                        <svg
                          className="w-5 h-5 text-orange-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                  </div>
                  <p className="text-xs text-gray-300 mb-2">
                    Open-source powerhouse with exceptional multilingual
                    capabilities.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-[10px] px-2 py-0.5 bg-orange-500/20 text-orange-300 rounded-full">
                      Text Gen
                    </span>
                    <span className="text-[10px] px-2 py-0.5 bg-orange-500/20 text-orange-300 rounded-full">
                      Code Gen
                    </span>
                  </div>
                </button>

                {/* Stable Diffusion XL */}
                <button
                  onClick={() => {
                    if (availableKeys.stability) {
                      setSelectedAiModel("Stable Diffusion XL");
                      setShowAiModal(false);
                    }
                  }}
                  disabled={!availableKeys.stability}
                  className={`text-left p-4 rounded-xl border-2 transition-all group relative ${
                    !availableKeys.stability
                      ? "opacity-50 cursor-not-allowed bg-gray-900/50 border-gray-700"
                      : selectedAiModel === "Stable Diffusion XL"
                      ? "bg-pink-500/20 border-pink-500 shadow-lg shadow-pink-500/20"
                      : "bg-gray-800/50 border-gray-700 hover:border-pink-500/50 hover:bg-gray-800"
                  }`}
                >
                  {!availableKeys.stability && (
                    <div className="absolute top-2 right-2 bg-red-500/20 border border-red-500/50 rounded px-2 py-0.5">
                      <span className="text-[10px] text-red-400 font-medium">
                        No API Key
                      </span>
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-pink-400 to-rose-500 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-sm">S</span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">
                          Stable Diffusion XL
                        </h4>
                        <p className="text-xs text-gray-400">Stability AI</p>
                      </div>
                    </div>
                    {selectedAiModel === "Stable Diffusion XL" &&
                      availableKeys.stability && (
                        <svg
                          className="w-5 h-5 text-pink-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                  </div>
                  <p className="text-xs text-gray-300 mb-2">
                    High-quality open-source image generation with fine control.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-[10px] px-2 py-0.5 bg-pink-500/20 text-pink-300 rounded-full">
                      Image Gen
                    </span>
                  </div>
                </button>
              </div>

              {/* Footer Info */}
              <div className="mt-6 p-3 bg-teal-500/10 border border-teal-500/30 rounded-lg">
                <p className="text-xs text-teal-300 flex items-start gap-2">
                  <svg
                    className="w-4 h-4 shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>
                    Model selection affects capabilities across different tabs.
                    Some models specialize in specific tasks like image
                    generation or code writing.
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Language Conversion Modal */}
      {showConversionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={cancelLanguageConversion}
          />

          {/* Modal */}
          <div className="relative bg-gradient-to-br from-gray-900 to-gray-950 border border-yellow-500/30 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
            {/* Animated gradient border effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-yellow-500/20 animate-pulse" />

            {/* Content */}
            <div className="relative p-6 space-y-4">
              {/* Icon with animation */}
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-yellow-500/30 rounded-full blur-xl animate-pulse" />
                  <div className="relative w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                    <svg
                      className="w-8 h-8 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Title */}
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-white">
                  Convert Code Language?
                </h3>
                <p className="text-gray-400 text-sm">
                  Transform your existing{" "}
                  <span className="text-yellow-400 font-semibold">
                    {codeLanguage}
                  </span>{" "}
                  code to{" "}
                  <span className="text-orange-400 font-semibold">
                    {pendingLanguage}
                  </span>
                </p>
              </div>

              {/* Info box */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="flex-1">
                  <p className="text-blue-300 text-xs">
                    AI will intelligently convert your code while preserving
                    functionality and applying language-specific best practices.
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={cancelLanguageConversion}
                  className="flex-1 px-4 py-2.5 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 text-gray-300 rounded-lg font-medium transition-all duration-200 hover:scale-105"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmLanguageConversion}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white rounded-lg font-semibold shadow-lg shadow-yellow-500/30 transition-all duration-200 hover:scale-105 flex items-center justify-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Convert Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFullscreen && fullscreenImageUrl && (
        <FullscreenViewer
          imageUrl={fullscreenImageUrl}
          generations={persistedGenerations}
          onClose={closeFullscreen}
          onNavigate={handleFullscreenNavigate}
        />
      )}
    </div>
  );
}

export default ImageCombiner;
