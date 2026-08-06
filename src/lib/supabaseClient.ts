import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cachedClient: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!url || !anonKey || url.includes('your-project-ref') || anonKey.includes('your-anon')) return null
  cachedClient ??= createClient(url, anonKey, {
    realtime: {
      params: { eventsPerSecond: 20 },
    },
  })
  return cachedClient
}
