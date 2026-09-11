import { Layout } from "@/components/Layout";
import { Loader2, ShieldCheck } from "lucide-react";

interface AdminGateProps {
  /** True while the role lookup is still in flight. */
  loading: boolean;
  /** True once the visitor is confirmed to hold the required role. */
  allowed: boolean;
  title: string;
  message: string;
  children: React.ReactNode;
}

/**
 * Shared gate for the internal consoles. While the role lookup runs it shows a
 * neutral placeholder instead of the console shell, so an unauthorised visitor
 * never sees a flash of privileged chrome before being turned away.
 */
export function AdminGate({ loading, allowed, title, message, children }: AdminGateProps) {
  if (loading) {
    return (
      <Layout>
        <div className="container max-w-2xl py-24 text-center">
          <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Checking your access…</p>
        </div>
      </Layout>
    );
  }

  if (!allowed) {
    return (
      <Layout>
        <div className="container max-w-2xl py-20 text-center space-y-4">
          <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground" />
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-muted-foreground">{message}</p>
        </div>
      </Layout>
    );
  }

  return <>{children}</>;
}
