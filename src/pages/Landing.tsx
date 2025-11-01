import { Button } from "@/components/ui/button";
import { Vault, Lock, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[image:var(--vault-gradient)] text-foreground">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Vault className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-bold bg-[image:var(--gold-shine)] bg-clip-text text-transparent">
              VAULT 27
            </h1>
          </div>
          <Button 
            variant="ghost" 
            onClick={() => navigate("/auth")}
            className="text-foreground"
          >
            Member Login
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="flex justify-center mb-8">
            <div className="relative">
              <Lock className="w-24 h-24 text-primary animate-pulse" />
              <div className="absolute inset-0 blur-2xl bg-primary/20" />
            </div>
          </div>
          
          <h2 className="text-6xl font-bold mb-6 bg-[image:var(--gold-shine)] bg-clip-text text-transparent">
            Exclusive Access
          </h2>
          
          <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
            VAULT 27 is a members-only marketplace offering curated, premium merchandise. 
            Access is granted by invitation or application only.
          </p>
          
          <Button 
            size="lg" 
            onClick={() => navigate("/apply")}
            className="text-lg px-8 py-6 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-primary/50 transition-all"
          >
            Request Access
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-card/50">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-8 rounded-lg bg-background/50 backdrop-blur border border-border">
              <Crown className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Curated Selection</h3>
              <p className="text-muted-foreground">
                Handpicked premium merchandise exclusively for members
              </p>
            </div>
            
            <div className="text-center p-8 rounded-lg bg-background/50 backdrop-blur border border-border">
              <Vault className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Verified Members</h3>
              <p className="text-muted-foreground">
                Every member is personally reviewed and approved
              </p>
            </div>
            
            <div className="text-center p-8 rounded-lg bg-background/50 backdrop-blur border border-border">
              <Lock className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Private Marketplace</h3>
              <p className="text-muted-foreground">
                Secure, members-only shopping experience
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border">
        <div className="container mx-auto text-center text-muted-foreground">
          <p>&copy; 2025 VAULT 27. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;