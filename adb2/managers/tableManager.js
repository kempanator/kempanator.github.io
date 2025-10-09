class TableManager {
  // Initialize table manager with table, settings, and audio player references
  constructor() {
    this.table = new TableComponent();
    // Unique key generator for row instances (allows duplicate ANN Song IDs to coexist)
    this.rowInstanceCounter = 1;
    // Map row objects to stable keys without mutating data
    this.rowToKey = new WeakMap();

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
      const newVisible = [...songs.visible].sort((a, b) => order.indexOf(this.getKeyForRow(a)) - order.indexOf(this.getKeyForRow(b)));
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

    // Link checker start/stop
    this.linkCheckState = { running: false, abortControllers: [], processed: 0, total: 0, bad: 0, cancelled: false, alertFinal: false };
    eventBus.on("table:check-links-toggle", () => {
      if (this.linkCheckState.running) {
        this.stopLinkCheck();
      } else {
        this.startLinkCheck();
      }
    });

    // Redownload table task start/stop
    this.redownloadState = { running: false, aborter: null, processed: 0, total: 0, cancelled: false, success: 0, alertFinal: false };
    eventBus.on("table:redownload-toggle", () => {
      if (this.redownloadState.running) {
        this.stopRedownload();
      } else {
        this.startRedownload();
      }
    });

    // Check Song IDs task
    eventBus.on("table:check-song-ids", () => {
      const visible = [...this.state.visible];
      const total = visible.length;
      const idToKeys = new Map();
      let missing = 0;
      // Build map of annSongId -> [rowKey,...]
      visible.forEach(row => {
        const id = row.annSongId;
        if (id == null || id === "") { missing++; return; }
        const k = String(id);
        const arr = idToKeys.get(k) || [];
        arr.push(this.getKeyForRow(row));
        idToKeys.set(k, arr);
      });

      // Reset any prior duplicate marks
      this.table.rows.forEach(rc => rc.setAnnSongIdDuplicate(false));

      // Mark duplicates and count
      let duplicateBuckets = 0;
      idToKeys.forEach((keys, id) => {
        if (keys.length > 1) {
          duplicateBuckets++;
          keys.forEach(key => {
            const rc = this.table.rows.get(key);
            if (rc) rc.setAnnSongIdDuplicate(true);
          });
        }
      });

      const uniqueCount = idToKeys.size;
      const msg = `ANN Song IDs — Unique: ${uniqueCount}, Duplicates: ${duplicateBuckets}, Missing: ${missing}`;
      const allGood = duplicateBuckets === 0 && missing === 0 && uniqueCount === total;
      alertComponent.showAlert(msg, allGood ? "success" : "warning");
    });
  }

  // Load new data into the table, replacing all existing data
  loadData(data) {
    // Assign stable keys without mutating row data; expose resolver to TableComponent
    const rowsWithKeys = (Array.isArray(data) ? data : []).map(d => {
      const clone = { ...d };
      const key = String(this.rowInstanceCounter++);
      this.rowToKey.set(clone, key);
      return clone;
    });

    // Update AppState
    appState.updateStateSlice("songs.raw", () => rowsWithKeys);
    appState.updateStateSlice("songs.visible", () => rowsWithKeys.slice());
    appState.updateStateSlice("songs.removedKeys", () => new Set());
    appState.updateStateSlice("table.manualOrderActive", () => false);
    appState.updateStateSlice("table.sort.column", () => null);
    appState.updateStateSlice("table.sort.dir", () => null);

    // Update local references
    this.state.raw = rowsWithKeys;
    this.state.visible = rowsWithKeys.slice();
    this.state.removedKeys.clear();
    this.tableState.manualOrderActive = false;
    this.tableState.sort = { column: null, dir: null };

    this.table.setKeyResolver((row) => this.getKeyForRow(row));
    this.table.setData(this.state.visible);
  }

  // Append new data to the existing table data
  appendData(data) {
    const appendedWithKeys = (Array.isArray(data) ? data : []).map(d => {
      const clone = { ...d };
      const key = String(this.rowInstanceCounter++);
      this.rowToKey.set(clone, key);
      return clone;
    });
    const newRaw = this.state.raw.concat(appendedWithKeys);
    const newVisible = this.state.visible.concat(appendedWithKeys);

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

    // Ensure key resolver is set (handles first-time append into empty table)
    this.table.setKeyResolver((row) => this.getKeyForRow(row));

    // Add new rows to table
    appendedWithKeys.forEach((rowData, index) => {
      const actualIndex = this.state.visible.length - appendedWithKeys.length + index;
      this.table.addRow(rowData, actualIndex, this.getKeyForRow(rowData));
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

    const canonicalType = (t) => {
      const s = String(t || "").toUpperCase().trim();
      if (s.startsWith("OPENING") || s.startsWith("OP")) return "OP";
      if (s.startsWith("ENDING") || s.startsWith("ED")) return "ED";
      if (s.startsWith("INSERT") || s.startsWith("IN")) return "IN";
      return s;
    };

    const parseRange = (input) => {
      const s = String(input || "").trim();
      const m = s.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) {
        const a = parseInt(m[1], 10);
        const b = parseInt(m[2], 10);
        if (Number.isFinite(a) && Number.isFinite(b)) return { min: Math.min(a, b), max: Math.max(a, b) };
      }
      const single = parseInt(s, 10);
      if (Number.isFinite(single)) return { min: single, max: single };
      return null;
    };

    const matches = (row) => {
      switch (scope) {
        case "Anime": {
          const value = normalize(this.getAnimeTitle(row));
          return isPartial ? value.includes(term) : value === term;
        }
        case "Artist": {
          const value = normalize(row.songArtist || "");
          return isPartial ? value.includes(term) : value === term;
        }
        case "Song": {
          const value = normalize(row.songName || "");
          return isPartial ? value.includes(term) : value === term;
        }
        case "Composer": {
          const value = normalize(row.songComposer || "");
          return isPartial ? value.includes(term) : value === term;
        }
        case "Arranger": {
          const value = normalize(row.songArranger || "");
          return isPartial ? value.includes(term) : value === term;
        }
        case "Season": {
          // Case-insensitive, partial matching by default; also support year and year ranges
          const vintage = String(row.animeVintage || "");
          const lowerVintage = vintage.toLowerCase();
          const q = String(termRaw || "").trim();
          const lowerQ = q.toLowerCase();

          // Year range like 1999-2000
          const yrRange = q.match(/^(\d{4})\s*-\s*(\d{4})$/);
          if (yrRange) {
            const yMin = parseInt(yrRange[1], 10);
            const yMax = parseInt(yrRange[2], 10);
            const m = vintage.match(/(\d{4})/);
            if (!m) return false;
            const y = parseInt(m[1], 10);
            const lo = Math.min(yMin, yMax);
            const hi = Math.max(yMin, yMax);
            return y >= lo && y <= hi;
          }

          // Single year like 2000
          if (/^\d{4}$/.test(q)) {
            const m = vintage.match(/(\d{4})/);
            if (!m) return false;
            return parseInt(m[1], 10) === parseInt(q, 10);
          }

          // Otherwise, substring case-insensitive (e.g., "winter")
          return lowerVintage.includes(lowerQ);
        }
        case "Song Type": {
          const value = canonicalType(row.songType);
          const q = canonicalType(termRaw);
          return value === q;
        }
        case "Broadcast Type": {
          const value = broadcastText(row);
          return value.toLowerCase() === String(termRaw || "").toLowerCase();
        }
        case "Song Category": {
          const value = String(row.songCategory || "");
          return value.toLowerCase() === String(termRaw || "").toLowerCase();
        }
        case "ANN ID": {
          const ids = String(termRaw || "").split(",").map(s => s.trim()).filter(Boolean).map(s => parseInt(s, 10)).filter(n => Number.isFinite(n));
          if (ids.length === 0) return false;
          const idSet = new Set(ids);
          return idSet.has(Number(row.annId));
        }
        case "Difficulty": {
          const range = parseRange(termRaw);
          if (!range) return false;
          const val = Number(row.songDifficulty);
          if (!Number.isFinite(val)) return false;
          return val >= range.min && val <= range.max;
        }
        case "Length": {
          const range = parseRange(termRaw);
          if (!range) return false;
          const val = Number(row.songLength);
          if (!Number.isFinite(val)) return false;
          return val >= range.min && val <= range.max;
        }
        default:
          return false;
      }
    };

    // Compute which rows to remove from visible
    const currentVisible = this.state.visible;
    const toRemove = [];
    for (let i = 0; i < currentVisible.length; i++) {
      const row = currentVisible[i];
      const doesMatch = matches(row);
      if ((desiredAction === "keep" && !doesMatch) || (desiredAction === "remove" && doesMatch)) {
        toRemove.push(this.getKeyForRow(row));
      }
    }

    if (toRemove.length === 0) {
      return;
    }

    // Update removedKeys and visible
    const newRemovedKeys = new Set(this.state.removedKeys);
    toRemove.forEach(k => newRemovedKeys.add(k));
    const newVisible = currentVisible.filter(r => !newRemovedKeys.has(this.getKeyForRow(r)));

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

  // Start redownloading current visible table using ANN Song IDs (500 per batch)
  startRedownload() {
    const visible = [...this.state.visible];
    const missing = visible.filter(r => !r.annSongId).length;
    if (missing > 0) {
      showAlert(`Error: ${missing} songs are missing ANN Song ID`, "danger");
      return;
    }

    const ids = visible.map(r => Number(r.annSongId));
    const batches = [];
    for (let i = 0; i < ids.length; i += 500) batches.push(ids.slice(i, i + 500));

    this.redownloadState = { running: true, aborter: new AbortController(), processed: 0, total: batches.length, cancelled: false, success: 0, alertFinal: false };
    toolbar.updateRedownloadButtonState(true);
    alertComponent.showAlert(`Redownloading ${this.redownloadState.processed}/${this.redownloadState.total} batches. Do NOT alter the table while this runs.`, "warning");

    const run = async () => {
      // Collect all refreshed rows to rebuild table in the same order
      const collected = [];
      try {
        for (let i = 0; i < batches.length; i++) {
          if (!this.redownloadState.running) break;
          // Minimal body for ann_song_ids_request
          const body = { ann_song_ids: batches[i] };
          const data = await searchManager.postJson(`${API_BASE}/api/ann_song_ids_request`, body);
          const rows = Array.isArray(data) ? data : [];
          this.redownloadState.success += rows.length;
          collected.push(...rows);
          this.redownloadState.processed++;
          alertComponent.showAlert(`Redownloading ${this.redownloadState.processed}/${this.redownloadState.total} batches. Do NOT alter the table while this runs.`, "warning");
        }
      } catch (e) {
        // treat abort as stop
        this.redownloadState.cancelled = true;
      } finally {
        const stopped = !this.redownloadState.running || this.redownloadState.cancelled || this.redownloadState.processed < this.redownloadState.total;
        this.redownloadState.running = false;
        toolbar.updateRedownloadButtonState(false);
        if (stopped) {
          alertComponent.showAlert(`Redownload stopped (${this.redownloadState.processed}/${this.redownloadState.total}).`, "danger");
        } else {
          // Rebuild the table using refreshed rows (fallback to original row if missing)
          const byAnnSongId = new Map(collected.map(r => [Number(r.annSongId), r]));
          const rebuilt = visible.map(old => byAnnSongId.get(Number(old.annSongId)) || old);
          this.loadData(rebuilt);
          alertComponent.showAlert(`Redownload completed (${this.redownloadState.processed}/${this.redownloadState.total}). ${this.redownloadState.success} songs redownloaded.`, "success");
        }
      }
    };
    run();
  }

  // Stop redownloading
  stopRedownload() {
    this.redownloadState.cancelled = true;
    this.redownloadState.running = false;
    toolbar.updateRedownloadButtonState(false);
    alertComponent.showAlert(`Redownload stopped (${this.redownloadState.processed}/${this.redownloadState.total}).`, "danger");
  }

  // Start link validation over current visible rows with limited concurrency
  startLinkCheck() {
    const visible = [...this.state.visible];
    const total = visible.length;
    this.linkCheckState = { running: true, abortControllers: [], processed: 0, total, bad: 0, cancelled: false, alertFinal: false };
    toolbar.updateCheckLinksButtonState(true);
    this.updateLinkCheckAlert();

    const tasks = visible.map(row => () => this.checkRowLinks(row));
    this.runWithConcurrency(tasks, 5).then(() => {
      this.linkCheckState.running = false;
      const stopped = this.linkCheckState.cancelled || this.linkCheckState.processed < this.linkCheckState.total;
      this.updateLinkCheckAlert(true, stopped);
      this.linkCheckState.alertFinal = true;
      toolbar.updateCheckLinksButtonState(false);
    }).catch(() => {
      this.linkCheckState.running = false;
      toolbar.updateCheckLinksButtonState(false);
      if (!this.linkCheckState.alertFinal) alertComponent.hideAlert();
    });
  }

  // Stop link validation and abort outstanding requests
  stopLinkCheck() {
    this.linkCheckState.cancelled = true;
    this.linkCheckState.running = false;
    this.linkCheckState.abortControllers.forEach(ac => ac.abort());
    this.linkCheckState.abortControllers = [];
    toolbar.updateCheckLinksButtonState(false);
    // Immediately inform the user that the task has been stopped
    this.updateLinkCheckAlert(true, true);
    this.linkCheckState.alertFinal = true;
  }

  // Show progress alert
  updateLinkCheckAlert(done = false, stopped = false) {
    if (this.linkCheckState.alertFinal) return; // Do not overwrite a final/stopped banner
    if (done) {
      const bad = this.linkCheckState.bad || 0;
      if (stopped) {
        alertComponent.showAlert(`Link check stopped (${this.linkCheckState.processed}/${this.linkCheckState.total}). ${bad} bad links found so far.`, "danger");
      } else {
        alertComponent.showAlert(`Link check completed (${this.linkCheckState.processed}/${this.linkCheckState.total}). ${bad} bad links found.`, "success");
      }
      return;
    }
    alertComponent.showAlert(`Processing songs ${this.linkCheckState.processed}/${this.linkCheckState.total}. Do NOT alter the table while this runs.`, "warning");
  }

  // Limit parallel tasks helper
  async runWithConcurrency(taskFactories, limit) {
    let i = 0;
    const workers = new Array(Math.min(limit, taskFactories.length)).fill(0).map(async () => {
      while (this.linkCheckState.running && i < taskFactories.length) {
        const idx = i++;
        await taskFactories[idx]();
      }
    });
    await Promise.all(workers);
  }

  // Check a single row's links (720, 480, MP3)
  async checkRowLinks(row) {
    const key = this.getKeyForRow(row);
    const rowComp = this.table.rows.get(key);
    const $tr = this.table.$tbody.find(`tr[data-key="${CSS.escape(key)}"]`);
    if ($tr.length === 0) {
      this.linkCheckState.processed++;
      this.updateLinkCheckAlert();
      return;
    }

    const urls = [
      { label: "720", url: audioPlayer.buildMediaUrl(row.HQ) },
      { label: "480", url: audioPlayer.buildMediaUrl(row.MQ) },
      { label: "MP3", url: audioPlayer.buildMediaUrl(row.audio) }
    ].filter(item => item.url);

    const checks = urls.map(({ label, url }) =>
      this.checkUrl(url).then(ok => {
        rowComp.updateLinkLabelStatus(label, ok);
        if (!ok) this.linkCheckState.bad++;
      })
    );

    await Promise.allSettled(checks);
    this.linkCheckState.processed++;
    if (this.linkCheckState.processed % 5 === 0 || this.linkCheckState.processed === this.linkCheckState.total) {
      this.updateLinkCheckAlert();
    }
  }

  // Fast URL check: try HEAD else metadata load; timeouts treated as bad
  async checkUrl(url) {
    // Try HEAD request
    try {
      const ac = new AbortController();
      this.linkCheckState.abortControllers.push(ac);
      const resp = await fetch(audioPlayer.rewriteFileHost(url), { method: "HEAD", signal: ac.signal, mode: "cors" });
      if (resp && resp.ok) return true;
      if (resp && (resp.status === 404 || resp.status === 410)) return false;
    } catch (e) {
      // Continue to media probe
    }

    // Media probe with timeout
    const timeoutMs = 8000;
    const p = new Promise((resolve) => {
      const ac = new AbortController();
      this.linkCheckState.abortControllers.push(ac);
      let settled = false;
      const onDone = (ok) => { if (!settled) { settled = true; resolve(ok); } };
      let el;
      if (/\.mp3(\?|$)/i.test(url)) {
        el = document.createElement("audio");
      } else {
        el = document.createElement("video");
      }
      el.preload = "metadata";
      el.src = audioPlayer.rewriteFileHost(url);
      el.addEventListener("loadedmetadata", () => onDone(true));
      el.addEventListener("error", () => onDone(false));
      setTimeout(() => onDone(false), timeoutMs);
    });
    return p;
  }

  // Handle file uploads (JSON, CSV, Playlist) for importing data
  async onSongListUpload(evt) {
    const f = evt.target.files?.[0];
    evt.target.value = ""; // reset
    if (!f) return;
    try {
      const text = await f.text();

      // Try JSON first to support playlist import and JSON row arrays
      try {
        const res = ioManager.parseUploadText({ name: f.name, type: f.type }, text);
        if (res && res.kind === "error") {
          showAlert(res.message || "Invalid file format.", "danger");
          return;
        }
        if (res && res.kind === "playlist") {
          const isAppend = appState.getStateSlice("ui.resultMode") === "append";
          playlistManager.loadAnnSongIdsIntoTable(res.ids, isAppend, res.name || "playlist");
          return;
        }
        if (res && res.kind === "rows") {
          const isAppend = appState.getStateSlice("ui.resultMode") === "append";
          if (isAppend) this.appendData(res.rows); else this.loadData(res.rows);
          return;
        }
      } catch (_jsonErr) {
        // Not JSON; proceed to CSV/auto-detect parser
      }

      // Use ioManager to parse CSV or row-array JSON
      const rows = ioManager.parseFileText({ name: f.name, type: f.type }, text);
      const isAppend = appState.getStateSlice("ui.resultMode") === "append";
      if (isAppend) this.appendData(rows); else this.loadData(rows);
    } catch (err) {
      showAlert(`Upload failed: ${err.message || err}`, "danger");
    }
  }

  // Remove a row from both state and table by its unique key
  removeRow(key) {
    // Update AppState
    const newRemovedKeys = new Set(this.state.removedKeys);
    newRemovedKeys.add(key);
    const newVisible = this.state.visible.filter(r => this.getKeyForRow(r) !== key);

    appState.updateStateSlice("songs.removedKeys", () => newRemovedKeys);
    appState.updateStateSlice("songs.visible", () => newVisible);

    // Update local references
    this.state.removedKeys = newRemovedKeys;
    this.state.visible = newVisible;

    this.table.removeRow(key);
    this.table.render();
  }

  // Return the stable key for a given row data object
  getKeyForRow(row) {
    return this.rowToKey.get(row);
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

}

const tableManager = new TableManager();
