import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SHOPIFY_ADMIN_API_KEY = Deno.env.get('SHOPIFY_ACCESS_TOKEN')!;
const SHOPIFY_STORE_DOMAIN = 'vault27-uzutu.myshopify.com';
const SHOPIFY_API_VERSION = '2025-07';

async function shopifyRequest(endpoint: string, method: string = 'GET') {
  const url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/${endpoint}`;
  const response = await fetch(url, {
    method,
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.statusText}`);
  }

  return response.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch all products from Shopify
    const shopifyData = await shopifyRequest('products.json?limit=250');
    const products = shopifyData.products || [];

    console.log(`Fetched ${products.length} products from Shopify`);

    // Clear existing products in DB
    const { error: deleteError } = await supabaseClient
      .from('products')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteError) {
      console.error('Error clearing products:', deleteError);
      throw deleteError;
    }

    // Upsert products into database (update if name matches, insert if new)
    for (const product of products) {
      const firstVariant = product.variants[0];
      
      // Check if product exists by name
      const { data: existingProduct } = await supabaseClient
        .from('products')
        .select('id, name, description, category, price, featured, discount, stock, sku')
        .eq('name', product.title)
        .maybeSingle();

      let productId;
      
      if (existingProduct) {
        // Product exists - only update SKU and images if they're not set
        const updates: any = {};
        if (!existingProduct.sku) {
          updates.sku = firstVariant.sku;
        }
        
        const { data: updatedProduct } = await supabaseClient
          .from('products')
          .update(updates)
          .eq('id', existingProduct.id)
          .select('id')
          .single();
        
        productId = existingProduct.id;
        console.log(`Updated existing product: ${product.title}`);
      } else {
        // New product - insert all data
        const { data: newProduct, error: insertError } = await supabaseClient
          .from('products')
          .insert({
            sku: firstVariant.sku,
            name: product.title,
            description: product.body_html || '',
            category: product.product_type || 'Uncategorized',
            price: parseFloat(firstVariant.price),
            stock: 0, // Stock is managed at variant level now
            images: product.images.map((img: any) => img.src),
            featured: false,
            discount: 0,
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('Error inserting product:', insertError);
          continue;
        }

        productId = newProduct.id;
        console.log(`Inserted new product: ${product.title}`);
      }

      // Sync variants
      for (const variant of product.variants) {
        const size = variant.option1 || null;
        const color = variant.option2 || null;

        // Check if variant exists
        const { data: existingVariant } = await supabaseClient
          .from('product_variants')
          .select('id, stock')
          .eq('product_id', productId)
          .eq('shopify_variant_id', variant.id.toString())
          .maybeSingle();

        if (existingVariant) {
          // Variant exists - preserve stock, only update SKU if missing
          const variantUpdates: any = {};
          if (variant.sku) {
            variantUpdates.sku = variant.sku;
          }
          variantUpdates.size = size;
          variantUpdates.color = color;

          await supabaseClient
            .from('product_variants')
            .update(variantUpdates)
            .eq('id', existingVariant.id);
        } else {
          // New variant - insert with initial stock
          await supabaseClient
            .from('product_variants')
            .insert({
              product_id: productId,
              size,
              color,
              stock: variant.inventory_quantity || 0,
              sku: variant.sku,
              shopify_variant_id: variant.id.toString(),
            });
        }
      }
    }

    console.log(`Successfully synced ${products.length} products to database`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: products.length,
        message: 'Products synced successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error syncing products:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
