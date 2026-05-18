export default function handler(request, response) {
  // Use Vercel environment variables if set, otherwise fall back to defaults.
  const supabaseUrl =
    process.env.SUPABASE_URL || "https://gwqzyhqsubkxyeiwaytz.supabase.co";
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3cXp5aHFzdWJreHllaXdheXR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1Nzk2MDgsImV4cCI6MjA5NDE1NTYwOH0.bI7_j-hZ3Xdu7DzkbAf4wRGoAhhI0VMdLW3BZTQGRvI";

  response.setHeader("Cache-Control", "no-store");
  response.status(200).json({ supabaseUrl, supabaseAnonKey });
}
