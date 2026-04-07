import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "@/hooks/useWallet";
import Index from "./pages/Index";
import Swap from "./pages/Swap";
import EscrowMarketplace from "./pages/EscrowMarketplace";
import CreateEscrow from "./pages/CreateEscrow";
import EscrowDetail from "./pages/EscrowDetail";
import MyEscrows from "./pages/MyEscrows";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <WalletProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/swap" element={<Swap />} />
            <Route path="/escrows" element={<EscrowMarketplace />} />
            <Route path="/escrows/create" element={<CreateEscrow />} />
            <Route path="/escrows/:id" element={<EscrowDetail />} />
            <Route path="/my-escrows" element={<MyEscrows />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </WalletProvider>
  </QueryClientProvider>
);

export default App;
