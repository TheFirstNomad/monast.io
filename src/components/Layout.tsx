import { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { RehydrationBanner } from "@/components/RehydrationBanner";

export const Layout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen flex flex-col bg-background">
    <RehydrationBanner />
    <Navbar />
    <main className="flex-1">{children}</main>
    <footer className="border-t border-border py-8 px-4">
      <div className="max-w-7xl mx-auto text-center text-sm text-muted-foreground">
        © 2026 monast.io — Buy & Sell Anything with USDC on Arc
      </div>
    </footer>
  </div>
);
