// =====================================================================
// === GLOBAL STATE, PERSISTENCE & UTILITIES ===
// =====================================================================

let state = { habits: [] }; // Global application state: stores all habits
const ROWS_CONTAINER = document.getElementById("rows"); // DOM element for habit rows
const WEEK_RANGE_DIV = document.getElementById('week-range'); // DOM element for week date range display

// Mapping for day header IDs in the HTML (D-6 to Today)
const WEEK_HEADER_DIVS = { 6: 'day-6-header', 5: 'day-5-header', 4: 'day-4-header', 3: 'day-3-header', 2: 'day-2-header', 1: 'day-1-header', 0: 'day-0-header' };

/** Formats a date object to YYYY-MM-DD string */
function formatDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Gets today's date key as string */
function todayKey() {
    return formatDate(new Date());
}

/** Generates a simple unique ID (used for new habits) */
function uuidv4() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

/** Creates a new habit object structure */
function newHabit(name) {
    return {
        id: uuidv4(),
        name: name,
        log: {} // Log for completed dates: { "YYYY-MM-DD": true }
    };
}

/** Loads state from localStorage */
function loadState() {
    try {
        const serializedState = localStorage.getItem('habitTrackerState');
        if (serializedState === null) {
            return { habits: [] };
        }
        const loaded = JSON.parse(serializedState);
        return loaded.habits ? loaded : { habits: [] };
    } catch (err) {
        console.error("Error loading state from localStorage:", err);
        return { habits: [] };
     }
}

/** Saves state to localStorage */
function saveState(newState) {
    try {
        const serializedState = JSON.stringify(newState);
        localStorage.setItem('habitTrackerState', serializedState);
    } catch (err) {
        console.error("Error saving state to localStorage:", err);
    }
}

/** * Sets up the date range for the tracker and updates header names.
 * Returns { keys: string[], displayNames: string[] }
 * MODIFIED: Now includes Day abbreviation and Date (e.g., "Mon 11/10").
 */
function setupDates() {
    const keys = [];
    const displayNames = [];
    const today = new Date();
    // Formatter for short weekday name (e.g., Mon)
    const weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' }); 
    // Formatter for short month/day (e.g., 11/10)
    const dateFormatter = new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit' });

    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        keys.push(formatDate(d));
        
        // Base format: 'Mon 11/10'
        let name = `${weekdayFormatter.format(d)} ${dateFormatter.format(d)}`;
        
        // Override names for the last two days
        if (i === 1) name = 'Yesterday';
        if (i === 0) name = 'Today';
        
        displayNames.push(name);
    }

    // Update day titles in HTML based on the new display names
    keys.forEach((key, index) => {
        const dayIndex = 6 - index;
        const headerId = WEEK_HEADER_DIVS[dayIndex];
        // The header IDs in the HTML were 'D-6', 'D-5', etc., but we update them here.
        if (headerId) {
            // Find the element that currently holds the D-X text
            const headerEl = document.getElementById(headerId);
            if (headerEl) headerEl.textContent = displayNames[index];
        }
    });
    
    // Update the overall week date range display
    if (keys.length === 7 && WEEK_RANGE_DIV) {
        WEEK_RANGE_DIV.textContent = `${new Date(keys[0]).toLocaleDateString()} – ${new Date(keys[6]).toLocaleDateString()}`;
    }

    return { keys: keys, displayNames: displayNames };
}

/** Computes the current streak length (consecutive days up to today) */
function computeStreak(habit, keys) {
    let streak = 0;
    // Check from today backwards
    for (let i = keys.length - 1; i >= 0; i--) {
        const dateKey = keys[i];
        if (habit.log[dateKey]) {
            streak++;
        } else {
            // Streak broken
            break;
        }
    }
    return streak;
}

// Initial setup of date keys
let weekData = setupDates();
let weekKeys = weekData.keys; 

// =====================================================================
// === 1. RENDER UI: Dynamic DOM Generation (State Reconciliation) ===
// =====================================================================

