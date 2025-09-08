// HotkeyManager handles the initialization, configuration, and global handling of user-defined
// keyboard shortcuts (hotkeys) for various actions in the application.
class HotkeyManager {
  constructor() {
    this.isInitialized = false;
    this.hotkeyInputs = {};
    this.globalHotkeyHandler = null;
  }

  // Initializes hotkey input fields and sets up global hotkey handling
  initialize() {
    if (this.isInitialized) return;

    this.setupHotkeyInputs();
    this.setupGlobalHotkeys();
    this.isInitialized = true;
  }

  // Sets up hotkey input fields for settings
  setupHotkeyInputs() {
    const hotkeyTypes = ["downloadJson", "playPause", "prev", "next"];
    const elementIds = {
      downloadJson: "hkDownloadJson",
      playPause: "hkPlayPause",
      prev: "hkPrev",
      next: "hkNext"
    };

    hotkeyTypes.forEach(keyName => {
      const element = document.getElementById(elementIds[keyName]);
      if (!element) return;

      // Set current value
      element.value = settingsManager.get("hotkeys")[keyName] || "";

      // Add event listener
      element.addEventListener("keydown", e => this.captureHotkey(e, element, keyName));

      // Store reference
      this.hotkeyInputs[keyName] = element;
    });
  }

  // Sets up global hotkey handling
  setupGlobalHotkeys() {
    this.globalHotkeyHandler = e => this.handleGlobalHotkeys(e);
    document.addEventListener("keydown", this.globalHotkeyHandler);
  }

  // Captures and validates hotkey combinations for settings
  captureHotkey(e, element, keyName) {
    e.preventDefault();
    e.stopPropagation();

    // Handle escape key
    if (e.key === "Escape") return;

    // Handle clear keys
    if (["Backspace", "Delete"].includes(e.key)) {
      this.clearHotkey(keyName, element);
      return;
    }

    // Normalize the combination
    const combo = this.normalizeCombo(e);
    if (!combo) return;

    // Check for conflicts
    if (this.hasConflict(keyName, combo)) {
      this.showConflictError(element);
      return;
    }

    // Save the hotkey
    this.saveHotkey(keyName, combo, element);
  }

  // Clears a hotkey
  clearHotkey(keyName, element) {
    const hotkeys = { ...settingsManager.get("hotkeys") };
    hotkeys[keyName] = "";
    settingsManager.set("hotkeys", hotkeys);
    element.value = "";
  }

  // Checks if a hotkey combination conflicts with existing ones
  hasConflict(keyName, combo) {
    const hotkeys = settingsManager.get("hotkeys");
    for (const [k, v] of Object.entries(hotkeys)) {
      if (k !== keyName && v && v === combo) {
        return true;
      }
    }
    return false;
  }

  // Shows conflict error on input element
  showConflictError(element) {
    element.classList.add("is-invalid");
    setTimeout(() => element.classList.remove("is-invalid"), 600);
  }

  // Saves a hotkey combination
  saveHotkey(keyName, combo, element) {
    const hotkeys = { ...settingsManager.get("hotkeys") };
    hotkeys[keyName] = combo;
    settingsManager.set("hotkeys", hotkeys);
    element.value = combo.replaceAll("+", " + ");
  }

  // Normalizes keyboard event into a standardized hotkey combination string
  normalizeCombo(e) {
    const key = (e.key || "").toUpperCase();

    // Ignore modifier-only keys
    if (["SHIFT", "CONTROL", "ALT", "META"].includes(key)) return "";

    const parts = [];

    // Add modifiers
    if (e.ctrlKey) parts.push("CTRL");
    if (e.metaKey) parts.push("META");
    if (e.altKey) parts.push("ALT");
    if (e.shiftKey) parts.push("SHIFT");

    // Add the main key
    let normalizedKey = key;
    if (normalizedKey === " ") normalizedKey = "SPACE";
    if (normalizedKey.startsWith("ARROW")) {
      normalizedKey = normalizedKey.replace("ARROW", "");
    }

    parts.push(normalizedKey);
    return parts.join("+");
  }

  // Handles global hotkey events throughout the application
  handleGlobalHotkeys(e) {
    // Don't handle hotkeys in input fields
    const tag = (document.activeElement?.tagName || "").toLowerCase();
    const editable = document.activeElement?.isContentEditable;
    if (["input", "textarea", "select"].includes(tag) || editable) return;

    // Handle info modal navigation
    if (this.handleInfoModalNavigation(e)) return;

    // Handle custom hotkeys
    const combo = this.normalizeCombo(e);
    if (!combo) return;

    this.executeHotkey(combo);
  }

  // Handles arrow key navigation in info modal
  handleInfoModalNavigation(e) {
    const modal = document.getElementById("infoModal");
    if (!modal || !modal.classList.contains("show")) return false;

    const key = (e.key || "").toUpperCase();
    if (!["ARROWLEFT", "ARROWRIGHT", "ARROWUP", "ARROWDOWN"].includes(key)) return false;

    e.preventDefault();

    switch (key) {
      case "ARROWLEFT":
      case "ARROWUP":
        eventBus.emit("modal:info-prev");
        return true;
      case "ARROWRIGHT":
      case "ARROWDOWN":
        eventBus.emit("modal:info-next");
        return true;
    }

    return false;
  }

  // Executes a hotkey action
  executeHotkey(combo) {
    const hotkeys = settingsManager.get("hotkeys");

    switch (combo) {
      case hotkeys.downloadJson:
        return tableManager.export("json");
      case hotkeys.playPause:
        return eventBus.emit("audio:toggle-play-pause");
      case hotkeys.prev:
        return eventBus.emit("audio:previous");
      case hotkeys.next:
        return eventBus.emit("audio:next");
    }
  }

  // Refreshes hotkey input values from settings
  refreshHotkeyInputs() {
    const hotkeys = settingsManager.get("hotkeys");

    Object.entries(this.hotkeyInputs).forEach(([keyName, element]) => {
      if (element) {
        element.value = hotkeys[keyName] || "";
      }
    });
  }

  // Destroys the hotkey manager and removes event listeners
  destroy() {
    if (this.globalHotkeyHandler) {
      document.removeEventListener("keydown", this.globalHotkeyHandler);
      this.globalHotkeyHandler = null;
    }

    // Remove input event listeners
    Object.values(this.hotkeyInputs).forEach(element => {
      if (element) {
        element.removeEventListener("keydown", this.captureHotkey);
      }
    });

    this.hotkeyInputs = {};
    this.isInitialized = false;
  }
}

const hotkeyManager = new HotkeyManager();
