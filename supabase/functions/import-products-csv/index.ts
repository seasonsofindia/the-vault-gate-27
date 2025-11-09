import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProductRow {
  name: string;
  description: string;
  price: string;
  category: string;
  sizes?: string;
  colors?: string;
  images?: string;
  featured?: string;
  stock: string;
  // New format fields
  discount_price?: string;
  color?: string;
  size?: string;
  image_url?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the CSV content from request body
    const { csvContent } = await req.json();

    if (!csvContent) {
      throw new Error('No CSV content provided');
    }

    // Detect delimiter (comma or semicolon)
    const firstLine = csvContent.trim().split('\n')[0];
    const delimiter = firstLine.includes(';') ? ';' : ',';
    console.log('Detected delimiter:', delimiter);

    // Parse CSV
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(delimiter).map((h: string) => h.trim());
    
    console.log('CSV Headers:', headers);

    const products = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // CSV parser - handles quoted fields
      const values: string[] = [];
      let currentValue = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim());

      if (values.length < 7) continue; // Need at least basic fields

      const row: any = {};
      headers.forEach((header: string, index: number) => {
        row[header] = values[index] || '';
      });

      // Parse and clean the data
      try {
        let sizes: string[];
        let colors: string[];
        let images: string[];
        let discount = 0;

        // Detect format: new format has 'color', 'size', 'image_url' fields
        // Old format has 'colors', 'sizes', 'images' as JSON arrays
        if (row.color && row.size && row.image_url) {
          // New format - single variant per row
          sizes = [row.size];
          colors = [row.color];
          images = [row.image_url];
          discount = row.discount_price ? parseFloat(row.discount_price) : 0;
          console.log('Using new CSV format (single variant per row)');
        } else {
          // Old format - JSON arrays
          let sizesStr = row.sizes || '["One Size"]';
          let colorsStr = row.colors || '["Default"]';
          let imagesStr = row.images || '[]';

          // Remove excessive quote escaping
          sizesStr = sizesStr.replace(/""""/g, '"').replace(/^"|"$/g, '');
          colorsStr = colorsStr.replace(/""""/g, '"').replace(/^"|"$/g, '');
          imagesStr = imagesStr.replace(/""""/g, '"').replace(/^"|"$/g, '');

          sizes = JSON.parse(sizesStr);
          colors = JSON.parse(colorsStr);
          images = JSON.parse(imagesStr);
          console.log('Using old CSV format (JSON arrays)');
        }

        const product = {
          name: row.name,
          description: row.description,
          price: parseFloat(row.price),
          discount: discount,
          category: row.category,
          sizes: sizes,
          colors: colors,
          images: images,
          featured: row.featured?.toLowerCase() === 'true' || false,
          stock: parseInt(row.stock) || 0,
        };

        console.log('Parsed product:', product);
        products.push(product);
      } catch (parseError) {
        console.error('Error parsing row:', row, parseError);
        console.error('Raw values:', values);
      }
    }

    console.log(`Parsed ${products.length} products from CSV`);

    // Shopify Admin API credentials
    const SHOPIFY_ADMIN_API_KEY = Deno.env.get('SHOPIFY_ADMIN_API_KEY') || '';
    const SHOPIFY_STORE_DOMAIN = Deno.env.get('SHOPIFY_STORE_DOMAIN') || '';
    const SHOPIFY_API_VERSION = '2025-07';

    let createdCount = 0;

    // Insert products into database AND Shopify
    for (const product of products) {
      try {
        // Create in Shopify first
        const shopifyVariants = [];
        for (const size of product.sizes) {
          for (const color of product.colors) {
            shopifyVariants.push({
              option1: size,
              option2: color,
              price: product.price.toString(),
              inventory_quantity: product.stock,
              sku: `${product.name.substring(0, 3).toUpperCase()}-${size}-${color}`.replace(/\s+/g, '-'),
            });
          }
        }

        const shopifyProduct = {
          title: product.name,
          body_html: product.description,
          vendor: 'VAULT 27',
          product_type: product.category,
          variants: shopifyVariants,
          options: [
            { name: 'Size', values: product.sizes },
            { name: 'Color', values: product.colors }
          ],
          images: product.images.map((url: string) => ({ src: url }))
        };

        const shopifyResponse = await fetch(
          `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/products.json`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_KEY,
            },
            body: JSON.stringify({ product: shopifyProduct }),
          }
        );

        if (!shopifyResponse.ok) {
          const errorText = await shopifyResponse.text();
          console.error(`Shopify API error for ${product.name}:`, errorText);
          continue;
        }

        const shopifyData = await shopifyResponse.json();
        console.log('Created product in Shopify:', shopifyData.product.id);

        // Insert into database
        const { data: dbProduct, error: dbError } = await supabase
          .from('products')
          .insert({
            name: product.name,
            description: product.description,
            price: product.price,
            category: product.category,
            images: product.images,
            featured: product.featured,
            stock: 0,
            discount: product.discount || 0,
          })
          .select()
          .single();

        if (dbError) {
          console.error('DB insert error:', dbError);
          continue;
        }

        // Insert variants with Shopify IDs
        const variants = [];
        let variantIndex = 0;
        for (const size of product.sizes) {
          for (const color of product.colors) {
            const shopifyVariant = shopifyData.product.variants[variantIndex];
            variants.push({
              product_id: dbProduct.id,
              size,
              color,
              stock: product.stock,
              sku: `${product.name.substring(0, 3).toUpperCase()}-${size}-${color}`.replace(/\s+/g, '-'),
              shopify_variant_id: shopifyVariant?.id?.toString() || null,
            });
            variantIndex++;
          }
        }

        if (variants.length > 0) {
          const { error: variantsError } = await supabase
            .from('product_variants')
            .insert(variants);

          if (variantsError) {
            console.error('Variants insert error:', variantsError);
          }
        }

        createdCount++;
      } catch (error) {
        console.error('Error processing product:', product.name, error);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: createdCount,
        message: `Successfully imported ${createdCount} products to both database and Shopify`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Error importing CSV:', error);
    return new Response(
      JSON.stringify({ 
        error: error?.message || 'Unknown error',
        details: error?.toString() || 'No details available'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
