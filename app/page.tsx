import { ImageCombiner } from "@/components/image-combiner";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nano Banana Pro - Free AI Creative Playground",
  description:
    "Nano Banana Pro is your go-to AI creative tool. Create stunning images from text, edit existing images with AI, generate code, and explore multiple AI features.",
};

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <ImageCombiner />
    </main>
  );
}
