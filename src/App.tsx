import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { WalletProvider } from "@/hooks/useWallet";
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
              <Route path="*" element={<NotFound />} />
            </Routes>
          </WalletProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
);

export default App;
