const STORAGE_KEY = "pharmacy-dashboard-state-v1";
const AUTH_STORAGE_KEY = "pharmacy-dashboard-auth-v1";

const defaultState = () => {
  const saraId = createId();
  const yousefId = createId();

  return {
    patients: [
      { id: saraId, mrn: "MRN-1001", name: "Sara Ali", createdAt: todayISO(), lastVisit: todayISO() },
      { id: yousefId, mrn: "MRN-1002", name: "Yousef Mahdi", createdAt: todayISO(), lastVisit: todayISO() }
    ],
    inventory: [
      { id: createId(), name: "Amoxicillin", category: "Antibiotic", stock: 120, threshold: 25 },
      { id: createId(), name: "Metformin", category: "Diabetes", stock: 88, threshold: 20 },
      { id: createId(), name: "Paracetamol", category: "Pain Relief", stock: 18, threshold: 30 },
      { id: createId(), name: "Salbutamol", category: "Respiratory", stock: 7, threshold: 10 }
    ],
    prescriptions: [
      {
        id: createId(),
        date: todayISO(),
        patientId: saraId,
        patientMrn: "MRN-1001",
        patientName: "Sara Ali",
        drugName: "Metformin",
        frequency: "Twice daily",
        duration: "30 days",
        prescriber: "Dr. Omar Kareem"
      },
      {
        id: createId(),
        date: todayISO(),
        patientId: yousefId,
        patientMrn: "MRN-1002",
        patientName: "Yousef Mahdi",
        drugName: "Amoxicillin",
        frequency: "Three times daily",
        duration: "7 days",
        prescriber: "Dr. Ahmed Sami"
      }
    ]
  };
};

let state = loadLocalState();
let currentUser = null;
let patientFilter = "";
let database = null;
let databaseReady = false;

const elements = {
  app: document.getElementById("app"),
  loginForm: document.getElementById("login-form"),
  inventoryForm: document.getElementById("inventory-form"),
  prescriptionForm: document.getElementById("prescription-form"),
  loginMessage: document.getElementById("login-message"),
  patientLookupMessage: document.getElementById("patient-lookup-message"),
  dbStatus: document.getElementById("db-status"),
  username: document.getElementById("username"),
  password: document.getElementById("password"),
  roleBadge: document.getElementById("role-badge"),
  welcomeTitle: document.getElementById("welcome-title"),
  inventoryTable: document.getElementById("inventory-table"),
  patientTable: document.getElementById("patient-table"),
  prescriptionTable: document.getElementById("prescription-table"),
  totalMedicines: document.getElementById("total-medicines"),
  lowStockCount: document.getElementById("low-stock-count"),
  todayPrescriptions: document.getElementById("today-prescriptions"),
  totalPrescriptions: document.getElementById("total-prescriptions"),
  totalPatients: document.getElementById("total-patients"),
  logout: document.getElementById("logout"),
  seedReset: document.getElementById("seed-reset"),
  inventorySubmit: document.getElementById("inventory-submit"),
  prescriptionSubmit: document.getElementById("prescription-submit"),
  prescriptionDate: document.getElementById("prescription-date"),
  patientMrn: document.getElementById("patient-mrn"),
  patientName: document.getElementById("patient-name"),
  patientSearch: document.getElementById("patient-search"),
  prescribedDrug: document.getElementById("prescribed-drug"),
  prescriber: document.getElementById("prescriber"),
  actionPanel: document.querySelector(".action-panel")
};

elements.prescriptionDate.value = todayISO();

elements.loginForm.addEventListener("submit", handleLogin);
elements.inventoryForm.addEventListener("submit", handleInventorySave);
elements.prescriptionForm.addEventListener("submit", handlePrescriptionSave);
elements.logout.addEventListener("click", logout);
elements.seedReset.addEventListener("click", resetDemoData);
elements.patientMrn.addEventListener("input", handleMrnLookup);
elements.patientSearch.addEventListener("input", (event) => {
  patientFilter = event.currentTarget.value.trim();
  renderPatients();
  renderPrescriptions();
});

