import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputFooter,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { getChatDraft, getChatHistory, getDay, getProfile, saveChatDraft } from "@/lib/gymie.functions";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Gymie Chat — log meals by talking" },
      {
        name: "description",
        content: "Type what you ate in Bangla or English and Gymie logs calories and macros instantly.",
      },
      { property: "og:title", content: "Gymie Chat" },
      { property: "og:description", content: "Log Bangladeshi meals by chatting — no forms." },
    ],
  }),
  component: ChatPage,
});

const QUICK = [
  "Ek plate bhat, dal ar rui mach kheyechi",
  "2 eggs, 2 toast and black coffee",
  "Drank 500ml water",
  "What should I eat to hit my protein?",
];

function ChatPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getProfile);
  const fetchHistory = useServerFn(getChatHistory);
  const fetchDay = useServerFn(getDay);
  const fetchDraft = useServerFn(getChatDraft);
  const persistDraft = useServerFn(saveChatDraft);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile({}) });
  const { data: history, isLoading } = useQuery({
    queryKey: ["chat-history"],
    queryFn: () => fetchHistory({}),
  });
  const { data: day } = useQuery({ queryKey: ["day"], queryFn: () => fetchDay({ data: {} }) });

  useEffect(() => {
    if (profile && !profile.onboarded) navigate({ to: "/onboarding", replace: true });
  }, [profile, navigate]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: async (input, init) => {
          const { data } = await supabase.auth.getSession();
          const headers = new Headers(init?.headers);
          if (data.session?.access_token) {
            headers.set("Authorization", `Bearer ${data.session.access_token}`);
          }
          return fetch(input, { ...init, headers });
        },
      }),
    [],
  );

  const initialMessages: UIMessage[] = useMemo(
    () =>
      (history ?? []).map((row) => ({
        id: row.id as string,
        role: (row.role === "assistant" ? "assistant" : "user") as UIMessage["role"],
        parts: [{ type: "text" as const, text: row.content as string }],
      })),
    [history],
  );

  const draftKey = profile?.id ? `gymie:chat-draft:${profile.id}` : "gymie:chat-draft";
  const [input, setInput] = useState("");
  const draftLoadedFor = useRef<string | null>(null);

  const localStampKey = `${draftKey}:at`;
  const [draftState, setDraftState] = useState<"idle" | "saving" | "saved" | "local">("idle");

  // Load the draft: cloud copy vs local copy, newest wins.
  const { data: cloudDraft } = useQuery({
    queryKey: ["chat-draft"],
    queryFn: () => fetchDraft({}),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!profile?.id || cloudDraft === undefined) return;
    if (draftLoadedFor.current === draftKey) return;
    draftLoadedFor.current = draftKey;

    const local =
      window.localStorage.getItem(draftKey) ?? window.localStorage.getItem("gymie:chat-draft");
    const localAt = Number(window.localStorage.getItem(localStampKey) ?? 0);
    const cloudAt = cloudDraft?.updated_at ? new Date(cloudDraft.updated_at).getTime() : 0;
    const winner = cloudAt >= localAt ? (cloudDraft?.content ?? local) : (local ?? cloudDraft?.content);

    if (winner) {
      setInput(winner);
      setDraftState("saved");
      textareaRef.current?.focus();
    }
  }, [draftKey, localStampKey, cloudDraft, profile?.id]);

  // Save instantly on device, then sync to the cloud (debounced).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (draftLoadedFor.current !== draftKey) return;

    if (input.trim()) {
      window.localStorage.setItem(draftKey, input);
      window.localStorage.setItem(localStampKey, String(Date.now()));
    } else {
      window.localStorage.removeItem(draftKey);
      window.localStorage.removeItem(localStampKey);
    }

    if (input === (cloudDraft?.content ?? "")) return;
    setDraftState("saving");
    const timer = window.setTimeout(() => {
      void persistDraft({ data: { content: input } })
        .then(() => setDraftState("saved"))
        .catch(() => setDraftState("local"));
    }, 800);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, draftKey, localStampKey]);


  const { messages, sendMessage, status, setMessages, stop } = useChat({
    transport,
    onError: (error) => toast.error(error.message || "Gymie couldn't respond. Try again."),
    onFinish: () => {
      void queryClient.invalidateQueries({ queryKey: ["day"] });
      void queryClient.invalidateQueries({ queryKey: ["history"] });
      textareaRef.current?.focus();
    },
  });

  useEffect(() => {
    if (!isLoading && initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, initialMessages]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const busy = status === "submitted" || status === "streaming";

  const remaining = day && profile?.target_calories
    ? Math.round(profile.target_calories - day.totals.calories)
    : null;
  const proteinLeft = day && profile?.target_protein_g
    ? Math.round(profile.target_protein_g - day.totals.protein)
    : null;

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    setInput("");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(draftKey);
      window.localStorage.removeItem(localStampKey);
      window.localStorage.removeItem("gymie:chat-draft");
    }
    setDraftState("idle");
    void persistDraft({ data: { content: "" } })
      .then(() => queryClient.setQueryData(["chat-draft"], { content: "", updated_at: new Date().toISOString() }))
      .catch(() => undefined);
    void sendMessage({ text: text.trim() });
    textareaRef.current?.focus();
  };

  return (
    <AppShell>
      <div className="flex h-[calc(100dvh-9.5rem)] flex-col pt-3 sm:h-[calc(100dvh-8rem)] sm:pt-4">
        {day && (
          <div className="glass mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-2xl px-4 py-2.5 text-xs">
            <span className="text-muted-foreground">
              Today: <span className="font-semibold text-foreground">{Math.round(day.totals.calories)}</span>{" "}
              kcal · {Math.round(day.totals.protein)}g protein
            </span>
            {remaining !== null && (
              <span className="text-muted-foreground">
                {remaining > 0 ? `${remaining} kcal left` : `${Math.abs(remaining)} kcal over`}
              </span>
            )}
          </div>
        )}

        <Conversation className="flex-1">
          <ConversationContent className="space-y-4">
            {messages.length === 0 && !isLoading && (
              <div className="py-10 text-center">
                <h1 className="text-2xl font-semibold tracking-tight">
                  Hey {profile?.name || "there"} — what did you eat?
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Bangla, English or Banglish. Gymie handles portions like “ek plate bhat”.
                </p>
              </div>
            )}

            {messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.parts.map((part, index) =>
                    part.type === "text" ? (
                      <MessageResponse key={index}>{part.text}</MessageResponse>
                    ) : null,
                  )}
                </MessageContent>
              </Message>
            ))}

            {status === "submitted" && <Shimmer>Gymie is working it out…</Shimmer>}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="-mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {(proteinLeft !== null && proteinLeft > 20
            ? [`I need ${proteinLeft}g more protein — what should I eat?`, ...QUICK.slice(0, 3)]
            : QUICK
          ).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => send(suggestion)}
              className="glass shrink-0 rounded-full px-3 py-1.5 text-xs whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground sm:whitespace-normal"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <PromptInput
          className="mt-3"
          onSubmit={(message, event) => {
            event.preventDefault();
            send(message.text ?? input);
          }}
        >
          <PromptInputTextarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.currentTarget.value)}
            placeholder="Ki kheyechen? e.g. dupure ek plate bhat ar murgir mangsho…"
          />
          <PromptInputFooter className="justify-between gap-2">
            <span className="truncate text-[11px] text-muted-foreground">
              {draftState === "saving"
                ? "Saving…"
                : draftState === "saved"
                  ? "Draft saved"
                  : draftState === "local"
                    ? "Saved on device (offline)"
                    : ""}
            </span>
            <PromptInputSubmit
              status={status}
              disabled={status === "ready" && !input.trim()}
              onStop={stop}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </AppShell>
  );
}
