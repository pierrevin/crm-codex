// Shared database connection for Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

export const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// PostgreSQL connection via Supabase
export async function query(sql: string, params: any[] = []) {
  const { data, error } = await supabaseClient.rpc('exec_sql', {
    query: sql,
    params: JSON.stringify(params)
  })
  
  if (error) throw error
  return data
}

