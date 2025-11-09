import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const SHOPIFY_ADMIN_API_KEY = Deno.env.get('SHOPIFY_ADMIN_API_KEY') || '';
const SHOPIFY_STORE_DOMAIN = Deno.env.get('SHOPIFY_STORE_DOMAIN') || '';
const SHOPIFY_API_VERSION = '2025-07';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { shopifyVariantId, stock } = await req.json();

    if (!shopifyVariantId) {
      throw new Error('Shopify variant ID is required');
    }

    console.log(`Syncing inventory for variant ${shopifyVariantId} to ${stock}`);

    // Get variant to find inventory_item_id
    const variantResponse = await fetch(
      `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/variants/${shopifyVariantId}.json`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_KEY,
        },
      }
    );

    if (!variantResponse.ok) {
      throw new Error(`Failed to fetch variant: ${variantResponse.status}`);
    }

    const variantData = await variantResponse.json();
    const inventoryItemId = variantData.variant.inventory_item_id;

    // Get locations
    const locationsResponse = await fetch(
      `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/locations.json`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_KEY,
        },
      }
    );

    if (!locationsResponse.ok) {
      throw new Error(`Failed to fetch locations: ${locationsResponse.status}`);
    }

    const locationsData = await locationsResponse.json();
    const locationId = locationsData.locations[0]?.id;

    if (!locationId) {
      throw new Error('No location found');
    }

    // Update inventory level
    const inventoryResponse = await fetch(
      `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/inventory_levels/set.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_KEY,
        },
        body: JSON.stringify({
          location_id: locationId,
          inventory_item_id: inventoryItemId,
          available: stock,
        }),
      }
    );

    if (!inventoryResponse.ok) {
      const errorText = await inventoryResponse.text();
      console.error('Shopify inventory update error:', errorText);
      throw new Error(`Failed to update inventory: ${inventoryResponse.status}`);
    }

    const result = await inventoryResponse.json();
    console.log('Inventory updated successfully:', result);

    return new Response(
      JSON.stringify({ success: true, data: result }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in sync-inventory function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
