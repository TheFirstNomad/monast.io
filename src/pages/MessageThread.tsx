import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { AuthResolving } from "@/components/AuthResolving";
import { toast } from "sonner";

interface Msg {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
}

const MessageThread = () => {
  const { adId, otherId } = useParams();
  const { user, resolving } = useRequireAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [ad, setAd] = useState<{ title: string; images: string[] } | null>(null);
  const [otherName, setOtherName] = useState("User");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !adId || !otherId) return;

    supabase
      .from("messages")
      .select("*")
      .eq("ad_id", adId)
      .or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${user.id})`,
      )
      .order("created_at")
      .then(({ data }) => setMessages((data as Msg[]) || []));

    supabase
      .from("ads")
      .select("title,images")
      .eq("id", adId)
      .maybeSingle()
      .then(({ data }) => setAd(data as any));

    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", otherId)
      .maybeSingle()
      .then(({ data }) => setOtherName((data as any)?.display_name || "User"));

    const ch = supabase
      .channel(`thread-${adId}-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `ad_id=eq.${adId}` },
        (p) => {
          const m = p.new as Msg;
          const mine = m.sender_id === user.id && m.recipient_id === otherId;
          const theirs = m.sender_id === otherId && m.recipient_id === user.id;
          if (mine || theirs) {
            setMessages((prev) => (prev.find((x) => x.id === m.id) ? prev : [...prev, m]));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, adId, otherId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!user || !adId || !otherId || !text.trim()) return;
    const content = text.trim();
    setText("");
    const { error } = await supabase
      .from("messages")
      .insert({ ad_id: adId, sender_id: user.id, recipient_id: otherId, content });
    if (error) toast.error(error.message);
  };

  if (resolving) return <AuthResolving />;
  if (!user) return null;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <Link
            to="/messages"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" /> All messages
          </Link>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col h-[70vh]">
          <div className="flex items-center gap-3 p-3 border-b border-border">
            <img
              src={ad?.images?.[0] || "/placeholder.svg"}
              alt=""
              className="w-10 h-10 rounded-lg object-cover bg-secondary"
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground truncate">{otherName}</div>
              <Link to={`/ad/${adId}`} className="text-xs text-primary hover:underline truncate block">
                {ad?.title || "View listing"}
              </Link>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {messages.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-8">No messages yet</p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.sender_id === user.id ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    m.sender_id === user.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <p className="px-4 pb-1 text-[11px] text-muted-foreground">
            Messages are permanent. Neither side can delete them, so this thread works as proof of what
            was agreed and delivered.
          </p>
          <div className="p-3 border-t border-border flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Type a message..."
            />
            <Button onClick={send} size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default MessageThread;
