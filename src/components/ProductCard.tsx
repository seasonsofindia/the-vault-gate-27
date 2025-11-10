import { Card } from "@/components/ui/card";
import { ShopifyProduct } from "@/lib/shopify";

interface ProductCardProps {
  product: ShopifyProduct;
  onClick: () => void;
}

const ProductCard = ({ product, onClick }: ProductCardProps) => {
  const { node } = product;
  const imageUrl = node.images.edges[0]?.node.url;
  const price = parseFloat(node.priceRange.minVariantPrice.amount);
  const discount = node.discount || 0;
  const discountedPrice = discount > 0 ? price * (1 - discount / 100) : price;

  return (
    <Card 
      className="group overflow-hidden cursor-pointer border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg"
      onClick={onClick}
    >
      <div className="aspect-[3/4] overflow-hidden bg-muted">
        {imageUrl ? (
          <img 
            src={imageUrl}
            alt={node.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <span className="text-muted-foreground">No image</span>
          </div>
        )}
      </div>
      <div className="p-3 md:p-6">
        <h3 className="text-sm md:text-lg font-semibold mb-2 group-hover:text-primary transition-colors line-clamp-2">{node.title}</h3>
        <div className="flex flex-col gap-1">
          {discount > 0 && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs md:text-sm text-muted-foreground line-through">₹{price.toFixed(2)}</span>
                <span className="text-xs md:text-sm font-bold text-red-600">{discount}% OFF</span>
              </div>
              <p className="text-base md:text-xl font-bold text-muted-foreground">
                ₹{discountedPrice.toFixed(2)}
              </p>
            </>
          )}
          {discount === 0 && (
            <p className="text-base md:text-xl font-bold text-foreground">
              ₹{price.toFixed(2)}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};

export default ProductCard;
