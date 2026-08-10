import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { categories, conditions } from "@/lib/types";
import { extraFieldsFor } from "@/lib/categoryFields";
import { Camera, X, Save, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { AuthResolving } from "@/components/AuthResolving";
import { supabase } from "@/integrations/supabase/client";

const OPEN_ESCROW_STATUSES = ["created", "funded", "disputed"];

const EditAd = () => {
  const { toast } = useToast();
  const { id } = useParams();
  const { user, resolving } = useRequireAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [notMine, setNotMine] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  // An open escrow means a buyer already committed to this item at this price —
  // the name and price are locked so the deal can't be changed underneath them.
  const [lockedEscrowId, setLockedEscrowId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
    condition: "Used" as string,
    location: "",
  });
  const [extras, setExtras] = useState<Record<string, string>>({});
  const extraFields = extraFieldsFor(form.category);
  const locked = !!lockedEscrowId;

  useEffect(() => {
    if (!id || !user) return;
    let cancelled = false;
    (async () => {
      const { data: ad } = await supabase.from("ads").select("*").eq("id", id).maybeSingle();
      if (cancelled) return;
      if (!ad || ad.seller_id !== user.id) {
        setNotMine(true);
        setLoading(false);
        return;
      }
      setForm({
        title: ad.title,
        description: ad.description,
        price: String(ad.price_usdc),
        category: ad.category,
        condition: ad.condition,
        location: ad.location,
      });
      setImages(ad.images || []);
      setExtras(((ad as any).attributes as Record<string, string>) || {});

      const { data: escrow } = await supabase
        .from("escrows")
        .select("id")
        .eq("ad_id", id)
        .in("status", OPEN_ESCROW_STATUSES)
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setLockedEscrowId(escrow?.id ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  const MAX_FILE_BYTES = 5 * 1024 * 1024;
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !user) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of files.slice(0, 12 - images.length)) {
        if (!file.type.startsWith("image/")) {
          toast({ title: "Skipped", description: `${file.name} is not an image`, variant: "destructive" });
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          toast({ title: "Too large", description: `${file.name} exceeds 5 MB`, variant: "destructive" });
          continue;
        }
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("ad-photos").upload(path, file);
        if (error) throw error;
        const { data } = supabase.storage.from("ad-photos").getPublicUrl(path);
        uploaded.push(data.publicUrl);
      }
      if (uploaded.length) setImages([...images, ...uploaded]);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeImage = (index: number) => setImages(images.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;
    setSaving(true);
    try {
      // Re-check at save time so a stale page can't edit a locked field.
      const { data: live } = await supabase
        .from("escrows")
        .select("id")
        .eq("ad_id", id)
        .in("status", OPEN_ESCROW_STATUSES)
        .limit(1)
        .maybeSingle();
      setLockedEscrowId(live?.id ?? null);

      const patch: Record<string, unknown> = {
        description: form.description,
        category: form.category,
        condition: form.condition,
        location: form.location,
        images,
        attributes: Object.fromEntries(
          extraFields.map((f) => [f.key, (extras[f.key] || "").trim()]).filter(([, v]) => v),
        ),
      };
      if (!live) {
        patch.title = form.title;
        patch.price_usdc = Number(form.price);
      }

      const { error } = await supabase.from("ads").update(patch).eq("id", id);
      if (error) throw error;
      toast({
        title: "Ad updated",
        description: live ? "Name and price stayed locked by the active escrow." : undefined,
      });
      navigate(`/ad/${id}`);
    } catch (err: any) {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (resolving) return <AuthResolving />;
  if (!user) return null;

  if (loading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-20 text-center text-muted-foreground">Loading...</div>
      </Layout>
    );
  }

  if (notMine) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <h1 className="text-xl font-bold text-foreground mb-3">You can only edit your own listings</h1>
          <Link to="/dashboard" className="text-primary hover:underline">Back to dashboard</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">Edit Ad</h1>
        <p className="text-muted-foreground mb-6">Update your listing details.</p>

        {locked && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4">
            <Lock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              An active escrow exists on this listing, so the <strong className="text-foreground">item name</strong>{" "}
              and <strong className="text-foreground">price</strong> are locked. Everything else can still be edited.{" "}
              <Link to={`/escrow/${lockedEscrowId}`} className="text-primary hover:underline">
                View escrow
              </Link>
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Photos ({images.length}/12)
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {images.map((img, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center"
                  >
                    <X className="w-3 h-3 text-destructive-foreground" />
                  </button>
                </div>
              ))}
              {images.length < 12 && (
                <label className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer">
                  <Camera className="w-5 h-5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">{uploading ? "..." : "Add"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={uploading}
                  />
                </label>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Title {locked && <span className="text-xs text-muted-foreground">(locked by escrow)</span>}
            </label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              disabled={locked}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              required
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>

          {extraFields.length > 0 && (
            <div className="space-y-4 rounded-xl border border-border bg-secondary/30 p-4">
              <p className="text-xs text-muted-foreground">
                Extra details buyers expect for {form.category}.
              </p>
              {extraFields.map((f) => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{f.label}</label>
                  {f.multiline ? (
                    <Textarea
                      placeholder={f.placeholder}
                      rows={4}
                      required={f.required}
                      value={extras[f.key] || ""}
                      onChange={(e) => setExtras({ ...extras, [f.key]: e.target.value })}
                    />
                  ) : (
                    <Input
                      placeholder={f.placeholder}
                      required={f.required}
                      value={extras[f.key] || ""}
                      onChange={(e) => setExtras({ ...extras, [f.key]: e.target.value })}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Condition</label>
            <div className="flex gap-2">
              {conditions.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, condition: c })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    form.condition === c
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Price (USDC) {locked && <span className="text-xs text-muted-foreground">(locked by escrow)</span>}
            </label>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
                disabled={locked}
                className="pl-16"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-primary">USDC</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Location</label>
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={5}
              required
            />
          </div>

          <div className="flex gap-3">
            <Button type="submit" size="lg" className="flex-1 font-bold gap-2" disabled={saving || uploading}>
              <Save className="w-5 h-5" />
              {saving ? "Saving..." : "Save changes"}
            </Button>
            <Button type="button" size="lg" variant="outline" onClick={() => navigate(`/ad/${id}`)}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default EditAd;