render();
initializeDatabase();

async function initializeDatabase() {
  setDatabaseStatus("Loading Supabase", "info");

  const config = await loadSupabaseConfig();
  if (!config) {
    setDatabaseStatus("Supabase config missing", "error");
    setMessage(elements.loginMessage, "Add SUPABASE_URL and SUPABASE_ANON_KEY in Vercel, then redeploy.", "error");
    return;
  }

  database = createSupabaseStore(config);

  try {
    const restored = await database.restoreSession();
    if (!restored) {
      setDatabaseStatus("Ready for sign in", "info");
      return;
    }

    currentUser = await database.loadCurrentUser();
    elements.prescriber.value = currentUser.name;
    state = await database.loadState();
    databaseReady = true;
    persistLocalState();
    setDatabaseStatus("Supabase connected", "success");
    render();
  } catch (error) {
    console.error(error);
    database.clearSession();
    currentUser = null;
    databaseReady = false;
    setDatabaseStatus("Sign in required", "warn");
    setMessage(elements.loginMessage, "Please sign in again.", "error");
  }
}

async function loadSupabaseConfig() {
  const inlineConfig = window.PHARMACY_CONFIG || {};
  if (inlineConfig.supabaseUrl && inlineConfig.supabaseAnonKey) {
    return normalizeConfig(inlineConfig);
  }

  try {
    const response = await fetch("/api/config", { headers: { Accept: "application/json" } });
    if (!response.ok) {
      return null;
    }
    return normalizeConfig(await response.json());
  } catch (error) {
    return null;
  }
}

function normalizeConfig(config) {
  const supabaseUrl = String(config.supabaseUrl || "").replace(/\/+$/, "");
  const supabaseAnonKey = String(config.supabaseAnonKey || "");

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return { supabaseUrl, supabaseAnonKey };
}

