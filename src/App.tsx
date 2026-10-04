import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { WalletProvider } from "@/hooks/useWallet";
import { FavoritesProvider } from "@/hooks/useFavorites";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BrandLogo } from "@/components/BrandLogo";

// The landing page is the first thing most visitors see, so it ships in the
// initial bundle. Every other screen is fetched only when its route opens,
// which keeps the first load small.
import Index from "./pages/Index";

const PostAd = lazy(() => import("./pages/PostAd"));
const EditAd = lazy(() => import("./pages/EditAd"));
const AdDetail = lazy(() => import("./pages/AdDetail"));
const Browse = lazy(() => import("./pages/Browse"));
const CategoryPage = lazy(() => import("./pages/CategoryPage"));
const ProSeller = lazy(() => import("./pages/ProSeller"));
const EscrowApi = lazy(() => import("./pages/EscrowApi"));
const Reputation = lazy(() => import("./pages/Reputation"));
const AgentBilling = lazy(() => import("./pages/AgentBilling"));
const Analytics = lazy(() => import("./pages/Analytics"));
const DisputeHistory = lazy(() => import("./pages/DisputeHistory"));
const BulkImport = lazy(() => import("./pages/BulkImport"));
const ForFreelancers = lazy(() => import("./pages/ForFreelancers"));
const ForCryptoTraders = lazy(() => import("./pages/ForCryptoTraders"));
const ForDomainSellers = lazy(() => import("./pages/ForDomainSellers"));
// Refer page intentionally hidden — route removed
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Auth = lazy(() => import("./pages/Auth"));
const Messages = lazy(() => import("./pages/Messages"));
const MessageThread = lazy(() => import("./pages/MessageThread"));
const Transactions = lazy(() => import("./pages/Transactions"));
const Wallet = lazy(() => import("./pages/Wallet"));
const SellerProfile = lazy(() => import("./pages/SellerProfile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AgentDocs = lazy(() => import("./pages/AgentDocs"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Promote = lazy(() => import("./pages/Promote"));
const PublishAd = lazy(() => import("./pages/PublishAd"));
const AdminTreasury = lazy(() => import("./pages/AdminTreasury"));
const AdminDisputes = lazy(() => import("./pages/AdminDisputes"));
const AdminReports = lazy(() => import("./pages/AdminReports"));
const AdminRoles = lazy(() => import("./pages/AdminRoles"));
const EscrowDetail = lazy(() => import("./pages/EscrowDetail"));
const Favorites = lazy(() => import("./pages/Favorites"));
const Purchases = lazy(() => import("./pages/Purchases"));
const Buy = lazy(() => import("./pages/Buy"));
const Settings = lazy(() => import("./pages/Settings"));
const Account = lazy(() => import("./pages/Account"));

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div role="status" aria-label="Loading Monast" className="animate-pulse">
      <BrandLogo size="lg" showName={false} />
    </div>
  </div>
);

const App = () => (
  <ErrorBoundary>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <WalletProvider>
            <FavoritesProvider>
            <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/post-ad" element={<PostAd />} />
              <Route path="/edit-ad/:id" element={<EditAd />} />
              <Route path="/ad/:id" element={<AdDetail />} />
              <Route path="/browse" element={<Browse />} />
              <Route path="/apps" element={<CategoryPage />} />
              <Route path="/crypto-coins" element={<CategoryPage />} />
              <Route path="/nfts" element={<CategoryPage />} />
              <Route path="/domains" element={<CategoryPage />} />

              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/purchases" element={<Purchases />} />
              <Route path="/buy/:adId" element={<Buy />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/account" element={<Account />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/messages/:adId/:otherId" element={<MessageThread />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/wallet" element={<Wallet />} />
              <Route path="/seller/:id" element={<SellerProfile />} />
              <Route path="/agents" element={<AgentDocs />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/pro" element={<ProSeller />} />
              <Route path="/escrow-api" element={<EscrowApi />} />
              <Route path="/reputation" element={<Reputation />} />
              <Route path="/agent-billing" element={<AgentBilling />} />
              {/* /refer route intentionally removed */}
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/disputes" element={<DisputeHistory />} />
              <Route path="/bulk-import" element={<BulkImport />} />
              <Route path="/for-freelancers" element={<ForFreelancers />} />
              <Route path="/for-crypto-traders" element={<ForCryptoTraders />} />
              <Route path="/for-domain-sellers" element={<ForDomainSellers />} />
              <Route path="/publish/:adId" element={<PublishAd />} />
              <Route path="/promote/:adId" element={<Promote />} />
              <Route path="/escrow/:id" element={<EscrowDetail />} />
              <Route path="/admin/treasury" element={<AdminTreasury />} />
              <Route path="/admin/disputes" element={<AdminDisputes />} />
              <Route path="/admin/reports" element={<AdminReports />} />
              <Route path="/admin/roles" element={<AdminRoles />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </FavoritesProvider>
          </WalletProvider>

        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </ErrorBoundary>
);

export default App;
