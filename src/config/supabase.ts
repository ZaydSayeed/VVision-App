import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SUPABASE_URL = "https://xqqihmzbbqztfrvsbsnx.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxcWlobXpiYnF6dGZydnNic254Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4OTgzMjAsImV4cCI6MjA5MDQ3NDMyMH0.bstOKmv5I8kLmfKOtT2Ll58muLw4anhitQflzD1Iz4Y";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
