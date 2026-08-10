import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { categories, conditions } from "@/lib/types";
import { extraFieldsFor } from "@/lib/categoryFields";
import { Camera, X, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { AuthResolving } from "@/components/AuthResolving";
import { supabase } from "@/integrations/supabase/client";

const PostAd = () => {
  const { toast } = useToast();
  const { user, resolving } = useRequireAuth();
  const navigate = useNavigate();
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
    condition: "Used" as string,
    location: "",
  });
  // Category-specific answers (Apps, Crypto & NFTs). Saved on the ad as `attributes`.
  const [extras, setExtras] = useState<Record<string, string>>({});
  const extraFields = extraFieldsFor(form.category);


  const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
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
    if (!user) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("ads")
        .insert({
          seller_id: user.id,
          title: form.title,
          description: form.description,
          price_usdc: Number(form.price),
          category: form.category,
          condition: form.condition,
          location: form.location,
          images,
          attributes: Object.fromEntries(
            extraFields.map((f) => [f.key, (extras[f.key] || "").trim()]).filter(([, v]) => v),
          ),
        })
        .select()
        .single();
      if (error) throw error;
      // The ad is created in `pending_fee` and goes live only after the
      // anti-spam listing fee is confirmed on-chain.
      toast({
        title: "Ad saved",
        description: "Pay the listing fee to publish it.",
      });
      navigate(`/publish/${data.id}`);
    } catch (err: any) {
      toast({ title: "Failed to post", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (resolving) return <AuthResolving />;
  if (!user) return null;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">Post Free Ad</h1>
        <p className="text-muted-foreground mb-8">Reach buyers worldwide. It's free!</p>

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
            <label className="block text-sm font-medium text-foreground mb-1.5">Title</label>
            <Input
              placeholder="e.g. iPhone 15 Pro Max 256GB"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Category</label>
            <select
              value={form.category}
              onChange={(e) => { setForm({ ...form, category: e.target.value }); setExtras({}); }}
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
            <label className="block text-sm font-medium text-foreground mb-1.5">Price (USDC)</label>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
                className="pl-16"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-primary">USDC</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Location</label>
            <Input
              placeholder="e.g. New York, USA or Worldwide"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
            <Textarea
              placeholder="Describe your item in detail..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={5}
              required
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full font-bold text-base py-6 gap-2"
            disabled={submitting || uploading}
          >
            <Upload className="w-5 h-5" />
            {submitting ? "Posting..." : "Post Ad for Free"}
          </Button>
        </form>
      </div>
    </Layout>
  );
};

export default PostAd;
