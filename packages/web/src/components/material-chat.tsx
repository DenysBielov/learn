"use client";

import { useState, useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ChatMessage } from "./chat/chat-message";
import { ChatInput } from "./chat/chat-input";
import { getMaterialConversation } from "@/app/actions/chat";
import { createApiToken } from "@/app/actions/settings";
import { Lightbulb, GraduationCap, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MaterialChatProps {
  materialId: number;
  onNewMessage?: () => void;
}

export function MaterialChat({ materialId, onNewMessage }: MaterialChatProps) {
  const [chatMode, setChatMode] = useState<"explain" | "educate">("explain");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [needsApiKey, setNeedsApiKey] = useState(false);
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [isSavingKey, setIsSavingKey] = useState(false);
  const lastMsgRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef(0);

  const { messages, sendMessage, status, setMessages, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/material-chat",
    }),
    onFinish: ({ message }) => {
      if (message.role === "assistant") {
        onNewMessage?.();
      }
    },
  });

  // Detect missing API key from chat errors (403 response)
  useEffect(() => {
    if (error && (error.message?.includes("API key") || ("statusCode" in error && (error as any).statusCode === 403))) {
      setNeedsApiKey(true);
    }
  }, [error]);

  async function handleSaveApiKey() {
    if (!apiKeyValue.trim()) return;
    setIsSavingKey(true);
    try {
      await createApiToken("gemini", "Gemini", apiKeyValue.trim());
      setNeedsApiKey(false);
      setApiKeyValue("");
    } finally {
      setIsSavingKey(false);
    }
  }

  const isLoading = status === "streaming" || status === "submitted";

  // Load existing material conversation on mount
  useEffect(() => {
    if (initialLoaded) return;

    const load = async () => {
      const data = await getMaterialConversation(materialId);
      setConversationId(data.conversationId);

      if (data.messages.length > 0) {
        const uiMessages = data.messages.map((m) => ({
          id: String(m.id),
          role: m.role as "user" | "assistant",
          content: m.content ?? "",
          parts: [
            ...(m.content ? [{ type: "text" as const, text: m.content }] : []),
          ],
          createdAt: m.createdAt,
        }));
        setMessages(uiMessages);
      }
      setInitialLoaded(true);
    };
    load();
  }, [initialLoaded, materialId, setMessages]);

  // Scroll to new messages
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      lastMsgRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length]);

  const handleSend = async (text: string, imageBase64?: string) => {
    await sendMessage(
      { text },
      {
        body: {
          conversationId,
          materialId,
          imageBase64,
          chatMode,
        },
      }
    );

    if (!conversationId) {
      const data = await getMaterialConversation(materialId);
      setConversationId(data.conversationId);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {needsApiKey && (
          <div className="mx-auto max-w-xs space-y-3 py-8 text-center">
            <Key className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Add your Gemini API key to use the AI chat.
            </p>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Gemini API key"
                value={apiKeyValue}
                onChange={(e) => setApiKeyValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveApiKey()}
                className="text-xs"
              />
              <Button size="sm" onClick={handleSaveApiKey} disabled={isSavingKey || !apiKeyValue.trim()}>
                {isSavingKey ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        )}
        {messages.length === 0 && !needsApiKey && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            Ask a question about this material
          </p>
        )}
        {messages.map((msg, i) => {
          const textContent =
            msg.parts
              ?.filter(
                (p): p is { type: "text"; text: string } => p.type === "text"
              )
              .map((p) => p.text)
              .join("") ?? "";

          const sources = msg.parts
            ?.filter((p) => p.type === "source-url")
            .map((p) => ({
              url: (p as any).url as string,
              title: (p as any).title as string | undefined,
            }));

          const isLast = i === messages.length - 1;
          return (
            <div key={msg.id} ref={isLast ? lastMsgRef : undefined}>
              <ChatMessage
                role={msg.role as "user" | "assistant"}
                content={textContent}
                sources={sources}
              />
            </div>
          );
        })}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              Thinking...
            </div>
          </div>
        )}
      </div>

      {/* Mode toggle + Input */}
      <div className="border-t px-3 pt-2 pb-3 space-y-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setChatMode("explain")}
            className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-colors ${
              chatMode === "explain"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <Lightbulb className="h-3 w-3" />
            Explain
          </button>
          <button
            type="button"
            onClick={() => setChatMode("educate")}
            className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-colors ${
              chatMode === "educate"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <GraduationCap className="h-3 w-3" />
            Educate
          </button>
        </div>
        <ChatInput onSend={handleSend} disabled={isLoading || needsApiKey} />
      </div>
    </div>
  );
}
