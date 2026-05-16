export default function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json({
    supabaseUrl: "https://gwqzyhqsubkxyeiwaytz.supabase.co",
    supabaseAnonKey: "sb_publishable_ZMg6nikWqalxhnH1HzDjYg_qRc9-YdA"
  });
}
