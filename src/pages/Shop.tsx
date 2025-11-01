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
      // Fetch products from database
      const { data: dbProducts, error } = await (supabase as any)
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Convert database products to Shopify format for component compatibility
      const formattedProducts = (dbProducts || []).map(convertToShopifyFormat);
      setProducts(formattedProducts);
      setFilteredProducts(formattedProducts);
    } catch (error: any) {
      toast({
        title: "Error Loading Products",
        description: error.message,
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
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/shop")}>
              <Vault className="w-6 h-6 md:w-8 md:h-8 text-primary" />
              <h1 className="text-lg md:text-2xl font-bold text-foreground">
                VAULT 27
              </h1>
            </div>
            
            <div className="flex items-center gap-2 md:gap-4">
              {userName && (
                <span className="text-xs md:text-sm text-muted-foreground hidden lg:block">
                  Welcome, {userName}
                </span>
              )}
              {isAdmin && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/admin")}
                    className="hidden md:flex"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Applications
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/products")}
                    className="hidden md:flex"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Products
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigate("/admin")}
                    className="md:hidden h-9 w-9"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </>
              )}
              <CartDrawer />
              <Button variant="ghost" size="sm" onClick={handleLogout} className="h-9 text-xs md:text-sm">
                <LogOut className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-muted to-background text-center py-12 md:py-20 px-4 md:px-6">
        <h2 className="text-3xl md:text-5xl font-bold mb-3 md:mb-4 text-foreground">
          Exclusive Collection
        </h2>
        <p className="text-base md:text-xl text-muted-foreground max-w-2xl mx-auto">
          Curated premium merchandise for VAULT 27 members
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
