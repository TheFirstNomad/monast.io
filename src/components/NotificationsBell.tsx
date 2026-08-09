import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

export const NotificationsBell = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<NotificationRow[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setRows((data as NotificationRow[]) ?? []);
  };

  useEffect(() => {
    if (!user) { setRows([]); return; }
    load();
    const channel = supabase
      .channel(`notifications-feed-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => setRows((prev) => [payload.new as NotificationRow, ...prev].slice(0, 20)),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (!user) return null;

  const unread = rows.filter((r) => !r.read).length;

  const markAllRead = async () => {
    if (unread === 0) return;
    setRows((prev) => prev.map((r) => ({ ...r, read: true })));
    await supabase.from("notifications").update({ read: true }).eq("read", false);
  };

  return (
    <DropdownMenu onOpenChange={(open) => { if (open) markAllRead(); }}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <div className="px-3 py-2 text-sm font-semibold border-b border-border">Notifications</div>
        {rows.length === 0 && (
          <div className="px-3 py-6 text-sm text-muted-foreground text-center">
            Nothing yet — offers, messages and escrow updates land here.
          </div>
        )}
        {rows.map((n) => {
          const inner = (
            <div className="px-3 py-2.5 hover:bg-accent/50 transition-colors">
              <div className="text-sm font-medium text-foreground">{n.title}</div>
              {n.body && <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>}
              <div className="text-[11px] text-muted-foreground/70 mt-1">
                {new Date(n.created_at).toLocaleString()}
              </div>
            </div>
          );
          return n.link ? (
            <Link key={n.id} to={n.link} className="block">{inner}</Link>
          ) : (
            <div key={n.id}>{inner}</div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
