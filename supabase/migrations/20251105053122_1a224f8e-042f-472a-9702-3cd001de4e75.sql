-- Drop the old arrays that can't be easily edited
ALTER TABLE products DROP COLUMN IF EXISTS sizes;
ALTER TABLE products DROP COLUMN IF EXISTS colors;

-- Create product_variants table for proper inventory management
CREATE TABLE IF NOT EXISTS product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  size text,
  color text,
  stock integer DEFAULT 0 NOT NULL,
  sku text,
  shopify_variant_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(product_id, size, color)
);

-- Enable RLS on variants
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

-- RLS policies for variants
CREATE POLICY "Anyone can view variants"
  ON product_variants FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage variants"
  ON product_variants FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_product_variants_shopify_id ON product_variants(shopify_variant_id);

-- Update trigger for variants
CREATE TRIGGER update_product_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();