function createSupabaseStore(config) {
  const restUrl = `${config.supabaseUrl}/rest/v1`;
  const authUrl = `${config.supabaseUrl}/auth/v1`;
  let session = null;

  function getAuthToken() {
    return session?.access_token || "";
  }

  function getBaseHeaders() {
    return {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${getAuthToken() || config.supabaseAnonKey}`,
      "Content-Type": "application/json"
    };
  }

  function setSession(nextSession) {
    session = nextSession;
    if (!session?.access_token) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return;
    }

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  }

  function clearSession() {
    session = null;
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  async function authRequest(path, options = {}) {
    const response = await fetch(`${authUrl}${path}`, {
      ...options,
      headers: {
        apikey: config.supabaseAnonKey,
        "Content-Type": "application/json",
        ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Supabase auth failed: ${response.status} ${detail}`);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  async function refreshSession() {
    if (!session?.refresh_token) {
      return false;
    }

    const refreshed = await authRequest("/token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });

    setSession(refreshed);
    return true;
  }

  async function restoreSession() {
    const saved = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!saved) {
      return false;
    }

    try {
      setSession(JSON.parse(saved));
      const expiresAt = Number(session?.expires_at || 0);
      if (expiresAt && expiresAt < Math.floor(Date.now() / 1000) + 60) {
        return refreshSession();
      }
      return Boolean(session?.access_token);
    } catch (error) {
      clearSession();
      return false;
    }
  }

  async function request(path, options = {}, retry = true) {
    const response = await fetch(`${restUrl}${path}`, {
      ...options,
      headers: {
        ...getBaseHeaders(),
        ...(options.headers || {})
      }
    });

    if (response.status === 401 && retry && await refreshSession()) {
      return request(path, options, false);
    }

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Supabase request failed: ${response.status} ${detail}`);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  async function signIn(email, password) {
    const nextSession = await authRequest("/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    setSession(nextSession);
    return loadCurrentUser();
  }

  async function signOut() {
    if (getAuthToken()) {
      try {
        await authRequest("/logout", { method: "POST" });
      } catch (error) {
        console.warn("Supabase sign out failed; clearing local session.", error);
      }
    }
    clearSession();
  }

  async function loadCurrentUser() {
    const userId = session?.user?.id;
    if (!userId) {
      throw new Error("Missing Supabase user session.");
    }

    const rows = await request(`/profiles?select=*&user_id=eq.${encodeURIComponent(userId)}&limit=1`);
    if (!rows.length) {
      throw new Error("This account does not have a pharmacist or physician profile.");
    }

    return fromDbProfile(rows[0], session.user);
  }

  async function loadState() {
    const [patientsRaw, inventoryRaw, prescriptionsRaw] = await Promise.all([
      request("/patients?select=*&order=last_visit.desc,name.asc"),
      request("/inventory?select=*&order=name.asc"),
      request("/prescriptions?select=*&order=date.desc,created_at.desc")
    ]);

    const patients = patientsRaw.map(fromDbPatient);
    const patientsById = new Map(patients.map((patient) => [patient.id, patient]));
    const prescriptions = prescriptionsRaw.map((entry) => fromDbPrescription(entry, patientsById));

    return {
      patients,
      inventory: inventoryRaw.map(fromDbInventory),
      prescriptions
    };
  }

  async function upsertPatient(patient) {
    const rows = await request("/patients?on_conflict=mrn", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([toDbPatient(patient)])
    });
    return fromDbPatient(rows[0]);
  }

  async function insertInventory(item) {
    const rows = await request("/inventory", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([toDbInventory(item)])
    });
    return fromDbInventory(rows[0]);
  }

  async function updateInventory(item) {
    const rows = await request(`/inventory?id=eq.${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(toDbInventory(item))
    });
    return fromDbInventory(rows[0]);
  }

  async function insertPrescription(prescription) {
    const rows = await request("/prescriptions", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([toDbPrescription(prescription)])
    });
    return fromDbPrescription(rows[0], new Map(state.patients.map((patient) => [patient.id, patient])));
  }

  async function replaceWithDemo(demoState) {
    await request("/prescriptions?id=not.is.null", { method: "DELETE" });
    await request("/inventory?id=not.is.null", { method: "DELETE" });
    await request("/patients?id=not.is.null", { method: "DELETE" });

    const patientRows = await request("/patients", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(demoState.patients.map(toDbPatient))
    });
    const inventoryRows = await request("/inventory", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(demoState.inventory.map(toDbInventory))
    });
    const prescriptionRows = await request("/prescriptions", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(demoState.prescriptions.map(toDbPrescription))
    });

    const patients = patientRows.map(fromDbPatient);
    const patientsById = new Map(patients.map((patient) => [patient.id, patient]));

    return {
      patients,
      inventory: inventoryRows.map(fromDbInventory),
      prescriptions: prescriptionRows.map((entry) => fromDbPrescription(entry, patientsById))
    };
  }

  return {
    clearSession,
    restoreSession,
    signIn,
    signOut,
    loadCurrentUser,
    loadState,
    upsertPatient,
    insertInventory,
    updateInventory,
    insertPrescription,
    replaceWithDemo
  };
}

async function handleLogin(event) {
  event.preventDefault();

  if (!database) {
    setMessage(elements.loginMessage, "Supabase is not configured yet.", "error");
    return;
  }

  const email = elements.username.value.trim();
  const password = elements.password.value.trim();
  const submitButton = elements.loginForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  setMessage(elements.loginMessage, "Signing in...", "info");

  try {
    currentUser = await database.signIn(email, password);
    elements.prescriber.value = currentUser.name;
    databaseReady = true;
    setDatabaseStatus("Supabase connected", "success");
    setMessage(elements.loginMessage, `Logged in as ${currentUser.role}.`, "success");
    state = await database.loadState();
    persistLocalState();
    render();
  } catch (error) {
    console.error(error);
    database.clearSession();
    currentUser = null;
    databaseReady = false;
    setDatabaseStatus("Sign in failed", "error");
    setMessage(elements.loginMessage, "Invalid email/password or missing role profile.", "error");
  } finally {
    submitButton.disabled = false;
  }
}

