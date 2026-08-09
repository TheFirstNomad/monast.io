import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Msg {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  adId: string;
  sellerId: string;
  adTitle: string;
}

export const ChatDialog = ({ open, onOpenChange, adId, sellerId, adTitle }: Props) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !user) return;
    supabase
      .from("messages")
      .select("*")
      .eq("ad_id", adId)
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${sellerId}),and(sender_id.eq.${sellerId},recipient_id.eq.${user.id})`)
      .order("created_at")
      .then(({ data }) => setMessages((data as Msg[]) || []));

    const ch = supabase
      .channel(`chat-${adId}-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `ad_id=eq.${adId}` }, (p) => {
        const m = p.new as Msg;
        if ((m.sender_id === user.id && m.recipient_id === sellerId) || (m.sender_id === sellerId && m.recipient_id === user.id)) {
          setMessages((prev) => (prev.find((x) => x.id === m.id) ? prev : [...prev, m]));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [open, user, adId, sellerId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!user || !text.trim()) return;
    const content = text.trim();
    setText("");
    const { error } = await supabase.from("messages").insert({
      ad_id: adId, sender_id: user.id, recipient_id: sellerId, content,
    });
    if (error) toast.error(error.message);
  };

  if (!user) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader><DialogTitle>Sign in to chat</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Please sign in to message the seller.</p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 h-[80vh] flex flex-col">
        <DialogHeader className="p-4 border-b border-border">
          <DialogTitle className="truncate text-sm">{adTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.length === 0 && <p className="text-center text-xs text-muted-foreground py-8">Say hi to the seller</p>}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender_id === user.id ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.sender_id === user.id ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                {m.content}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <p className="px-4 pb-1 text-[11px] text-muted-foreground">
          Messages are permanent — neither side can delete them, so this thread works as proof of
          what was agreed and delivered.
        </p>
        <div className="p-3 border-t border-border flex gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type a message..." />
          <Button onClick={send} size="icon"><Send className="w-4 h-4" /></Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
