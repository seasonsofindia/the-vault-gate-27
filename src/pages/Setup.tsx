import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const Setup = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSetup = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("initial-setup");

      if (error) throw error;

      toast({
        title: "Setup Complete",
        description: "Admin and member accounts have been created successfully.",
      });

      console.log("Setup results:", data);
      
      setTimeout(() => {
        navigate("/auth");
      }, 2000);
    } catch (error: any) {
      toast({
        title: "Setup Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6 text-center">
        <h1 className="text-4xl font-bold">Initial Setup</h1>
        <p className="text-muted-foreground">
          Click the button below to create admin and member accounts from approved applications.
        </p>
        <Button 
          onClick={handleSetup} 
          disabled={isLoading}
          size="lg"
          className="w-full"
        >
          {isLoading ? "Setting up..." : "Run Initial Setup"}
        </Button>
      </div>
    </div>
  );
};

export default Setup;