function render() {
    // Clear old content
    ROWS_CONTAINER.innerHTML = ""; 
    
    // Re-run date setup in case the day has changed
    weekData = setupDates();
    weekKeys = weekData.keys;

    // === EMPTY STATE: Show a placeholder row ===
    if (state.habits.length === 0) {
      // Code to create and append the "No habits yet" placeholder row...
      const row = document.createElement("div");
      row.setAttribute("style", "display:grid;grid-template-columns:1.6fr repeat(7,.9fr) .8fr 1fr;align-items:center;border-bottom:1px solid #eef2f6;");
      
      const nameCol = document.createElement("div");
      nameCol.setAttribute("style", "padding:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;");
      nameCol.textContent = "No habits yet";
      row.appendChild(nameCol);
      
      weekKeys.forEach(() => {
        const col = document.createElement("div");
        col.setAttribute("style", "padding:10px;text-align:center;");
        row.appendChild(col);
      });
      
      const streakCol = document.createElement("div");
      streakCol.setAttribute("style", "padding:10px;font-variant-numeric:tabular-nums;");
      streakCol.textContent = "0";
      row.appendChild(streakCol);
      
      const actionsCol = document.createElement("div");
      actionsCol.setAttribute("style", "padding:10px;color:#66788a;");
      actionsCol.textContent = "Add a habit";
      row.appendChild(actionsCol);
      
      ROWS_CONTAINER.appendChild(row);
      return; // Exit render early
    }

    // === POPULATED STATE: Build one row per habit ===
    state.habits.forEach(h => {
      // Create a new grid row for this habit
      const row = document.createElement("div");
      row.setAttribute("style", "display:grid;grid-template-columns:1.6fr repeat(7,.9fr) .8fr 1fr;align-items:center;border-bottom:1px solid #eef2f6;");

      // === COLUMN 1: Habit Name ===
      const nameCol = document.createElement("div");
      nameCol.setAttribute("style", "padding:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;");
      nameCol.textContent = h.name;
      row.appendChild(nameCol);

      // === COLUMNS 2-8: Last 7 Days Toggle Buttons ===
      weekKeys.forEach((k, index) => {
        const col = document.createElement("div");
        col.setAttribute("style", "padding:10px;text-align:center;");

        // Interactive button acting as a checkbox
        const btn = document.createElement("button");
        btn.type = "button";
        // Accessibility: describes the button
        btn.setAttribute("aria-label", `${h.name} on ${weekData.displayNames[index]}`); 
        btn.setAttribute("role", "checkbox"); 
        
        // Disable if the date is in the future
        const isFutureDay = k > todayKey();
        btn.disabled = isFutureDay;

        // Check status from habit log
        const checked = !!h.log[k];
        btn.setAttribute("aria-checked", String(checked)); 
        btn.textContent = checked ? "✓" : ""; 

        // Store IDs for event handling
        btn.dataset.habitId = h.id;
        btn.dataset.dateKey = k;

        // Conditional styling based on status and future date
        let btnStyle = `display:flex;align-items:center;justify-content:center;width:36px;height:36px;margin:auto;border-radius:8px;border:1px solid #dbe7f0;cursor:${isFutureDay ? 'default' : 'pointer'};user-select:none;font-size:16px;line-height:1;`;
        if (isFutureDay) {
            btnStyle += `background:#f8f8f8; color:#cccccc;`;
        } else if (checked) {
            btnStyle += `background:#e9f8ef; color:#1e9e4a;font-weight:700;`;
        } else {
          btnStyle += `background:#fff; color:#dbe7f0;font-weight:400;`;
        }
        btn.setAttribute("style", btnStyle);

        // Add click handler for toggling the day
        if (!isFutureDay) {
            btn.addEventListener("click", onToggleDay);
        }

        // Add keyboard handler (Space/Enter)
        btn.addEventListener("keydown", e => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            if (!isFutureDay) {
                btn.click();
            }
          }
        });

        col.appendChild(btn);
        row.appendChild(col);
      });

      // === COLUMN 9: Current Streak Count ===
      const streakCol = document.createElement("div");
      streakCol.setAttribute("style", "padding:10px;font-variant-numeric:tabular-nums;");
      streakCol.textContent = String(computeStreak(h, weekKeys));
      row.appendChild(streakCol);

      // === COLUMN 10: Action Buttons (Tick Today, Delete) ===
      const actions = document.createElement("div");
      actions.setAttribute("style", "padding:10px;display:flex;gap:8px;flex-wrap:wrap;");

      // Button to quickly mark today's date
      const tick = document.createElement("button");
      tick.type = "button";
      tick.textContent = "Tick today";
      tick.setAttribute("style", "background:#fff;border:1px solid #dbe7f0;color:#0b3b58;padding:6px 10px;border-radius:8px;cursor:pointer;");
      tick.addEventListener("click", () => toggleLog(h.id, todayKey()));

      // Button to delete habit
      const del = document.createElement("button");
      del.type = "button";
      del.textContent = "Delete";
      del.setAttribute("style", "background:#fff;border:1px solid #f2c9cd;color:#c71f23;padding:6px 10px;border-radius:8px;cursor:pointer;");
      del.addEventListener("click", () => {
        if (confirm(`Delete habit "${h.name}"?`)) {
          state.habits = state.habits.filter(x => x.id !== h.id);
          saveState(state); // Save after deletion
          render(); // Re-render UI
        }
      });

      actions.appendChild(tick);
      actions.appendChild(del);
      row.appendChild(actions);

      // Append the completed row to the table body
      ROWS_CONTAINER.appendChild(row);
    });
}

