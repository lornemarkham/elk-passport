import { supabase } from "@/lib/supabase/client";

export default async function AuthTestPage() {
  return (
    <main style={{ padding: 32 }}>
      <h1>Auth Test</h1>

      <p>{process.env.NEXT_PUBLIC_SUPABASE_URL}</p>
    </main>
  );
}
