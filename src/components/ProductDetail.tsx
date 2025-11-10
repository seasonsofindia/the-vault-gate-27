import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { ShoppingCart, X } from "lucide-react";
import { ShopifyProduct } from "@/lib/shopify";
import { useCartStore } from "@/stores/cartStore";
import { toast } from "sonner";

interface ProductDetailProps {
  product: ShopifyProduct | null;
  open: boolean;
  onClose: () => void;
}

const ProductDetail = ({ product, open, onClose }: ProductDetailProps) => {
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const addItem = useCartStore(state => state.addItem);

  if (!product) return null;

  const { node } = product;
  const variants = node.variants.edges;
  const options = node.options;

  const handleOptionChange = (optionName: string, value: string) => {
    const newOptions = { ...selectedOptions, [optionName]: value };
    setSelectedOptions(newOptions);

    // Find matching variant
    const matchingVariant = variants.find(v => {
      return v.node.selectedOptions.every(opt => 
        newOptions[opt.name] === opt.value
      );
    });

    if (matchingVariant) {
      setSelectedVariantId(matchingVariant.node.id);
    }
  };

  const handleAddToCart = () => {
    const selectedVariant = variants.find(v => v.node.id === selectedVariantId);
    if (!selectedVariant) return;

    const cartItem = {
      product,
      variantId: selectedVariant.node.id,
      variantTitle: selectedVariant.node.title,
      price: selectedVariant.node.price,
      quantity: 1,
      selectedOptions: selectedVariant.node.selectedOptions
    };

    addItem(cartItem);
    toast.success("Added to cart", {
      description: `${node.title} has been added to your cart`
    });
    onClose();
  };

  const isAddToCartDisabled = options.length > 0 && !selectedVariantId;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute right-4 top-4 z-50"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="grid md:grid-cols-2 gap-8 pt-8">
          {/* Image Carousel */}
          <div>
            <Carousel className="w-full">
              <CarouselContent>
                {node.images.edges.map((image, index) => (
                  <CarouselItem key={index}>
                    <div className="aspect-square overflow-hidden rounded-lg bg-muted">
                      <img 
                        src={image.node.url}
                        alt={image.node.altText || `${node.title} - View ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {node.images.edges.length > 1 && (
                <>
                  <CarouselPrevious className="left-2" />
                  <CarouselNext className="right-2" />
                </>
              )}
            </Carousel>
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold mb-3">{node.title}</h2>
              <p className="text-2xl font-bold bg-[image:var(--gold-shine)] bg-clip-text text-transparent mb-4">
                ₹{parseFloat(node.priceRange.minVariantPrice.amount).toFixed(2)}
              </p>
              <p className="text-muted-foreground leading-relaxed">{node.description}</p>
            </div>

            {/* Options Selection */}
            {options.map((option) => (
              <div key={option.name}>
                <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider">{option.name}</h3>
                <div className="flex gap-2 flex-wrap">
                  {option.values.map((value) => (
                    <Button
                      key={value}
                      variant={selectedOptions[option.name] === value ? "default" : "outline"}
                      onClick={() => handleOptionChange(option.name, value)}
                      className="min-w-[60px]"
                    >
                      {value}
                    </Button>
                  ))}
                </div>
              </div>
            ))}

            {/* Stock Info */}
            {selectedVariantId && (
              <div className="pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  {variants.find(v => v.node.id === selectedVariantId)?.node.availableForSale 
                    ? "In Stock" 
                    : "Out of Stock"}
                </p>
              </div>
            )}

            {/* Add to Cart */}
            <Button 
              size="lg" 
              className="w-full bg-primary hover:bg-primary/90"
              disabled={isAddToCartDisabled}
              onClick={handleAddToCart}
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              Add to Cart
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductDetail;