async function handleInventorySave(event) {
  event.preventDefault();

  if (!currentUser || currentUser.role !== "pharmacist") {
    alert("Only pharmacists can update inventory.");
    return;
  }

  const formData = new FormData(event.currentTarget);
  const name = readString(formData, "drug-name");
  const category = readString(formData, "drug-category");
  const addedStock = readNumber(formData, "drug-stock");
  const threshold = readNumber(formData, "drug-threshold");

  elements.inventorySubmit.disabled = true;

  try {
    const existingItem = state.inventory.find(i => i.name.toLowerCase() === name.toLowerCase());

    if (existingItem) {
      // Update existing
      const updated = {
        ...existingItem,
        stock: existingItem.stock + addedStock,
        threshold: threshold > 0 ? threshold : existingItem.threshold,
        category: category || existingItem.category
      };
      
      const savedItem = databaseReady ? await database.updateInventory(updated) : updated;
      state.inventory = state.inventory.map(i => i.id === savedItem.id ? savedItem : i);
    } else {
      // Insert new
      let item = {
        id: createId(),
        name,
        category,
        stock: addedStock,
        threshold
      };
      
      if (databaseReady) {
        item = await database.insertInventory(item);
      }
      state.inventory.unshift(item);
    }

    persistLocalState();
    event.currentTarget.reset();
    render();
  } catch (error) {
    console.error(error);
    alert("Could not save medicine to Supabase. Please check your database connection and RLS policies.");
  } finally {
    elements.inventorySubmit.disabled = false;
  }
}

async function handlePrescriptionSave(event) {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  const date = readString(formData, "prescription-date") || todayISO();
  const mrn = normalizeMrn(readString(formData, "patient-mrn"));
  const patientName = readString(formData, "patient-name");

  if (!mrn || !patientName) {
    setMessage(elements.patientLookupMessage, "MRN and patient name are required.", "error");
    return;
  }

  elements.prescriptionSubmit.disabled = true;

  try {
    let patient = buildPatientRecord({ mrn, name: patientName, visitDate: date });

    if (databaseReady) {
      patient = await database.upsertPatient(patient);
    }

    upsertPatientInState(patient);

    let prescription = {
      id: createId(),
      date,
      patientId: patient.id,
      patientMrn: patient.mrn,
      patientName: patient.name,
      drugName: readString(formData, "prescribed-drug"),
      frequency: readString(formData, "frequency"),
      duration: readString(formData, "duration"),
      complaint: formData.getAll("complaint").map(s => String(s).trim()).filter(Boolean).join(", "),
      notes: readString(formData, "notes"),
      prescriber: readString(formData, "prescriber")
    };

    if (databaseReady) {
      prescription = await database.insertPrescription(prescription);
    }

    state.prescriptions.unshift(prescription);
    await dispenseInventoryItem(prescription.drugName);

    persistLocalState();
    event.currentTarget.reset();
    elements.prescriptionDate.value = todayISO();
    elements.prescriber.value = currentUser?.name || "";
    setMessage(elements.patientLookupMessage, `Treatment saved for ${patient.name} (${patient.mrn}).`, "success");
    render();
  } catch (error) {
    console.error(error);
    setMessage(elements.patientLookupMessage, `Error saving treatment: ${error.message}`, "error");
  } finally {
    elements.prescriptionSubmit.disabled = false;
  }
}

function handleMrnLookup() {
  const mrn = normalizeMrn(elements.patientMrn.value);

  if (!mrn) {
    setMessage(elements.patientLookupMessage, "", "");
    return;
  }

  const patient = findPatientByMrn(mrn);
  if (!patient) {
    setMessage(elements.patientLookupMessage, "New MRN: saving this treatment will create a patient record.", "info");
    return;
  }

  elements.patientName.value = patient.name;
  setMessage(elements.patientLookupMessage, `Found ${patient.name}. New treatment will be added to this record.`, "success");
}

