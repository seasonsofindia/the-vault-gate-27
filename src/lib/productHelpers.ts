import { ShopifyProduct } from "./shopify";

// Import product images
import productJacketBlack from "@/assets/product-jacket-black.jpg";
import productShirtWhite from "@/assets/product-shirt-white.jpg";
import productJeansNavy from "@/assets/product-jeans-navy.jpg";
import productWatchGold from "@/assets/product-watch-gold.jpg";
import productBootsBlack from "@/assets/product-boots-black.jpg";
import productSweaterBeige from "@/assets/product-sweater-beige.jpg";

// Database product type
export interface DatabaseProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  sizes: string[];
  colors: string[];
  images: string[];
  featured: boolean;
  stock: number;
  discount?: number;
  created_at: string;
  updated_at: string;
}

// Image mapping for local assets
const imageMap: Record<string, string> = {
  "product-jacket-black.jpg": productJacketBlack,
  "product-shirt-white.jpg": productShirtWhite,
  "product-jeans-navy.jpg": productJeansNavy,
  "product-watch-gold.jpg": productWatchGold,
  "product-boots-black.jpg": productBootsBlack,
  "product-sweater-beige.jpg": productSweaterBeige,
};

// Helper to get image URL (supports both local assets and external URLs)
export const getImageUrl = (imagePath: string): string => {
  // Check if it's a full URL
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  
  // Check if it's a local asset
  if (imageMap[imagePath]) {
    return imageMap[imagePath];
  }
  
  // Default fallback
  return imagePath;
};

// Convert database product to Shopify format for compatibility with existing components
export const convertToShopifyFormat = (dbProduct: DatabaseProduct): ShopifyProduct => {
  // Create variants for each size/color combination
  const variants = [];
  
  if (dbProduct.sizes.length > 0 && dbProduct.colors.length > 0) {
    for (const size of dbProduct.sizes) {
      for (const color of dbProduct.colors) {
        variants.push({
          node: {
            id: `${dbProduct.id}-${size}-${color}`,
            title: `${size} / ${color}`,
            price: {
              amount: dbProduct.price.toString(),
              currencyCode: "USD"
            },
            availableForSale: dbProduct.stock > 0,
            selectedOptions: [
              { name: "Size", value: size },
              { name: "Color", value: color }
            ]
          }
        });
      }
    }
  } else if (dbProduct.sizes.length > 0) {
    for (const size of dbProduct.sizes) {
      variants.push({
        node: {
          id: `${dbProduct.id}-${size}`,
          title: size,
          price: {
            amount: dbProduct.price.toString(),
            currencyCode: "USD"
          },
          availableForSale: dbProduct.stock > 0,
          selectedOptions: [
            { name: "Size", value: size }
          ]
        }
      });
    }
  } else if (dbProduct.colors.length > 0) {
    for (const color of dbProduct.colors) {
      variants.push({
        node: {
          id: `${dbProduct.id}-${color}`,
          title: color,
          price: {
            amount: dbProduct.price.toString(),
            currencyCode: "USD"
          },
          availableForSale: dbProduct.stock > 0,
          selectedOptions: [
            { name: "Color", value: color }
          ]
        }
      });
    }
  } else {
    // No variants
    variants.push({
      node: {
        id: dbProduct.id,
        title: "Default",
        price: {
          amount: dbProduct.price.toString(),
          currencyCode: "USD"
        },
        availableForSale: dbProduct.stock > 0,
        selectedOptions: []
      }
    });
  }

  // Create options
  const options = [];
  if (dbProduct.sizes.length > 0) {
    options.push({
      name: "Size",
      values: dbProduct.sizes
    });
  }
  if (dbProduct.colors.length > 0) {
    options.push({
      name: "Color",
      values: dbProduct.colors
    });
  }

  // Convert images
  const images = dbProduct.images.map(img => ({
    node: {
      url: getImageUrl(img),
      altText: dbProduct.name
    }
  }));

  return {
    node: {
      id: dbProduct.id,
      title: dbProduct.name,
      description: dbProduct.description,
      handle: dbProduct.name.toLowerCase().replace(/\s+/g, '-'),
      productType: dbProduct.category,
      discount: dbProduct.discount,
      priceRange: {
        minVariantPrice: {
          amount: dbProduct.price.toString(),
          currencyCode: "INR"
        }
      },
      images: {
        edges: images
      },
      variants: {
        edges: variants
      },
      options
    }
  };
};
