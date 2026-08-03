import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { WalletProvider } from "@/hooks/useWallet";
import { FavoritesProvider } from "@/hooks/useFavorites";
import Index from "./pages/Index";
import PostAd from "./pages/PostAd";
import AdDetail from "./pages/AdDetail";
import Browse from "./pages/Browse";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Messages from "./pages/Messages";
import Transactions from "./pages/Transactions";
import SellerProfile from "./pages/SellerProfile";
import NotFound from "./pages/NotFound";
import Agents from "./pages/Agents";
import AgentDocs from "./pages/AgentDocs";
import Pricing from "./pages/Pricing";
import Promote from "./pages/Promote";
import EscrowDetail from "./pages/EscrowDetail";

const App = () => (
  <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <WalletProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/post-ad" element={<PostAd />} />
              <Route path="/ad/:id" element={<AdDetail />} />
              <Route path="/browse" element={<Browse />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/seller/:id" element={<SellerProfile />} />
              <Route path="/agents" element={<AgentDocs />} />
              <Route path="/dashboard/agents" element={<Agents />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/promote/:adId" element={<Promote />} />
              <Route path="/escrow/:id" element={<EscrowDetail />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </WalletProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
);

export default App;
