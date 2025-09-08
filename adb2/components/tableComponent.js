class TableComponent {
  // Static property for season ordering
  static SeasonOrder = ["Winter", "Spring", "Summer", "Fall"];

  constructor() {
    this.$table = $("#resultsTable");
    this.$thead = $("#resultsTable thead");
    this.$theadRow = $("#resultsTable thead tr");
    this.$tbody = $("#resultsTable tbody");
    this.$colgroup = $("#resultsTable colgroup");
    this.$cardContainer = $("#resultsCards");
    this.resultsCount = $("#resultsCount");
    this.rows = new Map(); // key -> RowComponent instance

    // Wire sortable for manual row reordering
    new Sortable(this.$tbody[0], {
      handle: ".js-grab",
      animation: 150,
      onEnd: () => {
        const domKeys = this.getDomOrderKeys();
        eventBus.emit("table:reordered", { order: domKeys });
      }
    });
  }

  // Set the table data and render all rows
  setData(data) {
    this.clear();
    data.forEach((rowData, index) => {
      this.addRow(rowData, index);
    });
    this.render();
  }

  // Add a single data row to the table with the specified index
  addRow(data, index) {
    const key = `${data.annId}-${data.annSongId}`;
    const row = new RowComponent(data, index);
    this.rows.set(key, row);
    return row;
  }

  // Remove a row from the table by its unique key
  removeRow(key) {
    const row = this.rows.get(key);
    if (row) {
      row.destroy();
      this.rows.delete(key);
    }
  }

  // Clear all rows from the table and destroy their DOM elements
  clear() {
    this.rows.forEach(row => row.destroy());
    this.rows.clear();
  }

  // Render both table and card views with current data
  render() {
    this.renderTable();
    this.renderCards();
    this.updateResultsCount();
  }

  // Render the table view with sorted rows and column settings
  renderTable() {
    // Clear existing content
    this.$tbody.empty();

    // Clear cached table elements so they're recreated with new column order
    this.rows.forEach(row => {
      if (row.$tableElement) {
        row.$tableElement.remove();
        row.$tableElement = null;
      }
    });

    // Get sorted rows
    const sortedRows = this.getSortedRows();

    // Add rows to table
    sortedRows.forEach(row => {
      this.$tbody.append(row.renderAsTable());
    });

    this.applyColumnOrder();
    this.applyColumnVisibility();

    // Apply zebra stripe setting
    this.applyZebraStripe();
  }

  // Render the mobile card view with sorted rows
  renderCards() {
    // Clear existing content
    this.$cardContainer.empty();

    // Get sorted rows
    const sortedRows = this.getSortedRows();

    // Add cards
    sortedRows.forEach(row => {
      this.$cardContainer.append(row.renderAsCard());
    });
  }

  // Get all rows sorted according to current sort state
  getSortedRows() {
    const rows = Array.from(this.rows.values());

    // Check if manual order is active from the global state
    const manualOrderActive = appState.getStateSlice("table.manualOrderActive");

    if (manualOrderActive) {
      // When manual order is active, preserve the order as it appears in the songs.visible array
      const songs = appState.getStateSlice("songs");
      const rowMap = new Map(rows.map(row => [row.getKey(), row]));
      return songs.visible.map(songData => rowMap.get(`${songData.annId}-${songData.annSongId}`)).filter(Boolean);
    }

    // Get sort state from global state manager
    const sortColumn = appState.getStateSlice("table.sort.column");
    const sortDir = appState.getStateSlice("table.sort.dir");

    if (sortColumn) {
      const factor = sortDir === "asc" ? 1 : -1;
      rows.sort((a, b) => this.compareBy(sortColumn, a, b) * factor);
    }

    return rows;
  }

  // Compare two rows by the specified column for sorting
  compareBy(column, a, b) {
    switch (column) {
      case "annid": return this.num(a.data.annId) - this.num(b.data.annId);
      case "anime": return this.str(a.getAnimeTitle()).localeCompare(this.str(b.getAnimeTitle()), undefined, { sensitivity: "base" });
      case "song": return this.str(a.data.songName).localeCompare(this.str(b.data.songName), undefined, { sensitivity: "base" });
      case "artist": return this.str(a.data.songArtist).localeCompare(this.str(b.data.songArtist), undefined, { sensitivity: "base" });
      case "type": return this.typeOrder(a.data.songType) - this.typeOrder(b.data.songType);
      case "vintage": return this.vintageOrder(a.data.animeVintage) - this.vintageOrder(b.data.animeVintage);
      case "difficulty": return this.num(a.data.songDifficulty) - this.num(b.data.songDifficulty);
      case "category": return this.str(a.data.songCategory || "").localeCompare(this.str(b.data.songCategory || ""), undefined, { sensitivity: "base" });
      case "broadcast": return this.str(broadcastText(a.data)).localeCompare(this.str(broadcastText(b.data)), undefined, { sensitivity: "base" });
      case "length": return this.num(a.data.songLength) - this.num(b.data.songLength);
      case "composer": return this.str(a.data.songComposer || "").localeCompare(this.str(b.data.songComposer || ""), undefined, { sensitivity: "base" });
      case "arranger": return this.str(a.data.songArranger || "").localeCompare(this.str(b.data.songArranger || ""), undefined, { sensitivity: "base" });
      case "annSongId": return this.num(a.data.annSongId) - this.num(b.data.annSongId);
      case "amqSongId": return this.num(a.data.amqSongId) - this.num(b.data.amqSongId);
      case "anilistId": return this.num((a.data.linked_ids || {}).anilist) - this.num((b.data.linked_ids || {}).anilist);
      case "malId": return this.num((a.data.linked_ids || {}).myanimelist) - this.num((b.data.linked_ids || {}).myanimelist);
      case "kitsuId": return this.num((a.data.linked_ids || {}).kitsu) - this.num((b.data.linked_ids || {}).kitsu);
      case "anidbId": return this.num((a.data.linked_ids || {}).anidb) - this.num((b.data.linked_ids || {}).anidb);
      case "rownum": default: return 0;
    }
  }

  // Sort the table by the specified column and direction
  sort(column, direction) {
    // Update global state instead of local state
    appState.updateStateSlice("table.sort.column", () => column);
    appState.updateStateSlice("table.sort.dir", () => direction);
    appState.updateStateSlice("table.manualOrderActive", () => false);
    this.render();
  }

  // Clear the current sort state and re-render
  clearSort() {
    // Update global state instead of local state
    appState.updateStateSlice("table.sort.column", () => null);
    appState.updateStateSlice("table.sort.dir", () => null);
    this.render();
  }

  // Filter rows based on the provided predicate function
  filter(predicate) {
    this.rows.forEach((row, key) => {
      const isVisible = predicate(row.data);
      row.setVisible(isVisible);
    });
  }

  // Set column visibility settings and apply to the table
  setColumnVisibility(columns) {
    settingsManager.set("visibleColumns", columns);
    this.applyColumnVisibility();
  }

  // Set column order settings and apply to the table
  setColumnOrder(order) {
    settingsManager.set("columnOrder", order);
    this.applyColumnOrder();
  }

  // Apply current column order settings to the table DOM
  applyColumnOrder() {
    // Update colgroup
    this.$colgroup.empty();
    settingsManager.get("columnOrder").forEach(colName => {
      const $col = $("<col>").addClass(`col-${colName}`);

      // Set width based on column type
      const widths = {
        plus: "40px",
        rownum: "35px",
        annid: "80px",
        anime: "18%",
        type: "55px",
        song: "18%",
        artist: "15%",
        vintage: "110px",
        difficulty: "50px",
        category: "80px",
        broadcast: "80px",
        length: "60px",
        composer: "12%",
        arranger: "12%",
        annSongId: "80px",
        amqSongId: "80px",
        anilistId: "80px",
        malId: "80px",
        kitsuId: "80px",
        anidbId: "80px",
        links: "125px",
        action: "100px"
      };

      $col.css("width", widths[colName] || "auto");
      this.$colgroup.append($col);
    });

    // Update header (target the row inside the thead)
    this.$theadRow.empty();
    settingsManager.get("columnOrder").forEach(colName => {
      const $th = $("<th>").attr("scope", "col");

      // Set classes and data attributes
      const columnConfig = {
        plus: { text: "+", classes: "no-sort nw", dataCol: "plus" },
        rownum: { text: "#", classes: "no-sort nw", dataCol: "rownum" },
        annid: { text: "ANN ID", classes: "nw", dataCol: "annid" },
        anime: { text: "Anime", classes: "", dataCol: "anime" },
        type: { text: "Type", classes: "nw", dataCol: "type" },
        song: { text: "Song", classes: "", dataCol: "song" },
        artist: { text: "Artist", classes: "", dataCol: "artist" },
        vintage: { text: "Vintage", classes: "nw", dataCol: "vintage" },
        difficulty: { text: "Dif", classes: "nw", dataCol: "difficulty" },
        category: { text: "Category", classes: "nw", dataCol: "category" },
        broadcast: { text: "Broadcast", classes: "nw", dataCol: "broadcast" },
        length: { text: "Length", classes: "nw", dataCol: "length" },
        composer: { text: "Composer", classes: "", dataCol: "composer" },
        arranger: { text: "Arranger", classes: "", dataCol: "arranger" },
        annSongId: { text: "ANN Song ID", classes: "nw", dataCol: "annSongId" },
        amqSongId: { text: "AMQ Song ID", classes: "nw", dataCol: "amqSongId" },
        anilistId: { text: "AniList ID", classes: "nw", dataCol: "anilistId" },
        malId: { text: "MAL ID", classes: "nw", dataCol: "malId" },
        kitsuId: { text: "Kitsu ID", classes: "nw", dataCol: "kitsuId" },
        anidbId: { text: "AniDB ID", classes: "nw", dataCol: "anidbId" },
        links: { text: "Links", classes: "no-sort nw", dataCol: "links" },
        action: { text: "Action", classes: "no-sort nw", dataCol: "action" }
      };

      const config = columnConfig[colName];
      if (config) {
        $th.text(config.text);
        if (config.classes) $th.addClass(config.classes);
        if (config.dataCol) $th.attr("data-col", config.dataCol);
      }

      this.$theadRow.append($th);
    });
  }

  // Apply current column visibility settings to the table DOM
  applyColumnVisibility() {
    // Use the current column order from settings manager
    const columnOrder = settingsManager.get("columnOrder");

    // Apply visibility to colgroup
    this.$colgroup.find("col").each((index, col) => {
      const colClass = columnOrder[index];
      const isVisible = settingsManager.get("visibleColumns")[colClass];
      col.style.display = isVisible ? "" : "none";
    });

    // Apply visibility to header
    this.$thead.find("th").each((index, th) => {
      const colClass = columnOrder[index];
      const isVisible = settingsManager.get("visibleColumns")[colClass];
      th.style.display = isVisible ? "" : "none";
    });

    // Add sort indicators after visibility is set
    this.updateHeaderSortIndicators();

    // Show header after everything is ready
    this.$thead.css("display", "");

    // Apply visibility to body rows
    this.$tbody.find("tr").each((index, tr) => {
      tr.querySelectorAll("td").forEach((td) => {
        const colClass = td.getAttribute("data-col");
        if (colClass) {
          const isVisible = settingsManager.get("visibleColumns")[colClass];
          td.style.display = isVisible ? "" : "none";
        }
      });
    });
  }

  // Reset column order to default settings and re-render
  resetColumnOrderToDefault() {
    settingsManager.set("columnOrder", [...DefaultColumnOrder]);
    settingsModal.renderColumnOrderList();
    this.render();
  }

  // Reset column visibility to default settings and apply changes
  resetColumnVisibilityToDefault() {
    settingsManager.set("visibleColumns", { ...DefaultSettings.visibleColumns });
    settingsManager.save();
    this.applyColumnVisibility();
  }

  // Mark rows that are currently playing
  markPlaying() {
    // Update all rows
    this.rows.forEach((row) => {
      row.updatePlayButtonState();
    });
  }

  // Mark rows that exist in the specified playlist with visual indicators
  markExistingInPlaylist(playlistId) {
    if (!playlistId) return;

    const playlists = playlistManager.loadAllPlaylists();
    const playlist = playlists[playlistId];

    if (!playlist) return;

    this.rows.forEach((row, key) => {
      const songData = row.data;
      if (!songData || !songData.annSongId) return;

      const isInPlaylist = playlist.annSongIds.includes(songData.annSongId);

      // Update button styling
      row.$tableElement.find(".js-add-to-playlist").toggleClass("marked", isInPlaylist);
      row.$cardElement.find(".js-add-to-playlist").toggleClass("marked", isInPlaylist);
    });
  }

  // Reset playlist button indicators to default styling
  resetPlaylistIndicators() {
    this.rows.forEach((row) => {
      row.$tableElement.find(".js-add-to-playlist").removeClass("marked");
      row.$cardElement.find(".js-add-to-playlist").removeClass("marked");
    });
  }

  // Update sort indicators in the table header based on current sort state
  updateHeaderSortIndicators() {
    const column = appState.getStateSlice("table.sort.column");
    const dir = appState.getStateSlice("table.sort.dir");
    $("#resultsTable thead th").each(function () {
      const th = $(this);
      const col = th.data("col");
      if (!col) return;
      if (th.hasClass("no-sort")) return;
      th.find(".sort-ind").remove();

      let icon = `<i class="fa-solid fa-sort text-muted sort-ind"></i>`;
      if (column === col) {
        icon = dir === "asc" ? `<i class="fa-solid fa-sort-up sort-ind"></i>` : `<i class="fa-solid fa-sort-down sort-ind"></i>`;
      }
      th.append(icon);
    });
  }

  // Update the results count display with current row count
  updateResultsCount() {
    this.resultsCount.text(String(this.rows.size));
  }

  // Get the current order of keys from DOM table rows
  getDomOrderKeys() {
    return this.$tbody.find("tr").toArray().map(tr => tr.dataset.key);
  }

  // Convert value to number for sorting, handling non-numeric values
  num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
  }

  // Convert value to string for sorting, handling null/undefined
  str(v) {
    return (v ?? "").toString();
  }

  // Get sort order for song type (OP=1, ED=2, IN=3, others=99)
  typeOrder(t) {
    const c = this.canonicalType(t);
    return c === "OP" ? 1 : c === "ED" ? 2 : c === "IN" ? 3 : 99;
  }

  // Convert song type to canonical format (OP, ED, IN, or original)
  canonicalType(t) {
    const s = String(t || "").toUpperCase().trim();
    if (s.startsWith("OPENING") || s.startsWith("OP")) return "OP";
    if (s.startsWith("ENDING") || s.startsWith("ED")) return "ED";
    if (s.startsWith("INSERT") || s.startsWith("IN")) return "IN";
    return s;
  }

  // Get sort order for vintage/season values (year*10 + season index)
  vintageOrder(v) {
    if (!v) return 9999999;
    const m = /^(Winter|Spring|Summer|Fall)\s+(\d{4})$/.exec(v);
    if (!m) return 9999999;
    const year = Number(m[2]);
    const s = TableComponent.SeasonOrder.indexOf(m[1]);
    return (Number.isFinite(year) ? year : 999999) * 10 + (s === -1 ? 9 : s);
  }

  // Get all visible data in current DOM order for export
  getVisibleData() {
    const keys = this.getDomOrderKeys();
    const byKey = new Map(Array.from(this.rows.entries()).map(([key, row]) => [key, row.data]));
    return keys.map(k => byKey.get(k)).filter(Boolean);
  }

  // Apply zebra stripe setting to the table
  applyZebraStripe() {
    if (settingsManager.get("zebraStripe")) {
      this.$table.addClass("table-striped");
    } else {
      this.$table.removeClass("table-striped");
    }
  }
}
