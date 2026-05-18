// ─────────────────────────────────────────────────────────────────────────────
// Pharmacy Dashboard – User Seed Script
// Run once:  node seed-users.js
// Requires Node 18+ (built-in fetch) or Node 16 with node-fetch installed.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL    = "https://gwqzyhqsubkxyeiwaytz.supabase.co";
const SERVICE_ROLE_KEY = "PASTE_YOUR_SERVICE_ROLE_KEY_HERE"; // ← replace this

// ── Accounts to create ───────────────────────────────────────────────────────
const users = [
  // Physicians
  { full_name: "Dr. Shkar Osman",   username: "shkar.osman",  role: "physician",   email: "shkar.osman@clinic.local",   password: "Dr.Shkar@2024"  },
  { full_name: "Dr. Bamo Muhsin",   username: "bamo.muhsin",  role: "physician",   email: "bamo.muhsin@clinic.local",   password: "Dr.Bamo@2024"   },
  { full_name: "Dr. Ariwan Saeed",  username: "ariwan.saeed", role: "physician",   email: "ariwan.saeed@clinic.local",  password: "Dr.Ariwan@2024" },
  { full_name: "Dr. Shwan Ali",     username: "shwan.ali",    role: "physician",   email: "shwan.ali@clinic.local",     password: "Dr.Shwan@2024"  },
  // Pharmacists
  { full_name: "Pharmacist One",    username: "pharmacist1",  role: "pharmacist",  email: "pharmacist1@clinic.local",   password: "Pharm1@2024"    },
  { full_name: "Pharmacist Two",    username: "pharmacist2",  role: "pharmacist",  email: "pharmacist2@clinic.local",   password: "Pharm2@2024"    },
  { full_name: "Bestwn",            username: "bestwn",       role: "pharmacist",  email: "bestwn@clinic.local",        password: "Bestwn@2024"    },
];

// ── Helper ────────────────────────────────────────────────────────────────────
async function createUser(user) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "apikey":        SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      email:            user.email,
      password:         user.password,
      email_confirm:    true,          // skip email confirmation
      user_metadata: {
        full_name: user.full_name,
        username:  user.username,
        role:      user.role,
      },
    }),
  });

  const body = await res.json();

  if (!res.ok) {
    // Already exists? Treat as warning, not fatal.
    const msg = body?.msg || body?.message || JSON.stringify(body);
    if (msg.toLowerCase().includes("already")) {
      return { status: "skipped (already exists)", user };
    }
    return { status: `ERROR – ${msg}`, user };
  }

  return { status: "created ✓", user };
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  if (SERVICE_ROLE_KEY === "PASTE_YOUR_SERVICE_ROLE_KEY_HERE") {
    console.error("\n❌  Please paste your Supabase service_role key into SERVICE_ROLE_KEY in this file.\n");
    process.exit(1);
  }

  console.log("\n🚀  Creating users…\n");
  const pad = (s, n) => s.padEnd(n);

  const results = [];
  for (const user of users) {
    const result = await createUser(user);
    results.push(result);
    console.log(`  ${pad(result.status, 22)} ${pad(user.role, 12)} ${user.full_name}`);
  }

  console.log("\n──────────────────────────────────────────────────────────────────────");
  console.log("  CREDENTIALS SUMMARY  (save this somewhere safe)");
  console.log("──────────────────────────────────────────────────────────────────────");
  console.log(pad("Name", 22), pad("Role", 12), pad("Email", 34), "Password");
  console.log("─".repeat(90));
  for (const { user } of results) {
    console.log(pad(user.full_name, 22), pad(user.role, 12), pad(user.email, 34), user.password);
  }
  console.log("──────────────────────────────────────────────────────────────────────\n");
})();
