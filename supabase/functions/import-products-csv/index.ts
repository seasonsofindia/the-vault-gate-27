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

    // Insert products into database
    const { data, error } = await supabase
      .from('products')
      .insert(products)
      .select();

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: products.length,
        products: data 
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
