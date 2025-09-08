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
      if (confirm("Are you sure you want to clear all results from the table?")) {
        this.clearData();
      }
    });
    // Wire table DOM events
    $("#resultsTable thead").on("click", "th", (e) => {
      const col = $(e.target).data("col");
      if (!col) return;
      eventBus.emit("table:sort", { column: col, element: e.target });
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
      const currentOrder = (songs.visible || []).map(r => this.rowKey(r));
      const sameOrder = order.length === currentOrder.length && order.every((k, i) => k === currentOrder[i]);
      if (sameOrder) {
        return;
      }

      const newVisible = [...songs.visible].sort((a, b) => order.indexOf(this.rowKey(a)) - order.indexOf(this.rowKey(b)));
      appState.updateStateSlice("songs.visible", () => newVisible);
      appState.updateStateSlice("table.manualOrderActive", () => true);
      this.table.render();
      this.table.markPlaying();
      this.table.markExistingInPlaylist(playlistManager.autoAddPlaylistId);
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
    this.table.markPlaying();
    this.table.markExistingInPlaylist(playlistManager.autoAddPlaylistId);
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
    this.table.markPlaying();
    this.table.markExistingInPlaylist(playlistManager.autoAddPlaylistId);
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

  // Apply client-side filtering to the visible data
  applyFilters(filters) {
    // Apply client-side filtering
    const filteredData = this.applyClientSideFiltering(this.state.visible, filters);

    // Update AppState
    appState.updateStateSlice("songs.visible", () => filteredData);

    // Update local references
    this.state.visible = filteredData;

    this.table.setData(this.state.visible);
  }

  // Apply client-side filtering based on search terms and match case setting
  applyClientSideFiltering(rows, t) {
    if (!Array.isArray(rows)) return rows;

    // If match case is not enabled, return original results
    if (!t.match_case) return rows;

    // Get search terms from the current search inputs
    const searchTerms = [];

    if (settingsManager.get("searchMode") === "advanced") {
      // Advanced search mode - get from individual fields
      const anime = $("#searchAnime").val().trim();
      const artist = $("#searchArtist").val().trim();
      const song = $("#searchSong").val().trim();
      const composer = $("#searchComposer").val().trim();

      if (anime) searchTerms.push({ field: "anime", term: anime });
      if (artist) searchTerms.push({ field: "artist", term: artist });
      if (song) searchTerms.push({ field: "song", term: song });
      if (composer) searchTerms.push({ field: "composer", term: composer });
    } else {
      // Simple search mode - get from main search query
      const query = $("#searchQuery").val().trim();
      const scope = $("#searchScope").val();

      if (query) {
        if (scope === "All") {
          // For "All" scope, search across multiple fields
          searchTerms.push({ field: "anime", term: query });
          searchTerms.push({ field: "artist", term: query });
          searchTerms.push({ field: "song", term: query });
          searchTerms.push({ field: "composer", term: query });
        } else {
          searchTerms.push({ field: scope.toLowerCase(), term: query });
        }
      }
    }

    // If no search terms, return original results
    if (searchTerms.length === 0) return rows;

    return rows.filter(row => {
      // For "All" scope, we need to check if ANY field matches
      if (searchTerms.length > 0 && searchTerms.every(st => ["anime", "artist", "song", "composer"].includes(st.field))) {
        // This is an "All" scope search - check if ANY field matches
        return searchTerms.some(({ field, term }) => {
          let fieldValue = "";

          switch (field) {
            case "anime":
              fieldValue = (row.animeENName || row.animeJPName || "").toString();
              break;
            case "artist":
              fieldValue = (row.songArtist || "").toString();
              break;
            case "song":
              fieldValue = (row.songName || "").toString();
              break;
            case "composer":
              fieldValue = (row.songComposer || "").toString();
              break;
            default:
              return false;
          }

          // Case-sensitive matching
          return fieldValue.includes(term);
        });
      } else {
        // Regular scope search - check if ALL terms match
        return searchTerms.every(({ field, term }) => {
          let fieldValue = "";

          switch (field) {
            case "anime":
              fieldValue = (row.animeENName || row.animeJPName || "").toString();
              break;
            case "artist":
              fieldValue = (row.songArtist || "").toString();
              break;
            case "song":
              fieldValue = (row.songName || "").toString();
              break;
            case "composer":
              fieldValue = (row.songComposer || "").toString();
              break;
            default:
              return true; // Skip filtering for unknown fields
          }

          // Case-sensitive matching
          return fieldValue.includes(term);
        });
      }
    });
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
    // Broadcast unified reorder event for consumers
    eventBus.emit("table:reordered", { order: this.table.getDomOrderKeys() });
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
    // Broadcast unified reorder event for consumers
    eventBus.emit("table:reordered", { order: this.table.getDomOrderKeys() });
  }

  // Export table data in the specified format (csv or json)
  export(format) {
    const data = this.table.getVisibleData();

    if (format === "csv") {
      this.exportAsCSV(data);
    } else if (format === "json") {
      this.exportAsJSON(data);
    }
  }

  // Export data as JSON file with formatted content
  exportAsJSON(data) {
    const content = JSON.stringify(data, null, 2);
    const filename = this.makeDownloadFilename("json");
    this.downloadFile(content, filename, "application/json");
  }

  // Export data as CSV file with all columns and proper escaping
  exportAsCSV(data) {
    if (data.length === 0) {
      showAlert("No data to export", "warning");
      return;
    }

    // Define CSV columns and their data sources
    const columns = [
      { header: "ANN ID", getValue: row => row.annId || "" },
      { header: "Anime", getValue: row => this.getAnimeTitle(row) },
      { header: "Type", getValue: row => row.songType || "" },
      { header: "Song", getValue: row => row.songName || "" },
      { header: "Artist", getValue: row => row.songArtist || "" },
      { header: "Vintage", getValue: row => row.animeVintage || "" },
      { header: "Difficulty", getValue: row => row.songDifficulty || "" },
      { header: "Category", getValue: row => row.songCategory || "" },
      { header: "Broadcast", getValue: row => broadcastText(row) },
      { header: "Length", getValue: row => this.formatDurationSeconds(row.songLength) },
      { header: "Composer", getValue: row => row.songComposer || "" },
      { header: "Arranger", getValue: row => row.songArranger || "" },
      { header: "ANN Song ID", getValue: row => row.annSongId || "" },
      { header: "AMQ Song ID", getValue: row => row.amqSongId || "" },
      { header: "Anilist ID", getValue: row => (row.linked_ids?.anilist || "") },
      { header: "MAL ID", getValue: row => (row.linked_ids?.myanimelist || "") },
      { header: "Kitsu ID", getValue: row => (row.linked_ids?.kitsu || "") },
      { header: "AniDB ID", getValue: row => (row.linked_ids?.anidb || "") },
      { header: "720p", getValue: row => row.HQ || "" },
      { header: "480p", getValue: row => row.MQ || "" },
      { header: "MP3", getValue: row => row.audio || "" }
    ];

    // Create CSV content
    const csvRows = [];

    // Add header row
    csvRows.push(columns.map(col => `"${col.header}"`).join(","));

    // Add data rows
    data.forEach((row, index) => {
      const values = columns.map(col => {
        const value = col.getValue(row, index);
        // Escape quotes and wrap in quotes
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(","));
    });

    const csvContent = csvRows.join("\n");
    const filename = this.makeDownloadFilename("csv");
    this.downloadFile(csvContent, filename, "text/csv");
  }

  // Generate a filename for downloads based on current search parameters
  makeDownloadFilename(extension = "json") {
    if (settingsManager.get("searchMode") === "advanced") {
      // Advanced search mode - combine all 4 inputs
      const anime = $("#searchAnime").val().trim();
      const artist = $("#searchArtist").val().trim();
      const song = $("#searchSong").val().trim();
      const composer = $("#searchComposer").val().trim();

      // Combine all non-empty values with a separator
      const parts = [anime, artist, song, composer].filter(Boolean);
      if (parts.length === 0) return `download.${extension}`;

      const combined = parts.join(" ");
      const safe = combined.replace(/[^a-z0-9 _.-]+/gi, "");
      return (safe || "download") + `.${extension}`;
    } else {
      // Simple search mode - use search query
      const q = (($("#searchQuery").val() || "")).trim();
      if (!q) return `download.${extension}`;
      const safe = q.replace(/[^a-z0-9 _.-]+/gi, "");
      return (safe || "download") + `.${extension}`;
    }
  }

  // Download a file with the specified content, filename, and MIME type
  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Handle JSON file uploads for importing data
  async onUploadJson(evt) {
    const f = evt.target.files?.[0];
    evt.target.value = ""; // reset
    if (!f) return;
    try {
      const text = await f.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("Uploaded JSON must be an array of rows.");

      this.loadData(parsed);
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

  // Format duration in seconds to MM:SS display format
  formatDurationSeconds(sec) {
    const n = Number(sec);
    if (!Number.isFinite(n) || n <= 0) return "";
    const m = Math.floor(n / 60);
    const s = Math.round(n - m * 60);
    const ss = String(s).padStart(2, "0");
    return `${m}:${ss}`;
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
    // Update only the file link cells in existing rows
    const rows = this.table.rows;

    // Get the current column order to find links column position
    const columnOrder = settingsManager.get("columnOrder");
    const linksColumnIndex = columnOrder.indexOf("links");

    if (linksColumnIndex === -1) return;

    rows.forEach((row, key) => {
      const tr = document.querySelector(`#resultsTable tbody tr[data-key="${CSS.escape(key)}"]`);
      if (tr) {
        // Get the links cell by its position in the row
        const cells = tr.querySelectorAll("td");
        const linksCell = cells[linksColumnIndex];

        if (linksCell) {
          const hqUrl = audioPlayer?.buildMediaUrl(row.data.HQ) || "";
          const mqUrl = audioPlayer?.buildMediaUrl(row.data.MQ) || "";
          const mp3Url = audioPlayer?.buildMediaUrl(row.data.audio) || "";

          linksCell.innerHTML = [
            row.renderLinkLabel("720", hqUrl),
            row.renderLinkLabel("480", mqUrl),
            row.renderLinkLabel("MP3", mp3Url)
          ].join(" ");
        }
      }
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
