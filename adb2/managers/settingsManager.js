// SettingsManager handles application settings: loading from and saving to localStorage,
// merging with defaults, and providing get/set methods for accessing and updating settings.
class SettingsManager {
  constructor(defaults, storageKey) {
    this.defaults = structuredClone(defaults);
    this.storageKey = storageKey;
    this.settings = this.load();
    this.applyTheme();
  }

  // Load settings from localStorage and merge with defaults
  load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      const base = raw ? JSON.parse(raw) : {};
      const merged = {
        ...structuredClone(this.defaults),
        ...base,
        hotkeys: { ...this.defaults.hotkeys, ...(base.hotkeys || {}) }
      };
      return this.sanitize(merged);
    } catch {
      return structuredClone(this.defaults);
    }
  }

  // Save current settings to localStorage
  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
    } catch (error) {
      console.error("SettingsManager.save: Failed to save settings to localStorage", error);
    }
  }

  // Get a setting value
  get(key) {
    if (!key || typeof key !== "string") {
      console.error("SettingsManager.get: Invalid key provided");
      return undefined;
    }
    if (!(key in this.settings)) {
      console.warn(`SettingsManager.get: Unknown setting key "${key}"`);
      return this.defaults[key];
    }
    return this.settings[key];
  }

  // Set a setting value and optionally save
  set(key, value, autoSave = true) {
    if (!key || typeof key !== "string") {
      console.error("SettingsManager.set: Invalid key provided");
      return;
    }
    if (!(key in this.defaults)) {
      console.warn(`SettingsManager.set: Unknown setting key "${key}"`);
    }
    this.settings[key] = value;
    if (autoSave) {
      this.save();
    }

    // Emit events for UI updates
    if (key === "columnOrder") {
      eventBus.emit("ui:column-order-changed");
    }
    if (key === "visibleColumns") {
      eventBus.emit("ui:column-visibility-changed");
    }
    if (key === "viewMode") {
      eventBus.emit("ui:view-changed", value);
    }

    // Specific settings change events
    if (key === "theme") {
      this.applyTheme();
      eventBus.emit("settings:theme-changed", value);
    }
    if (key === "language") {
      eventBus.emit("settings:language-changed", value);
    }
    if (key === "radioMode") {
      eventBus.emit("settings:radio-changed", value);
    }
    if (key === "fileHost") {
      eventBus.emit("settings:fileHost-changed", value);
    }

    // Notify generic settings change
    eventBus.emit("settings:changed", { key, value });
  }

  // Update multiple settings at once
  update(updates, autoSave = true) {
    Object.assign(this.settings, updates);
    if (autoSave) {
      this.save();
    }

    // Emit events for UI updates
    if ("columnOrder" in updates) {
      eventBus.emit("ui:column-order-changed");
    }
    if ("visibleColumns" in updates) {
      eventBus.emit("ui:column-visibility-changed");
    }
    if ("viewMode" in updates) {
      eventBus.emit("ui:view-changed", updates.viewMode);
    }

    // Specific settings change events
    if ("theme" in updates) {
      this.applyTheme();
      eventBus.emit("settings:theme-changed", updates.theme);
    }
    if ("language" in updates) {
      eventBus.emit("settings:language-changed", updates.language);
    }
    if ("radioMode" in updates) {
      eventBus.emit("settings:radio-changed", updates.radioMode);
    }
    if ("fileHost" in updates) {
      eventBus.emit("settings:fileHost-changed", updates.fileHost);
    }

    // Notify generic settings change
    eventBus.emit("settings:changed", { updates });
  }

  // Reset all settings to defaults
  reset() {
    this.settings = structuredClone(this.defaults);
    this.save();
  }

  // Reset all settings to defaults and apply to UI
  resetAllSettings() {
    // Reset to default settings
    this.reset();
    settingsModal.applyToUI();
    this.applyTheme();

    // Reset column order and visibility
    tableManager.table.applyColumnOrder();
    tableManager.table.applyColumnVisibility();

    showAlert("All settings have been reset to defaults", "success");
  }

  // Export current settings as a JSON file
  exportSettings() {
    const data = {
      type: "settings",
      timestamp: new Date().toISOString(),
      data: this.settings
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `adb2_settings_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    showAlert("Settings exported successfully", "success");
  }

  // Handle file import for settings or playlists
  async onImportFile(evt) {
    const file = evt.target.files?.[0];
    evt.target.value = ""; // Reset file input

    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!parsed.type || !parsed.data) {
        throw new Error("Invalid file format. Expected JSON with 'type' and 'data' fields.");
      }

      if (parsed.type === "settings") {
        // Import settings
        const newSettings = { ...DefaultSettings, ...parsed.data };
        const sanitized = this.sanitize(newSettings);
        this.update(sanitized, false); // Use update method instead of direct assignment
        this.save();
        settingsModal.applyToUI();
        this.applyTheme();
        showAlert("Settings imported successfully", "success");

      } else if (parsed.type === "playlists" || parsed.type === "playlist") {
        // Import playlists (both single playlist and multiple playlists)
        const existingPlaylists = playlistManager.loadAllPlaylists();
        const importedPlaylists = parsed.data || {};

        // Merge playlists, with imported ones taking precedence
        const mergedPlaylists = { ...existingPlaylists, ...importedPlaylists };

        // Update playlist manager's internal state
        playlistManager.playlists = mergedPlaylists;
        localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(mergedPlaylists));

        // Show appropriate success message
        if (parsed.type === "playlist") {
          const playlistName = Object.values(importedPlaylists)[0]?.name || "Unknown";
          showAlert(`Playlist "${playlistName}" imported successfully`, "success");
        } else {
          showAlert("Playlists imported successfully", "success");
        }

      } else {
        throw new Error(`Unknown import type: ${parsed.type}`);
      }

    } catch (err) {
      showAlert(`Import failed: ${err.message}`, "danger");
    }
  }

  // Validate and sanitize settings object with fallbacks to defaults
  sanitize(s) {
    const out = { ...structuredClone(this.defaults), ...s };

    const validTheme = new Set(["dark", "light"]);
    const validRadio = new Set(["none", "repeat", "loopAll"]);
    const validHost = new Set(["eudist", "nawdist", "naedist"]);
    const validLang = new Set(["english", "romaji"]);
    const validSearchMode = new Set(["simple", "advanced"]);

    if (!validTheme.has(out.theme)) out.theme = this.defaults.theme;
    if (!validRadio.has(out.radioMode)) out.radioMode = this.defaults.radioMode;
    if (!validHost.has(out.fileHost)) out.fileHost = this.defaults.fileHost;
    if (!validLang.has(out.language)) out.language = this.defaults.language;
    if (!validSearchMode.has(out.searchMode)) out.searchMode = this.defaults.searchMode;
    if (typeof out.zebraStripe !== "boolean") out.zebraStripe = this.defaults.zebraStripe;

    if (!out.hotkeys || typeof out.hotkeys !== "object") {
      out.hotkeys = { ...this.defaults.hotkeys };
    } else {
      const hk = { ...this.defaults.hotkeys, ...out.hotkeys };
      Object.keys(hk).forEach(k => hk[k] = typeof hk[k] === "string" ? hk[k] : "");
      out.hotkeys = hk;
    }

    if (!out.visibleColumns || typeof out.visibleColumns !== "object") {
      out.visibleColumns = { ...this.defaults.visibleColumns };
    } else {
      const vc = { ...this.defaults.visibleColumns, ...out.visibleColumns };
      Object.keys(vc).forEach(k => vc[k] = typeof vc[k] === "boolean" ? vc[k] : this.defaults.visibleColumns[k]);
      out.visibleColumns = vc;
    }

    if (!out.columnOrder || !Array.isArray(out.columnOrder)) {
      out.columnOrder = [...this.defaults.columnOrder];
    } else {
      // Validate that all column names are valid
      const validColumns = new Set(this.defaults.columnOrder);
      const filteredOrder = out.columnOrder.filter(col => validColumns.has(col));

      // Add any missing columns from defaults
      const missingColumns = this.defaults.columnOrder.filter(col => !filteredOrder.includes(col));
      out.columnOrder = [...filteredOrder, ...missingColumns];
    }

    return out;
  }

  // Apply theme to document
  applyTheme() {
    document.documentElement.setAttribute("data-bs-theme", this.settings.theme === "dark" ? "dark" : "light");
  }

  // Reset column visibility to defaults
  resetColumnVisibilityToDefault() {
    this.settings.visibleColumns = { ...this.defaults.visibleColumns };
    this.save();
    tableManager.table.applyColumnVisibility();
    // Update the column order list to reflect the new visibility settings
    settingsModal.renderColumnOrderList();
  }
}

const settingsManager = new SettingsManager(DefaultSettings, SETTINGS_KEY);
