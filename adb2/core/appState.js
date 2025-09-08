// Centralized state management system
class AppState {
  constructor() {
    this.state = {
      // Data state (compatible with existing code)
      songs: {
        raw: [], // Original song data
        visible: [], // Currently visible songs
        removedKeys: new Set() // Keys of removed songs
      },
      playlists: new Map(), // playlistId -> PlaylistData

      // Table state (compatible with existing code)
      table: {
        sort: { column: null, dir: null },
        manualOrderActive: false
      },

      // UI state
      ui: {
        currentView: "table", // "table" | "cards"
        visibleColumns: new Set(),
        searchQuery: "",
        currentPage: 1,
        selectedSongId: null,
        resultMode: "new" // "new" | "append"
      },

      // Audio state
      audio: {
        currentSongId: null,
        isPlaying: false,
        volume: 1.0,
        currentTime: 0,
        duration: 0,
        radioMode: "none" // "none" | "repeat" | "loopAll"
      },

      // Settings state
      settings: {
        theme: "dark",
        fileHost: "nawdist",
        language: "english",
        searchMode: "simple",
        zebraStripe: false,
        hotkeys: {},
        columnOrder: [],
        visibleColumns: {}
      }
    };

    this.listeners = new Map(); // event -> [listeners]
  }

  // Get current state
  getState() {
    return this.state;
  }

  // Get specific state slice
  getStateSlice(path) {
    return path.split(".").reduce((obj, key) => obj?.[key], this.state);
  }

  // Update state immutably
  updateState(updater) {
    // Update state immutably
    const newState = updater(this.state);
    this.state = newState;

    // Notify listeners
    this.notifyListeners();
  }

  // Update specific state slice
  updateStateSlice(path, updater) {
    this.updateState(state => {
      const pathArray = path.split(".");
      const newState = { ...state };
      let current = newState;

      // Navigate to the parent of the target
      for (let i = 0; i < pathArray.length - 1; i++) {
        current = current[pathArray[i]] = { ...current[pathArray[i]] };
      }

      // Update the target
      const lastKey = pathArray[pathArray.length - 1];
      current[lastKey] = updater(current[lastKey]);

      return newState;
    });
  }

  // Subscribe to state changes
  subscribe(path, callback) {
    if (!this.listeners.has(path)) {
      this.listeners.set(path, []);
    }
    this.listeners.get(path).push(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(path);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  // Subscribe to specific state slice changes
  subscribeToSlice(path, callback) {
    return this.subscribe(path, callback);
  }

  // Notify all listeners
  notifyListeners() {
    this.listeners.forEach((callbacks, path) => {
      const value = this.getStateSlice(path);
      callbacks.forEach(callback => {
        try {
          callback(value);
        } catch (error) {
          console.error(`Error in state listener for ${path}:`, error);
        }
      });
    });

    // Auto-save state to localStorage (except for temporary UI state)
    this.saveToLocalStorage();
  }

  // Save state to localStorage
  saveToLocalStorage() {
    try {
      const stateToSave = {
        settings: this.state.settings,
        audio: {
          volume: this.state.audio.volume,
          radioMode: this.state.audio.radioMode
        },
        ui: {
          currentView: this.state.ui.currentView,
          visibleColumns: Array.from(this.state.ui.visibleColumns),
          resultMode: this.state.ui.resultMode
        },
        table: {
          sort: this.state.table.sort,
          manualOrderActive: this.state.table.manualOrderActive
        }
      };
      localStorage.setItem("app_state", JSON.stringify(stateToSave));
    } catch (error) {
      console.error("Failed to save state to localStorage:", error);
    }
  }

  // Load state from localStorage
  loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem("app_state");
      if (saved) {
        const parsed = JSON.parse(saved);

        // Restore settings
        if (parsed.settings) {
          this.state.settings = { ...this.state.settings, ...parsed.settings };
        }

        // Restore audio settings
        if (parsed.audio) {
          this.state.audio = { ...this.state.audio, ...parsed.audio };
        }

        // Restore UI settings
        if (parsed.ui) {
          this.state.ui = { ...this.state.ui, ...parsed.ui };
          if (parsed.ui.visibleColumns) {
            this.state.ui.visibleColumns = new Set(parsed.ui.visibleColumns);
          }
        }

        // Restore table settings
        if (parsed.table) {
          this.state.table = { ...this.state.table, ...parsed.table };
        }
      }
    } catch (error) {
      console.error("Failed to load state from localStorage:", error);
    }
  }

  // Clear all listeners
  clearListeners() {
    this.listeners.clear();
  }

  // Debug: log current state
  debug() {
    console.log("AppState Debug:");
    console.log("Current State:", this.state);
    console.log("Listeners:", Object.fromEntries(this.listeners));
  }
}

const appState = new AppState();
