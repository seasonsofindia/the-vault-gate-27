import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Vault } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Apply = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    ageVerified: false,
    location: "",
    referralSource: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.ageVerified) {
      toast({
        title: "Age Verification Required",
        description: "You must be 18+ to apply",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await (supabase as any)
        .from("membership_applications")
        .insert({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          age_verified: formData.ageVerified,
          location: formData.location,
          referral_source: formData.referralSource || null,
        });

      if (error) throw error;

      toast({
        title: "Application Submitted!",
        description: "We'll review your application and notify you soon.",
      });

      navigate("/");
    } catch (error: any) {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[image:var(--vault-gradient)] text-foreground">
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <Vault className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-bold bg-[image:var(--gold-shine)] bg-clip-text text-transparent">
              VAULT 27
            </h1>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-12 max-w-2xl">
        <div className="bg-card rounded-lg border border-border p-8 shadow-xl">
          <h2 className="text-3xl font-bold mb-2 bg-[image:var(--gold-shine)] bg-clip-text text-transparent">
            Request Access
          </h2>
          <p className="text-muted-foreground mb-8">
            Submit your application to join VAULT 27's exclusive community
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="mt-1"
                placeholder="Minimum 6 characters"
              />
            </div>

            <div>
              <Label htmlFor="location">Location *</Label>
              <Input
                id="location"
                required
                placeholder="City, Country"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="referral">How did you hear about us?</Label>
              <Textarea
                id="referral"
                value={formData.referralSource}
                onChange={(e) => setFormData({ ...formData, referralSource: e.target.value })}
                className="mt-1"
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="age"
                checked={formData.ageVerified}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, ageVerified: checked as boolean })
                }
              />
              <Label htmlFor="age" className="text-sm font-normal cursor-pointer">
                I confirm that I am 18 years or older *
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit Application"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Apply;