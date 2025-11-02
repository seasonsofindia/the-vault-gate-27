import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ArrowLeft, Pencil, Trash2, Upload } from "lucide-react";
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
      const response = await fetch('/api/shopify/products', {
        method: 'GET',
      });
      
      if (!response.ok) throw new Error('Failed to fetch products');
      
      const data = await response.json();
      setProducts(data.products || []);
    } catch (error: any) {
      // If API call fails, try using the Shopify tool directly
      console.log("Fetching from Shopify...");
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

      // Create options and variants
      const options = [];
      if (sizes.length > 0) options.push({ name: "Size", values: sizes });
      if (colors.length > 0) options.push({ name: "Color", values: colors });

      // Generate variants for all combinations
      const variants = [];
      if (sizes.length > 0 && colors.length > 0) {
        for (const size of sizes) {
          for (const color of colors) {
            variants.push({
              option1: size,
              option2: color,
              price: formData.price,
              sku: `${formData.title.substring(0, 3).toUpperCase()}-${size}-${color}`.replace(/\s+/g, '-'),
            });
          }
        }
      } else if (sizes.length > 0) {
        for (const size of sizes) {
          variants.push({
            option1: size,
            price: formData.price,
            sku: `${formData.title.substring(0, 3).toUpperCase()}-${size}`.replace(/\s+/g, '-'),
          });
        }
      } else if (colors.length > 0) {
        for (const color of colors) {
          variants.push({
            option1: color,
            price: formData.price,
            sku: `${formData.title.substring(0, 3).toUpperCase()}-${color}`.replace(/\s+/g, '-'),
          });
        }
      } else {
        variants.push({
          price: formData.price,
        });
      }

      // Prepare images
      const images = imageUrls.map(url => ({ 
        file_path: url.startsWith('http') ? url : `https://${url}`,
        alt: formData.title 
      }));

      // Create product using our internal API
      const response = await fetch('/api/shopify/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          body_html: formData.body,
          vendor: formData.vendor || 'VAULT 27',
          product_type: formData.product_type || 'Merchandise',
          tags: formData.tags,
          options,
          variants,
          images,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create product');
      }

      toast({
        title: "Success",
        description: "Product created successfully in Shopify",
      });
      
      setIsDialogOpen(false);
      resetForm();
      fetchProducts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create product",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (productId: number) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
      const response = await fetch(`/api/shopify/products/${productId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete product');

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
    });
    setEditingProduct(null);
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
                  <DialogTitle>Add Product to Shopify</DialogTitle>
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
                    {isProcessing ? "Creating..." : "Create Product in Shopify"}
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
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(product.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
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
