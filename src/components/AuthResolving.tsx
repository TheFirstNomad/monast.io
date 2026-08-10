import { Layout } from "@/components/Layout";
import { Loader2 } from "lucide-react";

export const AuthResolving = ({ label = "Connecting your wallet..." }: { label?: string }) => (
  <Layout>
    <div className="max-w-md mx-auto px-4 py-24 flex flex-col items-center gap-3 text-center">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  </Layout>
);
