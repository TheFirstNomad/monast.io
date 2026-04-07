import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Shield, ArrowLeftRight, Lock, Zap } from "lucide-react";

const Index = () => {
  return (
    <Layout>
      {/* Hero */}
      <section className="hero-gradient py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-primary-foreground mb-6 tracking-tight">
            Secure Escrow &amp; Swap
          </h1>
          <p className="text-lg md:text-xl text-primary-foreground/80 mb-10 max-w-2xl mx-auto">
            Trustless escrow marketplace and decentralized exchange on Base and Arc. Trade with confidence.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" variant="secondary" className="text-base px-8 py-6 font-semibold">
              <Link to="/escrows/create">
                <Shield className="w-5 h-5 mr-2" />
                Create Escrow
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-base px-8 py-6 font-semibold bg-primary-foreground/10 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/20">
              <Link to="/swap">
                <ArrowLeftRight className="w-5 h-5 mr-2" />
                Launch Swap
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
          {[
            {
              icon: Shield,
              title: "Secure Escrow",
              desc: "Funds are held in smart contracts until both parties confirm. No middlemen.",
            },
            {
              icon: ArrowLeftRight,
              title: "Instant Swaps",
              desc: "Swap tokens seamlessly on Base mainnet or Arc Testnet with low fees.",
            },
            {
              icon: Lock,
              title: "Non-Custodial",
              desc: "You stay in control of your assets at all times. Connect your wallet and go.",
            },
          ].map((f) => (
            <div key={f.title} className="bg-card rounded-xl border border-border p-8 text-center hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mx-auto mb-4">
                <f.icon className="w-6 h-6 text-accent-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{f.title}</h3>
              <p className="text-muted-foreground text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="bg-card border-y border-border py-16 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center">
          {[
            { value: "$0", label: "Total Volume" },
            { value: "0", label: "Active Escrows" },
            { value: "0", label: "Completed Trades" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-3xl font-bold text-foreground">{s.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 text-center text-sm text-muted-foreground">
        © 2026 monast.io — Secure Escrow Marketplace
      </footer>
    </Layout>
  );
};

export default Index;
