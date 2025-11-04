import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Vault, LogOut, Settings, Search, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ProductCard from "@/components/ProductCard";
import ProductDetail from "@/components/ProductDetail";
import { Input } from "@/components/ui/input";
import { CartDrawer } from "@/components/CartDrawer";
import { ShopifyProduct } from "@/lib/shopify";
import { DatabaseProduct, convertToShopifyFormat } from "@/lib/productHelpers";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const Shop = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState("");
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ShopifyProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSize, setSelectedSize] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [allSizes, setAllSizes] = useState<string[]>([]);

  useEffect(() => {
    checkAuth();
    loadProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchQuery, selectedCategory, selectedSize]);

  useEffect(() => {
    // Extract unique categories and sizes from products
    const uniqueCategories = Array.from(
      new Set(products.map(p => p.node.productType).filter(Boolean))
    );
    setCategories(uniqueCategories);

    const uniqueSizes = Array.from(
      new Set(
        products.flatMap(p => 
          p.node.variants.edges.flatMap(v => 
            v.node.selectedOptions
              .filter(opt => opt.name.toLowerCase() === 'size')
              .map(opt => opt.value)
          )
        )
      )
    );
    setAllSizes(uniqueSizes);
  }, [products]);

  const checkAuth = async () => {
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
    setIsAdmin(hasAdminRole || false);

    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("name")
      .eq("id", session.user.id)
      .single();

    if (profile) {
      setUserName(profile.name);
    }
  };

  const loadProducts = async () => {
    try {
      // Fetch products from Shopify
      const { data: shopifyData, error: shopifyError } = await supabase.functions.invoke('shopify-products', {
        method: 'GET',
      });

      if (shopifyError) throw shopifyError;

      // Fetch products from local DB for additional metadata (featured, discount, etc.)
      const { data: dbProducts, error: dbError } = await (supabase as any)
        .from("products")
        .select("*");

      if (dbError) throw dbError;

      // Create a map of DB products by SKU for easy lookup
      const dbProductMap = new Map(
        (dbProducts || []).map((p: any) => [p.sku, p])
      );

      // Convert Shopify Admin API format to Storefront API format and merge with DB data
      const formattedProducts = (shopifyData.products || []).map((product: any) => {
        // Get the first variant's SKU to match with DB
        const variantSku = product.variants[0]?.sku;
        const dbProduct = variantSku ? dbProductMap.get(variantSku) : null;

        return {
          node: {
            id: product.id.toString(),
            title: product.title,
            description: product.body_html || '',
            handle: product.handle,
            productType: product.product_type || '',
            priceRange: {
              minVariantPrice: {
                amount: product.variants[0]?.price || '0',
                currencyCode: 'INR'
              }
            },
            images: {
              edges: (product.images || []).map((img: any) => ({
                node: {
                  url: img.src,
                  altText: img.alt || product.title
                }
              }))
            },
            variants: {
              edges: (product.variants || []).map((variant: any) => ({
                node: {
                  id: variant.id.toString(),
                  title: variant.title,
                  sku: variant.sku,
                  price: {
                    amount: variant.price,
                    currencyCode: 'INR'
                  },
                  availableForSale: true,
                  selectedOptions: [
                    variant.option1 && { name: product.options[0]?.name || 'Option', value: variant.option1 },
                    variant.option2 && { name: product.options[1]?.name || 'Option', value: variant.option2 },
                    variant.option3 && { name: product.options[2]?.name || 'Option', value: variant.option3 }
                  ].filter(Boolean)
                }
              }))
            },
            options: (product.options || []).map((opt: any) => ({
              name: opt.name,
              values: opt.values
            })),
            // Add DB metadata if available
            featured: (dbProduct as any)?.featured || false,
            discount: (dbProduct as any)?.discount || 0,
            dbStock: (dbProduct as any)?.stock,
            dbCategory: (dbProduct as any)?.category
          }
        };
      });
      
      setProducts(formattedProducts);
      setFilteredProducts(formattedProducts);
    } catch (error: any) {
      toast({
        title: "Error Loading Products",
        description: error.message || "Failed to fetch products from Shopify",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = products;

    if (searchQuery) {
      filtered = filtered.filter(p => 
        p.node.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.node.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedCategory !== "all") {
      filtered = filtered.filter(p => p.node.productType === selectedCategory);
    }

    if (selectedSize !== "all") {
      filtered = filtered.filter(p => 
        p.node.variants.edges.some(v =>
          v.node.selectedOptions.some(
            opt => opt.name.toLowerCase() === 'size' && opt.value === selectedSize
          )
        )
      );
    }

    setFilteredProducts(filtered);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged Out",
      description: "You've been logged out of VAULT 27",
    });
    navigate("/");
  };

  

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 border-b border-primary/20 bg-black backdrop-blur-md">
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-6">
              <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-foreground">
                VAULT <span className="text-primary">27</span>
              </h1>
              {userName && (
                <span className="text-xs md:text-sm text-muted-foreground hidden lg:block uppercase tracking-wide">
                  {userName}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2 md:gap-3">
              {isAdmin && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/admin")}
                    className="hidden md:flex border-primary text-primary hover:bg-primary hover:text-black"
                  >
                    Admin
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/products")}
                    className="hidden md:flex border-primary text-primary hover:bg-primary hover:text-black"
                  >
                    Products
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigate("/admin")}
                    className="md:hidden h-9 w-9 border-primary text-primary"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </>
              )}
              <CartDrawer />
              <Button variant="ghost" size="sm" onClick={handleLogout} className="h-9 text-xs md:text-sm hover:text-primary">
                <LogOut className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="bg-black border-b border-primary/20 text-center py-16 md:py-24 px-4 md:px-6">
        <h2 className="text-4xl md:text-6xl font-black mb-3 md:mb-4 text-foreground tracking-tighter">
          EXCLUSIVE <span className="text-primary">COLLECTION</span>
        </h2>
        <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto uppercase tracking-wide">
          Premium Tech-Luxury Products
        </p>
      </div>

      {/* Filters */}
      <div className="container mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="flex flex-col gap-3 md:gap-4 mb-6 md:mb-8">
          <div className="flex flex-col md:flex-row gap-3 md:gap-4">
            <div className="relative flex-1 md:max-w-96">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 md:w-5 md:h-5" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 md:pl-10 text-sm md:text-base h-10"
              />
            </div>
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full md:w-48 h-10">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedSize} onValueChange={setSelectedSize}>
              <SelectTrigger className="w-full md:w-48 h-10">
                <SelectValue placeholder="Size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sizes</SelectItem>
                {allSizes.map(size => (
                  <SelectItem key={size} value={size}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(selectedCategory !== "all" || selectedSize !== "all") && (
            <div className="flex gap-2 flex-wrap">
              {selectedCategory !== "all" && (
                <Badge variant="secondary" className="cursor-pointer text-xs" onClick={() => setSelectedCategory("all")}>
                  {selectedCategory} ×
                </Badge>
              )}
              {selectedSize !== "all" && (
                <Badge variant="secondary" className="cursor-pointer text-xs" onClick={() => setSelectedSize("all")}>
                  Size: {selectedSize} ×
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="text-center py-16 md:py-20">
            <p className="text-sm md:text-base text-muted-foreground">Loading products...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16 md:py-20">
            <p className="text-lg md:text-xl text-muted-foreground mb-3 md:mb-4">No products found</p>
            <p className="text-sm md:text-base text-muted-foreground">Create a product by telling me what you want to sell!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.node.id}
                product={product}
                onClick={() => setSelectedProduct(product)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      <ProductDetail
        product={selectedProduct}
        open={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
};

export default Shop;
