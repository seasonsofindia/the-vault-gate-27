import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get all approved applications
    const { data: applications, error: appError } = await supabaseAdmin
      .from("membership_applications")
      .select("*")
      .eq("status", "approved");

    if (appError) throw appError;

    if (!applications || applications.length === 0) {
      throw new Error("No approved applications found");
    }

    const results = [];

    for (const app of applications) {
      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: app.email,
        password: app.password || "Password1.",
        email_confirm: true,
      });

      if (authError) {
        console.error(`Auth error for ${app.email}:`, authError);
        results.push({ email: app.email, error: authError.message });
        continue;
      }

      // Create profile
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: authData.user.id,
          name: app.name,
          email: app.email,
          phone: app.phone,
          location: app.location,
        });

      if (profileError) {
        console.error(`Profile error for ${app.email}:`, profileError);
        results.push({ email: app.email, error: profileError.message });
        continue;
      }

      // Assign admin role to all users during initial setup
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: authData.user.id,
          role: "admin",
        });

      if (roleError) {
        console.error(`Role error for ${app.email}:`, roleError);
        results.push({ email: app.email, error: roleError.message });
        continue;
      }

      results.push({ 
        email: app.email, 
        userId: authData.user.id, 
        role: "admin",
        success: true 
      });
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