async function logout() {
  if (database) {
    await database.signOut();
  }

  currentUser = null;
  patientFilter = "";
  databaseReady = false;
  elements.loginForm.reset();
  elements.prescriptionForm.reset();
  elements.patientSearch.value = "";
  elements.prescriptionDate.value = todayISO();
  setMessage(elements.loginMessage, "", "");
  setMessage(elements.patientLookupMessage, "", "");
  setDatabaseStatus(database ? "Ready for sign in" : "Supabase config missing", database ? "info" : "error");
  render();
}

async function resetDemoData() {
  if (currentUser?.role !== "pharmacist") {
    alert("Only pharmacists can reset dashboard data.");
    return;
  }

  if (!confirm("Reset medicines, patients, and treatment history to sample data?")) {
    return;
  }

  const demoState = defaultState();
  elements.seedReset.disabled = true;

  try {
    state = await database.replaceWithDemo(demoState);
    persistLocalState();
    patientFilter = "";
    elements.patientSearch.value = "";
    render();
  } catch (error) {
    console.error(error);
    alert("Could not reset Supabase data. Please check your table policies.");
  } finally {
    elements.seedReset.disabled = false;
  }
}

function render() {
  elements.app.classList.toggle("hidden", !currentUser);

  if (!currentUser) {
    return;
  }

  elements.roleBadge.textContent = currentUser.role;
  elements.welcomeTitle.textContent = `${currentUser.name}'s dashboard`;

  toggleRolePermissions();
  renderStats();
  renderInventory();
  renderPatients();
  renderPrescriptions();
  renderDrugDropdown();
}

function toggleRolePermissions() {
  const pharmacist = currentUser.role === "pharmacist";

  // Hide the section to add drugs for physicians
  elements.inventoryForm.style.display = pharmacist ? "flex" : "none";
  
  // Hide the section to write treatments for pharmacists
  elements.actionPanel.style.display = pharmacist ? "none" : "block";

  elements.seedReset.disabled = !pharmacist;
  elements.seedReset.title = pharmacist ? "" : "Only pharmacists can reset dashboard data.";
}

function disableForm(form, disabled) {
  [...form.elements].forEach((element) => {
    if (element.tagName === "BUTTON") {
      element.disabled = false;
      return;
    }
    element.disabled = disabled;
  });
}

function renderStats() {
  const lowStockCount = state.inventory.filter((item) => item.stock <= item.threshold).length;
  const today = todayISO();
  const todayPrescriptions = state.prescriptions.filter((item) => item.date === today).length;

  elements.totalMedicines.textContent = String(state.inventory.length);
  elements.lowStockCount.textContent = String(lowStockCount);
  elements.todayPrescriptions.textContent = String(todayPrescriptions);
  elements.totalPrescriptions.textContent = String(state.prescriptions.length);
  elements.totalPatients.textContent = String(state.patients.length);
}

function renderInventory() {
  const consolidated = new Map();
  for (const item of state.inventory) {
    const key = item.name.toLowerCase();
    if (consolidated.has(key)) {
      consolidated.get(key).stock += item.stock;
    } else {
      consolidated.set(key, { ...item });
    }
  }
  const uniqueInventory = Array.from(consolidated.values()).sort((a, b) => a.name.localeCompare(b.name));

  elements.inventoryTable.innerHTML = uniqueInventory
    .map((item) => {
      const status = getStockStatus(item);
      const action = currentUser.role === "pharmacist"
        ? `
          <div class="table-action">
            <button type="button" data-action="inc" data-id="${item.id}" aria-label="Increase ${escapeHtml(item.name)} stock">+1</button>
            <button type="button" data-action="dec" data-id="${item.id}" aria-label="Decrease ${escapeHtml(item.name)} stock">-1</button>
          </div>
        `
        : `<span class="muted-note">View only</span>`;

      return `
        <tr>
          <td data-label="Drug">${escapeHtml(item.name)}</td>
          <td data-label="Category">${escapeHtml(item.category)}</td>
          <td data-label="Stock">${item.stock}</td>
          <td data-label="Status"><span class="pill ${status.tone}">${status.label}</span></td>
          <td data-label="Update">${action}</td>
        </tr>
      `;
    })
    .join("");

  elements.inventoryTable.querySelectorAll("button[data-action]").forEach((button) => {
    button.addEventListener("click", () => adjustStock(button.dataset.id, button.dataset.action));
  });
}

