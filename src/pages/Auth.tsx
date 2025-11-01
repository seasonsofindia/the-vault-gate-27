import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/shop");
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        navigate("/shop");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Log the Supabase runtime config so we can verify env values and endpoint reachability
      try {
        // Vite replaces import.meta.env at build time
        console.log("VITE_SUPABASE_URL:", import.meta.env.VITE_SUPABASE_URL);
        // mask the key when logging
        const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
        console.log("VITE_SUPABASE_PUBLISHABLE_KEY (masked):", key ? `${key.slice(0,8)}...${key.slice(-8)}` : key);
      } catch (e) {
        console.warn("Could not read import.meta.env values:", e);
      }

      // Log the full response so we can inspect returned data/error in the browser console
      const result = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log("supabase.signInWithPassword result:", result);

      const { error } = result;

      if (error) throw error;

      toast({
        title: "Welcome back!",
        description: "Logging you into VAULT 27",
      });
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[image:var(--vault-gradient)] text-foreground flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Shield className="w-16 h-16 text-primary" />
          </div>
          <h1 className="text-3xl font-bold bg-[image:var(--gold-shine)] bg-clip-text text-transparent">
            VAULT 27
          </h1>
          <p className="text-muted-foreground mt-2">Member Login</p>
        </div>

        <div className="bg-card rounded-lg border border-border p-8 shadow-xl">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
                placeholder="••••••••"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={isLoading}
            >
              {isLoading ? "Signing In..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Button
              variant="link"
              onClick={() => navigate("/")}
              className="text-muted-foreground"
            >
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;