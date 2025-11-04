-- Add SKU column to products table for linking with Shopify
ALTER TABLE public.products
ADD COLUMN sku text UNIQUE;

-- Add index for faster SKU lookups
CREATE INDEX idx_products_sku ON public.products(sku);