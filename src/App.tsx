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
import MessageThread from "./pages/MessageThread";
import Transactions from "./pages/Transactions";
import SellerProfile from "./pages/SellerProfile";
import NotFound from "./pages/NotFound";
import AgentDocs from "./pages/AgentDocs";
import Pricing from "./pages/Pricing";
import Promote from "./pages/Promote";
import PublishAd from "./pages/PublishAd";
import AdminTreasury from "./pages/AdminTreasury";
import AdminDisputes from "./pages/AdminDisputes";
import AdminReports from "./pages/AdminReports";
import AdminRoles from "./pages/AdminRoles";
import EscrowDetail from "./pages/EscrowDetail";
import Favorites from "./pages/Favorites";
import Settings from "./pages/Settings";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const App = () => (
  <ErrorBoundary>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <WalletProvider>
            <FavoritesProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/post-ad" element={<PostAd />} />
              <Route path="/ad/:id" element={<AdDetail />} />
              <Route path="/browse" element={<Browse />} />

              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/messages/:adId/:otherId" element={<MessageThread />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/seller/:id" element={<SellerProfile />} />
              <Route path="/agents" element={<AgentDocs />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/publish/:adId" element={<PublishAd />} />
              <Route path="/promote/:adId" element={<Promote />} />
              <Route path="/escrow/:id" element={<EscrowDetail />} />
              <Route path="/admin/treasury" element={<AdminTreasury />} />
              <Route path="/admin/disputes" element={<AdminDisputes />} />
              <Route path="/admin/reports" element={<AdminReports />} />
              <Route path="/admin/roles" element={<AdminRoles />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </FavoritesProvider>
          </WalletProvider>

        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </ErrorBoundary>
);

export default App;