function renderDrugDropdown() {
  const currentValue = elements.prescribedDrug.value;
  
  const consolidated = new Map();
  for (const item of state.inventory) {
    const key = item.name.toLowerCase();
    if (consolidated.has(key)) {
      consolidated.get(key).stock += item.stock;
    } else {
      consolidated.set(key, { ...item });
    }
  }
  const uniqueInventory = Array.from(consolidated.values());
  
  const byCategory = {};
  for (const item of uniqueInventory) {
    const cat = item.category || "Other";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  }
  
  const sortedCategories = Object.keys(byCategory).sort();
  const options = sortedCategories.map(cat => {
    const items = byCategory[cat].sort((a, b) => a.name.localeCompare(b.name));
    const optGroup = items.map(item => {
      const stockInfo = item.stock > 0 ? `${item.stock} in stock` : "Out of stock";
      return `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)} (${stockInfo})</option>`;
    }).join("");
    return `<optgroup label="${escapeHtml(cat)}">\n${optGroup}\n</optgroup>`;
  }).join("\n");
    
  elements.prescribedDrug.innerHTML = `<option value="">Select a medicine...</option>\n${options}`;
  
  if (currentValue && uniqueInventory.some(item => item.name === currentValue)) {
    elements.prescribedDrug.value = currentValue;
  }
}

function renderPatients() {
  const patients = getFilteredPatients();

  elements.patientTable.innerHTML = patients.length
    ? patients.map((patient) => {
      const treatmentCount = state.prescriptions.filter((entry) => entry.patientId === patient.id).length;

      return `
        <tr>
          <td data-label="MRN">${escapeHtml(patient.mrn)}</td>
          <td data-label="Patient">${escapeHtml(patient.name)}</td>
          <td data-label="Last visit">${formatDate(patient.lastVisit)}</td>
          <td data-label="Treatments">${treatmentCount}</td>
          <td data-label="Action">
            <button type="button" class="mini-btn" data-patient-id="${patient.id}">Use</button>
          </td>
        </tr>
      `;
    }).join("")
    : `<tr><td colspan="5" class="empty-state">No patients match this search.</td></tr>`;

  elements.patientTable.querySelectorAll("button[data-patient-id]").forEach((button) => {
    button.addEventListener("click", () => fillPatientFromRecord(button.dataset.patientId));
  });
}