// =====================================================================
// === 2. EVENT HANDLING & STATE MUTATION ===
// =====================================================================

// Event handler for a day button click
function onToggleDay(e) {
  // Get habit ID and date key from the clicked button's data attributes
  const btn = e.currentTarget;
  const habitId = btn.dataset.habitId;
  const dateKey = btn.dataset.dateKey;
  toggleLog(habitId, dateKey);
}

// Core function to log or un-log a day for a habit
function toggleLog(habitId, dateKey) {
  // Find the habit object by ID
  const h = state.habits.find(x => x.id === habitId);
  if (!h) return; 
    
    // Prevent logging future days
    if (dateKey > todayKey()) {
        console.warn("Attempted to log a future day.");
        return;
    }

  // Toggle log entry: if it exists, delete it (uncheck); otherwise, set to true (check)
  if (h.log[dateKey]) {
    delete h.log[dateKey]; 
  } else {
    h.log[dateKey] = true; 
  }

  // Persist and redraw
  saveState(state); 
  render(); 
}

// =====================================================================
// === 3. FORM HANDLING: Add new habits ===
// =====================================================================
// Listener for the "Add habit" form submission
document.getElementById("habit-form").addEventListener("submit", (e) => {
  e.preventDefault(); // Stop page reload
  const input = document.getElementById("habit-name");
  const name = input.value.trim(); 
  if (!name) return; // Ignore empty input

  // Add new habit to state
  state.habits.push(newHabit(name));
  saveState(state);
  input.value = ""; // Clear input
  render(); // Update UI
});

// =====================================================================
// === 4. DATA MANAGEMENT: Export, Import, Reset ===
// =====================================================================

// === EXPORT: Save current state as downloadable JSON file ===
document.getElementById("export-json").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  // Create and trigger temporary download link
  const url = URL.createObjectURL(blob); 
  const a = document.createElement("a");
  a.href = url;
  a.download = "habits-export.json"; 
  a.click(); 
  URL.revokeObjectURL(url); 
});

// === IMPORT: Load habits from uploaded JSON file ===
document.getElementById("import-json").addEventListener("change", async (e) => {
  const file = e.target.files?.[0]; 
  if (!file) return;

  try {
    const text = await file.text(); // Read file content
    const data = JSON.parse(text); // Parse JSON
    // Basic validation
    if (!Array.isArray(data.habits)) throw new Error("Invalid format");

   // Replace current state
    state = data; 
    saveState(state);
    render();
    alert("Import complete. Data loaded.");
  } catch (err) {
    alert("Import failed. Please check the JSON file format.");
  }
  e.target.value = ""; // Clear file input
});

// === RESET: Wipe all data after user confirmation ===
document.getElementById("reset-all").addEventListener("click", () => {
  // Confirm action
  if (!confirm("Are you sure? This will permanently remove all habits and logs from this browser.")) return;

  // Reset state to empty
  state = { habits: [] }; 
  saveState(state);
  render();
  alert("All data reset.");
});

// =====================================================================
// === 5. START APP: Initial render on page load ===
// =====================================================================
// Load data from storage and draw the UI when the script runs
state = loadState(); 
render();