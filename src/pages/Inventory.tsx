import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface VariantWithProduct {
  id: string;
  product_id: string;
  shopify_variant_id: string | null;
  size: string | null;
  color: string | null;
  stock: number;
  sku: string | null;
  products: {
    name: string;
    images: string[];
  };
}

const Inventory = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [variants, setVariants] = useState<VariantWithProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [stockChanges, setStockChanges] = useState<Record<string, number>>({});

  useEffect(() => {
    checkAdminAccess();
    fetchInventory();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);

    const hasAdminRole = roles?.some((r: any) => r.role === "admin");
    
    if (!hasAdminRole) {
      toast({
        title: "Access Denied",
        description: "Admin access required",
        variant: "destructive",
      });
      navigate("/shop");
    }
  };

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_variants')
        .select(`
          *,
          products:product_id (
            name,
            images
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setVariants(data as any || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch inventory",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  const handleStockChange = (variantId: string, newStock: number) => {
    setStockChanges(prev => ({
      ...prev,
      [variantId]: newStock
    }));
  };

  const saveAllChanges = async () => {
    if (Object.keys(stockChanges).length === 0) {
      toast({
        title: "No Changes",
        description: "No stock levels have been modified",
      });
      return;
    }

    setIsSaving(true);
    try {
      const updates = Object.entries(stockChanges).map(([variantId, stock]) => ({
        id: variantId,
        stock,
      }));

      for (const update of updates) {
        const { error: dbError } = await supabase
          .from('product_variants')
          .update({ stock: update.stock })
          .eq('id', update.id);

        if (dbError) throw dbError;

        const variant = variants.find(v => v.id === update.id);
        if (variant?.shopify_variant_id) {
          try {
            await supabase.functions.invoke('sync-inventory', {
              body: {
                shopifyVariantId: variant.shopify_variant_id,
                stock: update.stock,
              }
            });
          } catch (shopifyError) {
            console.error('Shopify sync failed for variant:', variant.id, shopifyError);
          }
        }
      }

      toast({
        title: "Success",
        description: `Updated ${updates.length} variant(s) in both database and Shopify`,
      });

      setStockChanges({});
      fetchInventory();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save changes",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getCurrentStock = (variantId: string, originalStock: number) => {
    return stockChanges[variantId] !== undefined ? stockChanges[variantId] : originalStock;
  };

  const hasChanges = Object.keys(stockChanges).length > 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Inventory Management</h1>
              <p className="text-muted-foreground">Track and update stock levels across all variants</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={fetchInventory}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={saveAllChanges}
              disabled={!hasChanges || isSaving}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : `Save Changes${hasChanges ? ` (${Object.keys(stockChanges).length})` : ''}`}
            </Button>
          </div>
        </div>

        <div className="bg-card rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Current Stock</TableHead>
                <TableHead>Update Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Shopify Sync</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.map((variant) => {
                const currentStock = getCurrentStock(variant.id, variant.stock);
                const hasChange = stockChanges[variant.id] !== undefined;
                
                return (
                  <TableRow key={variant.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {variant.products.images?.[0] && (
                          <img
                            src={variant.products.images[0]}
                            alt={variant.products.name}
                            className="h-10 w-10 object-cover rounded"
                          />
                        )}
                        <span className="font-medium">{variant.products.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{variant.sku || '-'}</TableCell>
                    <TableCell>{variant.size || '-'}</TableCell>
                    <TableCell>
                      {variant.color && (
                        <Badge variant="outline">{variant.color}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={hasChange ? 'text-muted-foreground line-through' : ''}>
                        {variant.stock}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        value={currentStock}
                        onChange={(e) => handleStockChange(variant.id, parseInt(e.target.value) || 0)}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      {currentStock === 0 ? (
                        <Badge variant="destructive">Out of Stock</Badge>
                      ) : currentStock < 10 ? (
                        <Badge variant="secondary">Low Stock</Badge>
                      ) : (
                        <Badge className="bg-green-500">In Stock</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {variant.shopify_variant_id ? (
                        <Badge variant="outline" className="bg-primary/10">
                          Synced
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-yellow-500/10">
                          Not Synced
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {variants.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No inventory found</p>
              <Button
                variant="link"
                onClick={() => navigate("/products")}
                className="mt-2"
              >
                Add products to start tracking inventory
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Inventory;