function renderPrescriptions() {
  const patientIds = new Set(getFilteredPatients().map((patient) => patient.id));
  const shouldFilter = Boolean(patientFilter);

  const prescriptions = state.prescriptions
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((entry) => !shouldFilter || patientIds.has(entry.patientId) || matchesSearch(entry.patientMrn, patientFilter));

  elements.prescriptionTable.innerHTML = prescriptions.length
    ? prescriptions.map((entry) => `
      <tr>
        <td data-label="Date">${formatDate(entry.date)}</td>
        <td data-label="MRN">${escapeHtml(entry.patientMrn || "Unassigned")}</td>
        <td data-label="Patient">${escapeHtml(entry.patientName)}</td>
        <td data-label="Treatment">${escapeHtml(entry.drugName)}</td>
        <td data-label="Frequency">${escapeHtml(entry.frequency)}</td>
        <td data-label="Complaint">${escapeHtml(entry.complaint || "-")}</td>
        <td data-label="Notes">${escapeHtml(entry.notes || "-")}</td>
        <td data-label="Prescriber">${escapeHtml(entry.prescriber)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="8" class="empty-state">No treatment history found.</td></tr>`;
}

async function adjustStock(id, action) {
  if (currentUser.role !== "pharmacist") {
    return;
  }

  const item = state.inventory.find((entry) => entry.id === id);
  if (!item) {
    return;
  }

  const delta = action === "inc" ? 1 : -1;
  const updated = { ...item, stock: Math.max(0, item.stock + delta) };

  try {
    const savedItem = databaseReady ? await database.updateInventory(updated) : updated;
    state.inventory = state.inventory.map((entry) => entry.id === id ? savedItem : entry);
    persistLocalState();
    render();
  } catch (error) {
    console.error(error);
    alert("Could not update stock in Supabase.");
  }
}

function fillPatientFromRecord(patientId) {
  const patient = state.patients.find((entry) => entry.id === patientId);
  if (!patient) {
    return;
  }

  elements.patientMrn.value = patient.mrn;
  elements.patientName.value = patient.name;
  elements.prescribedDrug.focus();
  setMessage(elements.patientLookupMessage, `Ready to add a new treatment for ${patient.name}.`, "success");
}

function buildPatientRecord({ mrn, name, visitDate }) {
  const existing = findPatientByMrn(mrn);

  if (existing) {
    return {
      ...existing,
      name,
      lastVisit: newestDate(existing.lastVisit, visitDate)
    };
  }

  return {
    id: createId(),
    mrn,
    name,
    createdAt: todayISO(),
    lastVisit: visitDate
  };
}

function upsertPatientInState(patient) {
  const index = state.patients.findIndex((entry) => entry.id === patient.id || entry.mrn.toLowerCase() === patient.mrn.toLowerCase());

  if (index === -1) {
    state.patients.unshift(patient);
    return;
  }

  state.patients[index] = patient;
}

async function dispenseInventoryItem(drugName) {
  const inventoryItem = state.inventory.find((item) =>
    item.name.toLowerCase() === drugName.toLowerCase()
  );

  if (!inventoryItem || currentUser?.role !== "pharmacist") {
    return;
  }

  const updated = { ...inventoryItem, stock: Math.max(0, inventoryItem.stock - 1) };
  const savedItem = databaseReady ? await database.updateInventory(updated) : updated;
  state.inventory = state.inventory.map((item) => item.id === savedItem.id ? savedItem : item);
}

function getFilteredPatients() {
  return state.patients
    .slice()
    .sort((a, b) => b.lastVisit.localeCompare(a.lastVisit) || a.name.localeCompare(b.name))
    .filter((patient) => !patientFilter
      || matchesSearch(patient.mrn, patientFilter)
      || matchesSearch(patient.name, patientFilter));
}

function findPatientByMrn(mrn) {
  return state.patients.find((patient) => patient.mrn.toLowerCase() === mrn.toLowerCase());
}

function getStockStatus(item) {
  if (item.stock === 0) {
    return { label: "Out of stock", tone: "danger" };
  }
  if (item.stock <= item.threshold) {
    return { label: "Low stock", tone: "warn" };
  }
  return { label: "Healthy", tone: "good" };
}

async function refreshFromDatabase() {
  if (!databaseReady) {
    return;
  }

  try {
    state = await database.loadState();
    persistLocalState();
    render();
  } catch (error) {
    console.error(error);
    setDatabaseStatus("Supabase unavailable", "error");
  }
}

function loadLocalState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return defaultState();
  }

  try {
    return migrateState(JSON.parse(saved));
  } catch (error) {
    return defaultState();
  }
}

