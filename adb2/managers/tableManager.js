class TableManager {
  // Initialize table manager with table, settings, and audio player references
  constructor() {
    this.table = new TableComponent();

    // Reference App State for state
    this.state = appState.getStateSlice("songs");
    this.tableState = appState.getStateSlice("table");

    // Listen for events from EventBus
    eventBus.on("song:remove", (songId) => {
      this.removeRow(songId);
    });

    eventBus.on("table:sort", (data) => {
      const col = data.column;
      const currentColumn = appState.getStateSlice("table.sort.column");
      const currentDirection = appState.getStateSlice("table.sort.dir");

      let newColumn, newDirection;

      if (currentColumn !== col) {
        newColumn = col;
        newDirection = "asc";
      } else if (currentDirection === "asc") {
        newColumn = col;
        newDirection = "desc";
      } else {
        newColumn = null;
        newDirection = null;
      }

      // Update state manager
      appState.updateStateSlice("table.sort.column", () => newColumn);
      appState.updateStateSlice("table.sort.dir", () => newDirection);
      appState.updateStateSlice("table.manualOrderActive", () => newColumn ? false : this.tableState.manualOrderActive);

      // Update local state references
      this.tableState.sort.column = newColumn;
      this.tableState.sort.dir = newDirection;
      if (newColumn) {
        this.tableState.manualOrderActive = false;
      }

      // Update table
      this.table.sort(newColumn, newDirection);
    });

    eventBus.on("table:shuffle", () => {
      this.shuffle();
    });

    eventBus.on("table:reverse", () => {
      this.reverse();
    });

    eventBus.on("table:clear", () => {
      const songs = appState.getStateSlice("songs");
      if (songs.visible.length === 0) {
        return;
      }
      this.clearData();
    });
    // Wire table DOM events
    $("#resultsTable thead").on("click", "th", (e) => {
      const col = $(e.target).data("col");
      if (!col) return;
      eventBus.emit("table:sort", { column: col, element: e.target });
    });

    // Client filter apply: operate on visible rows and update removedKeys
    eventBus.on("table:client-filter-apply", (payload) => {
      this.applyClientFilter(payload);
    });

    // React to settings changes
    eventBus.on("settings:language-changed", () => {
      this.syncLanguageChange();
    });
    eventBus.on("settings:fileHost-changed", () => {
      this.syncFileHostChange();
    });

    // React to row reorder events from the table component
    eventBus.on("table:reordered", ({ order }) => {
      const songs = appState.getStateSlice("songs");
      const newVisible = [...songs.visible].sort((a, b) => order.indexOf(this.rowKey(a)) - order.indexOf(this.rowKey(b)));
      appState.updateStateSlice("songs.visible", () => newVisible);
      appState.updateStateSlice("table.manualOrderActive", () => true);
      this.table.render();
    });

    // Subscribe to state changes
    appState.subscribeToSlice("table.sort.column", (column) => {
      if (column !== this.tableState.sort.column) {
        this.tableState.sort.column = column;
        this.table.sort(column, this.tableState.sort.dir);
      }
    });

    appState.subscribeToSlice("table.sort.dir", (direction) => {
      if (direction !== this.tableState.sort.dir) {
        this.tableState.sort.dir = direction;
        this.table.sort(this.tableState.sort.column, direction);
      }
    });

    // Subscribe to songs state changes to keep local references in sync
    appState.subscribeToSlice("songs", (songs) => {
      this.state = songs;
    });

    appState.subscribeToSlice("table", (table) => {
      this.tableState = table;
    });

    // Subscribe to audio state changes to update play button states
    appState.subscribeToSlice("audio.currentSongId", (currentSongId) => {
      // Update all RowComponent instances to reflect the new playing state
      this.table.rows.forEach((row, key) => {
        row.updatePlayButtonState();
      });
    });
  }

  // Load new data into the table, replacing all existing data
  loadData(data) {
    // Update AppState
    appState.updateStateSlice("songs.raw", () => data);
    appState.updateStateSlice("songs.visible", () => data.slice());
    appState.updateStateSlice("songs.removedKeys", () => new Set());
    appState.updateStateSlice("table.manualOrderActive", () => false);
    appState.updateStateSlice("table.sort.column", () => null);
    appState.updateStateSlice("table.sort.dir", () => null);

    // Update local references
    this.state.raw = data;
    this.state.visible = data.slice();
    this.state.removedKeys.clear();
    this.tableState.manualOrderActive = false;
    this.tableState.sort = { column: null, dir: null };

    this.table.setData(this.state.visible);
  }

  // Append new data to the existing table data
  appendData(data) {
    const newRaw = this.state.raw.concat(data);
    const newVisible = this.state.visible.concat(data);

    // Update AppState
    appState.updateStateSlice("songs.raw", () => newRaw);
    appState.updateStateSlice("songs.visible", () => newVisible);
    appState.updateStateSlice("table.manualOrderActive", () => true);
    appState.updateStateSlice("table.sort.column", () => null);
    appState.updateStateSlice("table.sort.dir", () => null);

    // Update local references
    this.state.raw = newRaw;
    this.state.visible = newVisible;
    this.tableState.manualOrderActive = true;
    this.tableState.sort = { column: null, dir: null };

    // Add new rows to table
    data.forEach((rowData, index) => {
      const actualIndex = this.state.visible.length - data.length + index;
      this.table.addRow(rowData, actualIndex);
    });

    this.table.render();
  }

  // Clear all data from the table and reset state
  clearData() {
    // Update AppState
    appState.updateStateSlice("songs.raw", () => []);
    appState.updateStateSlice("songs.visible", () => []);
    appState.updateStateSlice("songs.removedKeys", () => new Set());
    appState.updateStateSlice("table.manualOrderActive", () => false);
    appState.updateStateSlice("table.sort.column", () => null);
    appState.updateStateSlice("table.sort.dir", () => null);

    // Update local references
    this.state.raw = [];
    this.state.visible = [];
    this.state.removedKeys.clear();
    this.tableState.manualOrderActive = false;
    this.tableState.sort = { column: null, dir: null };

    this.table.clear();
    this.table.render();
  }

  // Apply client-side filter permanently to visible rows
  applyClientFilter({ action, field, query, partial, match_case }) {
    // Normalize parameters
    const desiredAction = String(action || "keep").toLowerCase(); // "keep" | "remove"
    const scope = String(field || "Anime"); // Anime | Artist | Song | Composer | Season
    const termRaw = String(query || "");
    const isPartial = Boolean(partial);
    const isCaseSensitive = Boolean(match_case);

    // Build matcher according to settings
    const normalize = (s) => (isCaseSensitive ? String(s ?? "") : String(s ?? "").toLowerCase());
    const term = normalize(termRaw);

    const getFieldValue = (row) => {
      switch (scope) {
        case "Anime":
          return this.getAnimeTitle(row);
        case "Artist":
          return row.songArtist || "";
        case "Song":
          return row.songName || "";
        case "Composer":
          return row.songComposer || "";
        case "Season":
          return row.animeVintage || "";
        default:
          return "";
      }
    };

    const matches = (row) => {
      const value = normalize(getFieldValue(row));
      if (!isPartial) {
        return value === term;
      }
      return value.includes(term);
    };

    // Compute which rows to remove from visible
    const currentVisible = this.state.visible;
    const toRemove = [];
    for (let i = 0; i < currentVisible.length; i++) {
      const row = currentVisible[i];
      const doesMatch = matches(row);
      if ((desiredAction === "keep" && !doesMatch) || (desiredAction === "remove" && doesMatch)) {
        toRemove.push(this.rowKey(row));
      }
    }

    if (toRemove.length === 0) {
      return;
    }

    // Update removedKeys and visible
    const newRemovedKeys = new Set(this.state.removedKeys);
    toRemove.forEach(k => newRemovedKeys.add(k));
    const newVisible = currentVisible.filter(r => !newRemovedKeys.has(this.rowKey(r)));

    appState.updateStateSlice("songs.removedKeys", () => newRemovedKeys);
    appState.updateStateSlice("songs.visible", () => newVisible);

    this.state.removedKeys = newRemovedKeys;
    this.state.visible = newVisible;

    this.table.setData(this.state.visible);
  }

  // Shuffle the table rows and update state to match
  shuffle() {
    // Get the current order of songs
    const currentVisible = [...this.state.visible];

    // Shuffle the songs array
    for (let i = currentVisible.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [currentVisible[i], currentVisible[j]] = [currentVisible[j], currentVisible[i]];
    }

    // Update AppState
    appState.updateStateSlice("songs.visible", () => currentVisible);
    appState.updateStateSlice("table.manualOrderActive", () => true);
    appState.updateStateSlice("table.sort.column", () => null);
    appState.updateStateSlice("table.sort.dir", () => null);

    // Update local references
    this.state.visible = currentVisible;
    this.tableState.manualOrderActive = true;
    this.tableState.sort = { column: null, dir: null };

    // Re-render the table with the new order
    this.table.setData(this.state.visible);
  }

  // Reverse the table rows and update state to match
  reverse() {
    // Get the current order of songs and reverse it
    const newVisible = [...this.state.visible].reverse();

    // Update AppState
    appState.updateStateSlice("songs.visible", () => newVisible);
    appState.updateStateSlice("table.manualOrderActive", () => true);
    appState.updateStateSlice("table.sort.column", () => null);
    appState.updateStateSlice("table.sort.dir", () => null);

    // Update local references
    this.state.visible = newVisible;
    this.tableState.manualOrderActive = true;
    this.tableState.sort = { column: null, dir: null };

    // Re-render the table with the new order
    this.table.setData(this.state.visible);
  }

  // Export table data in the specified format (csv or json)
  export(format) {
    const data = this.table.getVisibleData();
    if (format === "csv") {
      ioManager.exportAsCSV(data);
    } else if (format === "json") {
      ioManager.exportAsJSON(data);
    }
  }

  // Handle file uploads (JSON or CSV) for importing data
  async onUploadJson(evt) {
    const f = evt.target.files?.[0];
    evt.target.value = ""; // reset
    if (!f) return;
    try {
      const text = await f.text();
      const rows = ioManager.parseFileText({ name: f.name, type: f.type }, text);
      this.loadData(rows);
    } catch (err) { showAlert(`Upload failed: ${err.message || err}`, "danger"); }
  }

  // Apply settings changes to the table by re-rendering
  syncWithSettings() {
    // Apply settings changes to the table
    this.table.render();
  }

  // Remove a row from both state and table by its unique key
  removeRow(key) {
    // Update AppState
    const newRemovedKeys = new Set(this.state.removedKeys);
    newRemovedKeys.add(key);
    const newVisible = this.state.visible.filter(r => this.rowKey(r) !== key);

    appState.updateStateSlice("songs.removedKeys", () => newRemovedKeys);
    appState.updateStateSlice("songs.visible", () => newVisible);

    // Update local references
    this.state.removedKeys = newRemovedKeys;
    this.state.visible = newVisible;

    this.table.removeRow(key);
    this.table.render();
  }

  // Get anime title based on current language preference setting
  getAnimeTitle(row) {
    return (settingsManager.get("language") === "romaji")
      ? (row.animeJPName || row.animeENName || "")
      : (row.animeENName || row.animeJPName || "");
  }

  // Optimized method for language changes - updates only anime titles without full re-render
  syncLanguageChange() {
    // Update only the anime title cells in existing rows
    const rows = this.table.rows;

    // Get the current column order to find anime column position
    const columnOrder = settingsManager.get("columnOrder");
    const animeColumnIndex = columnOrder.indexOf("anime");

    if (animeColumnIndex === -1) return;

    rows.forEach((row, key) => {
      const tr = document.querySelector(`#resultsTable tbody tr[data-key="${CSS.escape(key)}"]`);
      if (tr) {
        // Get the anime cell by its position in the row
        const cells = tr.querySelectorAll("td");
        const animeCell = cells[animeColumnIndex];

        if (animeCell) {
          // Use the same method as the original rendering to get properly formatted title
          const animeTitle = row.sanitize(row.getAnimeTitle());
          animeCell.textContent = animeTitle;
          animeCell.title = animeTitle;
        }
      }
    });
  }

  // Optimized method for file host changes - updates only file links without full re-render
  syncFileHostChange() {
    this.table.rows.forEach((row) => {
      row.updateLinkHrefs();
    });
  }

  // Optimized method for zebra stripe changes - updates only CSS class without full re-render
  syncZebraStripe() {
    const table = this.table.container;
    if (settingsManager.get("zebraStripe")) {
      table.classList.add("table-striped");
    } else {
      table.classList.remove("table-striped");
    }
  }

  // Generate a unique key for a data row based on ANN ID and Song ID
  rowKey(r) {
    return `${r.annId}-${r.annSongId}`;
  }
}

const tableManager = new TableManager();
