"use client";
import { MessageThreadFull } from "@/components/tambo/message-thread-full";
import { components, tools } from "@/lib/tambo/tambo";
import { TamboProvider } from "@tambo-ai/react";
import "./tambo-styles.css";
import Link from "next/link";

export default function TamboPage() {
  return (
    <div className="flex flex-col gap-8 items-center min-h-screen py-8 px-4 max-w-3xl mx-auto">
      <TamboProvider
        apiKey={process.env.NEXT_PUBLIC_TAMBO_API_KEY!}
        components={components}
        tools={tools}
      >
        <div className="p-4 w-full tambo-theme">
          <BackButton />
          <MessageThreadFull />
        </div>
      </TamboProvider>
    </div>
  );
}

function BackButton() {
  return (
    <Link
      href="/"
      className="absolute top-3 left-[80px] text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-md hover:bg-gray-200 hover:text-gray-700 cursor-pointer"
    >
      &larr; Back to homepage
    </Link>
  );
}
