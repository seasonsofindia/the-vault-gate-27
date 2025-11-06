import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ArrowLeft, Pencil, Trash2, Upload, RefreshCw } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ShopifyProductDisplay {
  id: number;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  tags: string;
  variants: Array<{
    id: number;
    title: string;
    price: string;
    sku: string;
    inventory_quantity: number;
    option1: string | null;
    option2: string | null;
    option3: string | null;
  }>;
  options: Array<{
    name: string;
    values: string[];
  }>;
  images: Array<{
    src: string;
    alt: string | null;
  }>;
}

const Products = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [products, setProducts] = useState<ShopifyProductDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCsvDialogOpen, setIsCsvDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ShopifyProductDisplay | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    body: "",
    price: "",
    vendor: "",
    product_type: "",
    tags: "",
    sizes: "S,M,L,XL",
    colors: "Black,White",
    images: "",
    stock: "10,10,10,10", // Stock levels matching size order
  });

  useEffect(() => {
    checkAdminAccess();
    fetchProducts();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: roles } = await (supabase as any)
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

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-shopify-products', {
        method: 'POST',
      });
      
      if (error) throw error;
      
      toast({
        title: "Products Synced",
        description: `Successfully synced ${data.count || 0} products from Shopify`,
      });
      
      // Now fetch from Shopify to display
      const { data: shopifyData, error: shopifyError } = await supabase.functions.invoke('shopify-products', {
        method: 'GET',
      });
      
      if (shopifyError) throw shopifyError;
      
      setProducts(shopifyData.products || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sync products from Shopify",
        variant: "destructive",
      });
      setProducts([]);
    }
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      const sizes = formData.sizes.split(",").map(s => s.trim()).filter(Boolean);
      const colors = formData.colors.split(",").map(c => c.trim()).filter(Boolean);
      const imageUrls = formData.images.split(",").map(i => i.trim()).filter(Boolean);
      const stockLevels = formData.stock.split(",").map(s => parseInt(s.trim())).filter(s => !isNaN(s));

      // Validate stock levels match sizes
      if (stockLevels.length !== sizes.length) {
        throw new Error("Number of stock levels must match number of sizes");
      }

      if (editingProduct) {
        // Update existing product in local DB
        const productData = await supabase
          .from('products')
          .select('id')
          .eq('name', editingProduct.title)
          .single();

        if (productData.error) throw productData.error;

        const { error: updateError } = await supabase
          .from('products')
          .update({
            name: formData.title,
            description: formData.body,
            price: parseFloat(formData.price),
            category: formData.product_type || 'Merchandise',
            images: imageUrls,
            sku: formData.vendor || 'VAULT 27',
          })
          .eq('id', productData.data.id);

        if (updateError) throw updateError;

        // Delete existing variants
        await supabase
          .from('product_variants')
          .delete()
          .eq('product_id', productData.data.id);

        // Insert new variants
        const variants = [];
        for (let i = 0; i < sizes.length; i++) {
          for (const color of colors) {
            variants.push({
              product_id: productData.data.id,
              size: sizes[i],
              color: color,
              stock: stockLevels[i] || 0,
              sku: `${formData.title.substring(0, 3).toUpperCase()}-${sizes[i]}-${color}`.replace(/\s+/g, '-'),
            });
          }
        }

        if (variants.length > 0) {
          const { error: variantsError } = await supabase
            .from('product_variants')
            .insert(variants);

          if (variantsError) throw variantsError;
        }

        toast({
          title: "Success",
          description: "Product updated successfully",
        });
      } else {
        // Create new product in local DB
        const { data: newProduct, error: insertError } = await supabase
          .from('products')
          .insert({
            name: formData.title,
            description: formData.body,
            price: parseFloat(formData.price),
            category: formData.product_type || 'Merchandise',
            images: imageUrls,
            sku: formData.vendor || 'VAULT 27',
            stock: 0, // Will be calculated from variants
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Insert variants
        const variants = [];
        for (let i = 0; i < sizes.length; i++) {
          for (const color of colors) {
            variants.push({
              product_id: newProduct.id,
              size: sizes[i],
              color: color,
              stock: stockLevels[i] || 0,
              sku: `${formData.title.substring(0, 3).toUpperCase()}-${sizes[i]}-${color}`.replace(/\s+/g, '-'),
            });
          }
        }

        if (variants.length > 0) {
          const { error: variantsError } = await supabase
            .from('product_variants')
            .insert(variants);

          if (variantsError) throw variantsError;
        }

        toast({
          title: "Success",
          description: "Product created successfully",
        });
      }
      
      setIsDialogOpen(false);
      resetForm();
      fetchProducts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save product",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (productId: number) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
      const { error } = await supabase.functions.invoke('shopify-products', {
        method: 'DELETE',
        body: { productId },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product deleted successfully",
      });
      fetchProducts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCsvUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;

    setIsProcessing(true);
    try {
      const csvContent = await csvFile.text();
      
      const { data, error } = await supabase.functions.invoke('import-products-csv', {
        body: { csvContent }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Success",
        description: `Successfully imported ${data.count} products`,
      });
      
      setIsCsvDialogOpen(false);
      setCsvFile(null);
      fetchProducts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to import CSV",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      body: "",
      price: "",
      vendor: "",
      product_type: "",
      tags: "",
      sizes: "S,M,L,XL",
      colors: "Black,White",
      images: "",
      stock: "10,10,10,10",
    });
    setEditingProduct(null);
  };

  const handleEdit = async (product: ShopifyProductDisplay) => {
    try {
      // Fetch product details from local DB
      const { data: localProduct, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('name', product.title)
        .single();

      if (productError) throw productError;

      // Fetch variants
      const { data: variants, error: variantsError } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', localProduct.id);

      if (variantsError) throw variantsError;

      // Extract unique sizes and colors
      const sizes = [...new Set(variants.map(v => v.size))].filter(Boolean);
      const colors = [...new Set(variants.map(v => v.color))].filter(Boolean);
      
      // Get stock levels for each size (take first variant's stock for that size)
      const stockLevels = sizes.map(size => {
        const variant = variants.find(v => v.size === size);
        return variant?.stock || 0;
      });
      
      setFormData({
        title: localProduct.name,
        body: localProduct.description || '',
        price: localProduct.price.toString(),
        vendor: localProduct.sku || '',
        product_type: localProduct.category || '',
        tags: '',
        sizes: sizes.join(',') || 'S,M,L,XL',
        colors: colors.join(',') || 'Black,White',
        images: localProduct.images.join(','),
        stock: stockLevels.join(',') || '10,10,10,10',
      });
      
      setEditingProduct(product);
      setIsDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load product details",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-primary/20 bg-black">
        <div className="container mx-auto px-4 py-6 flex justify-between items-center">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/admin")}
            className="text-foreground hover:text-primary hover:bg-primary/10"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-black tracking-tighter text-foreground">
            VAULT 27 <span className="text-primary">PRODUCTS</span>
          </h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={fetchProducts}
              disabled={isLoading}
              className="border-primary text-primary hover:bg-primary hover:text-black"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Sync Products
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  setIsProcessing(true);
                  const response = await fetch('/VAULT27_sample_products.csv');
                  const csvContent = await response.text();
                  
                  const { data, error } = await supabase.functions.invoke('import-products-csv', {
                    body: { csvContent }
                  });

                  if (error) throw error;
                  if (data?.error) throw new Error(data.error);

                  toast({
                    title: "Success",
                    description: `Successfully imported ${data.count} sample products`,
                  });
                  
                  fetchProducts();
                } catch (error: any) {
                  toast({
                    title: "Error",
                    description: error.message || "Failed to import sample products",
                    variant: "destructive",
                  });
                } finally {
                  setIsProcessing(false);
                }
              }}
              disabled={isProcessing}
              className="border-accent text-accent hover:bg-accent hover:text-black"
            >
              <Upload className="mr-2 h-4 w-4" />
              Load Sample Products
            </Button>
            <Dialog open={isCsvDialogOpen} onOpenChange={setIsCsvDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary hover:text-black"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Import CSV
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import Products from CSV</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCsvUpload} className="space-y-4">
                  <div>
                    <Label>CSV Format</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Expected columns: name, description, price, category, sizes, colors, images, featured, stock
                    </p>
                    <p className="text-sm text-muted-foreground mb-2">
                      Arrays should be in JSON format: ["S","M","L"] for sizes
                    </p>
                    <p className="text-sm text-muted-foreground">
                      See /sample-products.csv for an example
                    </p>
                  </div>
                  <div>
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isProcessing || !csvFile}>
                    {isProcessing ? "Importing..." : "Import Products"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button 
                  className="bg-primary hover:bg-primary/90 text-black font-bold"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Product
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingProduct ? 'Edit Product' : 'Add Product to Shopify'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="title">Product Title</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="body">Description</Label>
                    <Textarea
                      id="body"
                      value={formData.body}
                      onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="price">Price</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="vendor">Vendor</Label>
                      <Input
                        id="vendor"
                        value={formData.vendor}
                        onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                        placeholder="VAULT 27"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="product_type">Product Type</Label>
                      <Input
                        id="product_type"
                        value={formData.product_type}
                        onChange={(e) => setFormData({ ...formData, product_type: e.target.value })}
                        placeholder="Merchandise"
                      />
                    </div>
                    <div>
                      <Label htmlFor="tags">Tags</Label>
                      <Input
                        id="tags"
                        value={formData.tags}
                        onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                        placeholder="premium,exclusive"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="sizes">Sizes (comma-separated)</Label>
                    <Input
                      id="sizes"
                      value={formData.sizes}
                      onChange={(e) => setFormData({ ...formData, sizes: e.target.value })}
                      placeholder="S,M,L,XL"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="colors">Colors (comma-separated)</Label>
                    <Input
                      id="colors"
                      value={formData.colors}
                      onChange={(e) => setFormData({ ...formData, colors: e.target.value })}
                      placeholder="Black,White,Blue"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="stock">Stock Levels (comma-separated, one per size)</Label>
                    <Input
                      id="stock"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      placeholder="10,10,10,10"
                      required
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Enter stock levels matching the order of sizes above (e.g., for S,M,L,XL enter 10,15,20,25)
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="images">Image URLs (comma-separated)</Label>
                    <Textarea
                      id="images"
                      value={formData.images}
                      onChange={(e) => setFormData({ ...formData, images: e.target.value })}
                      placeholder="https://example.com/image1.jpg,https://example.com/image2.jpg"
                      required
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Enter full URLs to product images
                    </p>
                  </div>
                    <Button type="submit" className="w-full" disabled={isProcessing}>
                      {isProcessing 
                        ? (editingProduct ? "Updating..." : "Creating...") 
                        : (editingProduct ? "Update Product" : "Create Product")}
                    </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-12">
        {isLoading ? (
          <p className="text-center text-muted-foreground">Loading products...</p>
        ) : products.length === 0 ? (
          <div className="text-center text-muted-foreground">
            <p className="mb-4">No products yet</p>
            <p className="text-sm">Create a product by clicking "Add Product" or import from CSV</p>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Variants</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                 {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.title}</TableCell>
                    <TableCell>{product.product_type}</TableCell>
                    <TableCell>${product.variants[0]?.price || '0.00'}</TableCell>
                    <TableCell>{product.variants.length}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(product)}
                          className="bg-primary/10 hover:bg-primary/20"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(product.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Products;
