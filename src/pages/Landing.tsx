import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="max-w-4xl w-full space-y-12 text-center">
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-7xl md:text-8xl font-black tracking-tighter text-foreground">
              VAULT 27
            </h1>
            <div className="h-1 w-32 bg-primary mx-auto"></div>
          </div>
          <p className="text-xl md:text-2xl text-muted-foreground uppercase tracking-wide">
            Tech-Luxury E-Commerce Platform
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
          <Button 
            size="lg" 
            onClick={() => navigate("/apply")}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-black font-bold px-8 py-6 text-lg"
          >
            Apply for Access
          </Button>
          <Button 
            size="lg" 
            variant="outline"
            onClick={() => navigate("/auth")}
            className="w-full sm:w-auto border-primary text-primary hover:bg-primary hover:text-black font-bold px-8 py-6 text-lg"
          >
            Member Login
          </Button>
        </div>

        <div className="pt-12 space-y-8">
          <h2 className="text-3xl font-bold uppercase tracking-wider">Exclusive Access</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 rounded-sm bg-card border border-border hover:border-primary transition-colors">
              <h3 className="font-bold mb-3 text-xl uppercase tracking-wide">Premium Products</h3>
              <p className="text-sm text-muted-foreground">
                Curated selection of tech-luxury items
              </p>
            </div>
            <div className="p-8 rounded-sm bg-card border border-border hover:border-primary transition-colors">
              <h3 className="font-bold mb-3 text-xl uppercase tracking-wide">Members Only</h3>
              <p className="text-sm text-muted-foreground">
                Elite community of discerning customers
              </p>
            </div>
            <div className="p-8 rounded-sm bg-card border border-border hover:border-primary transition-colors">
              <h3 className="font-bold mb-3 text-xl uppercase tracking-wide">First Access</h3>
              <p className="text-sm text-muted-foreground">
                Priority access to limited releases
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;