import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";
import { WalletNetworkCard } from "@/components/WalletNetworkCard";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { AuthResolving } from "@/components/AuthResolving";
import { useSeo } from "@/hooks/useSeo";
import { toast } from "sonner";

const MAX_BIO = 500;

const Settings = () => {
  useSeo({
    title: "monast.io | Profile settings",
    description: "Update your monast.io seller profile, display name, bio and avatar.",
    noindex: true,
  });

  const { user, resolving } = useRequireAuth();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [wallet, setWallet] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);


  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, bio, avatar_url, wallet_address")
        .eq("id", user.id)
        .maybeSingle();
      setDisplayName(data?.display_name ?? "");
      setBio(data?.bio ?? "");
      setAvatarUrl(data?.avatar_url ?? "");
      setWallet(data?.wallet_address ?? null);
      setFetching(false);
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    const name = displayName.trim();
    if (name.length < 2) {
      toast.error("Display name must be at least 2 characters");
      return;
    }
    if (bio.length > MAX_BIO) {
      toast.error(`Bio must be under ${MAX_BIO} characters`);
      return;
    }
    if (avatarUrl && !/^https:\/\//i.test(avatarUrl.trim())) {
      toast.error("Avatar URL must start with https://");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: name,
        bio: bio.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      })
      .eq("id", user.id);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile updated");
  };

  if (resolving) return <AuthResolving />;
  if (!user) return null;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-1">Profile settings</h1>
        <p className="text-sm text-muted-foreground mb-8">
          This is what buyers and sellers see on your listings.
        </p>

        {fetching ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading your profile…
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/20 overflow-hidden flex items-center justify-center shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={`${displayName || "Seller"} avatar`} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-primary font-bold text-xl">
                    {(displayName || user.email || "U").charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{displayName || "Unnamed seller"}</div>
                <div className="text-xs text-muted-foreground truncate">{user.email}</div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                value={displayName}
                maxLength={60}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How buyers see you"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                rows={4}
                maxLength={MAX_BIO}
                onChange={(e) => setBio(e.target.value)}
                placeholder="What do you sell? Where do you ship?"
              />
              <p className="text-xs text-muted-foreground text-right">
                {bio.length}/{MAX_BIO}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatarUrl">Avatar image URL</Label>
              <Input
                id="avatarUrl"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>

            <WalletNetworkCard
              userId={user.id}
              payoutWallet={wallet}
              onPayoutWalletChange={setWallet}
            />

            <Button onClick={save} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save changes
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Settings;
