import { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { TestnetBanner } from "@/components/TestnetBanner";

export const Layout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen flex flex-col">
    <TestnetBanner />
    <Navbar />
    <main className="flex-1">{children}</main>
  </div>
);