function migrateState(saved) {
  const base = defaultState();
  const migrated = {
    patients: Array.isArray(saved.patients) ? saved.patients : [],
    inventory: Array.isArray(saved.inventory) ? saved.inventory : base.inventory,
    prescriptions: Array.isArray(saved.prescriptions) ? saved.prescriptions : []
  };

  migrated.patients = migrated.patients.map((patient, index) => ({
    id: patient.id || createId(),
    mrn: normalizeMrn(patient.mrn || makeLegacyMrn(patient.name || "Patient", index)),
    name: patient.name || "Unknown Patient",
    createdAt: patient.createdAt || todayISO(),
    lastVisit: patient.lastVisit || patient.createdAt || todayISO()
  }));

  migrated.prescriptions = migrated.prescriptions.map((entry, index) => {
    const patientName = entry.patientName || "Unknown Patient";
    const mrn = normalizeMrn(entry.patientMrn || entry.mrn || makeLegacyMrn(patientName, index));
    let patient = migrated.patients.find((item) => item.mrn.toLowerCase() === mrn.toLowerCase());

    if (!patient) {
      patient = {
        id: entry.patientId || createId(),
        mrn,
        name: patientName,
        createdAt: entry.date || todayISO(),
        lastVisit: entry.date || todayISO()
      };
      migrated.patients.push(patient);
    }

    patient.lastVisit = newestDate(patient.lastVisit, entry.date || todayISO());

    return {
      ...entry,
      id: entry.id || createId(),
      date: entry.date || todayISO(),
      patientId: patient.id,
      patientMrn: patient.mrn,
      patientName: patient.name,
      drugName: entry.drugName || entry.treatment || "",
      frequency: entry.frequency || "",
      duration: entry.duration || "",
      prescriber: entry.prescriber || ""
    };
  });

  return migrated;
}

function persistLocalState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setDatabaseStatus(text, type) {
  if (!elements.dbStatus) {
    return;
  }

  elements.dbStatus.textContent = text;
  elements.dbStatus.className = `db-status ${type}`;
}

function fromDbProfile(row, authUser) {
  return {
    id: row.user_id,
    email: row.email || authUser?.email || "",
    username: row.username || "",
    name: row.full_name || authUser?.email || "Clinical user",
    role: row.role
  };
}

function fromDbPatient(row) {
  return {
    id: row.id,
    mrn: row.mrn,
    name: row.name,
    createdAt: row.created_at,
    lastVisit: row.last_visit
  };
}

function toDbPatient(patient) {
  return {
    id: patient.id,
    mrn: patient.mrn,
    name: patient.name,
    created_at: patient.createdAt || todayISO(),
    last_visit: patient.lastVisit || todayISO()
  };
}

function fromDbInventory(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    stock: Number(row.stock || 0),
    threshold: Number(row.threshold || 0)
  };
}

function toDbInventory(item) {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    stock: item.stock,
    threshold: item.threshold
  };
}

function fromDbPrescription(row, patientsById) {
  const patient = patientsById.get(row.patient_id);

  return {
    id: row.id,
    date: row.date,
    patientId: row.patient_id,
    patientMrn: patient?.mrn || "",
    patientName: patient?.name || "Unknown Patient",
    drugName: row.drug_name,
    frequency: row.frequency,
    duration: row.duration,
    complaint: row.complaint || "",
    notes: row.notes || "",
    prescriber: row.prescriber
  };
}

function toDbPrescription(prescription) {
  return {
    id: prescription.id,
    date: prescription.date,
    patient_id: prescription.patientId,
    drug_name: prescription.drugName,
    frequency: prescription.frequency,
    duration: prescription.duration,
    complaint: prescription.complaint,
    notes: prescription.notes,
    prescriber: prescription.prescriber
  };
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function newestDate(first, second) {
  return first && first.localeCompare(second) > 0 ? first : second;
}

function makeLegacyMrn(name, index) {
  const initials = String(name)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase() || "PT";

  return `LEG-${initials}-${String(index + 1).padStart(4, "0")}`;
}

function normalizeMrn(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "-");
}

function setMessage(element, text, type) {
  element.textContent = text;
  element.className = type ? `message ${type}` : "message";
}

function readString(formData, key) {
  return String(formData.get(key) || "").trim();
}

function readNumber(formData, key) {
  return Number(formData.get(key) || 0);
}

function formatDate(value) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function matchesSearch(value, query) {
  return String(value || "").toLowerCase().includes(String(query || "").toLowerCase());
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
