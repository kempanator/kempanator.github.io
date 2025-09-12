class Toolbar {
  // Initialize toolbar and cache DOM references
  constructor() {
    // header buttons
    this.$btnPrevSong = $("#btnPrevSong");
    this.$btnNextSong = $("#btnNextSong");
    // Query Inputs
    this.$searchQuery = $("#searchQuery");
    this.$searchAnime = $("#searchAnime");
    this.$searchArtist = $("#searchArtist");
    this.$searchSong = $("#searchSong");
    this.$searchComposer = $("#searchComposer");
    this.$simpleSearchMode = $("#simpleSearchMode");
    this.$advancedSearchMode = $("#advancedSearchMode");
    // Buttons
    this.$btnSearch = $("#btnSearch");
    this.$searchScope = $("#searchScope");
    this.$btnFilters = $("#btnFilters");
    this.$btnTable = $("#btnTable");
    // Data Dropdown
    this.$btnExportCSV = $("#btnExportCSV");
    this.$btnExportJSON = $("#btnExportJSON");
    this.$btnImportFile = $("#btnImportFile");
    this.$songListFileInput = $("#songListFileInput");
    // Request Filters
    this.$chkPartial = $("#chkPartial");
    this.$chkMatchCase = $("#chkMatchCase");
    this.$chkArrangement = $("#chkArrangement");
    this.$chkOP = $("#chkOP");
    this.$chkED = $("#chkED");
    this.$chkIN = $("#chkIN");
    this.$inpMaxOther = $("#inpMaxOther");
    this.$inpGroupMin = $("#inpGroupMin");
    this.$selFilterType = $("#selFilterType");
    this.$chkIgnoreDup = $("#chkIgnoreDup");
    this.$chkNormal = $("#chkNormal");
    this.$chkDub = $("#chkDub");
    this.$chkRebroadcast = $("#chkRebroadcast");
    this.$chkStandard = $("#chkStandard");
    this.$chkCharacter = $("#chkCharacter");
    this.$chkChanting = $("#chkChanting");
    this.$chkInstrumental = $("#chkInstrumental");
    // Table Operations
    this.$btnShuffle = $("#btnShuffle");
    this.$btnReverse = $("#btnReverse");
    this.$btnClearTable = $("#btnClearTable");
    this.$btnSearchMode = $("#btnSearchMode");
    this.$resultMode = $("#resultMode");
    // Client Filters
    this.$cfAction = $("#cfAction");
    this.$cfField = $("#cfField");
    this.$cfQuery = $("#cfQuery");
    this.$cfPartial = $("#cfPartial");
    this.$cfMatchCase = $("#cfMatchCase");
    this.$btnApplyClientFilter = $("#btnApplyClientFilter");
    this.wireEvents();
  }

  // Wire UI events and global event handlers
  wireEvents() {
    // Search UI wiring: trigger submit and manage placeholders
    this.$btnSearch.on("click", () => eventBus.emit("search:submit"));
    this.$searchQuery.on("keydown", e => { if (e.key === "Enter") eventBus.emit("search:submit"); });
    this.$searchAnime.on("keydown", e => { if (e.key === "Enter") eventBus.emit("search:submit"); });
    this.$searchArtist.on("keydown", e => { if (e.key === "Enter") eventBus.emit("search:submit"); });
    this.$searchSong.on("keydown", e => { if (e.key === "Enter") eventBus.emit("search:submit"); });
    this.$searchComposer.on("keydown", e => { if (e.key === "Enter") eventBus.emit("search:submit"); });
    this.$searchScope.on("change", () => this.updateScopePlaceholder());
    this.updateScopePlaceholder();
    // React to searchMode changes (settings:changed event)
    eventBus.on("settings:changed", (payload) => {
      const newMode = payload?.key === "searchMode" ? payload.value : settingsManager.get("searchMode");
      this.applySearchModeUI(newMode);
    });

    // Data operations
    this.$btnExportCSV.on("click", () => tableManager.export("csv"));
    this.$btnExportJSON.on("click", () => tableManager.export("json"));
    this.$btnImportFile.on("click", () => this.$songListFileInput.trigger("click"));
    this.$songListFileInput.on("change", (event) => tableManager.onUploadJson(event));

    // Player controls
    this.$btnPrevSong.on("click", () => eventBus.emit("audio:previous"));
    this.$btnNextSong.on("click", () => eventBus.emit("audio:next"));

    // Table operations
    this.$btnShuffle.on("click", () => eventBus.emit("table:shuffle"));
    this.$btnReverse.on("click", () => eventBus.emit("table:reverse"));
    this.$btnClearTable.on("click", () => eventBus.emit("table:clear"));

    // Client filter apply
    this.$btnApplyClientFilter.on("click", () => this.applyClientFilterFromUI());
    this.$cfQuery.on("keydown", (e) => { if (e.key === "Enter") this.applyClientFilterFromUI(); });

    // Search mode toggle
    this.$btnSearchMode.on("click", () => {
      const isSimple = settingsManager.get("searchMode") === "simple";
      const newMode = isSimple ? "advanced" : "simple";
      settingsManager.set("searchMode", newMode);
    });

    // Result mode button group sync to state
    this.$resultMode.on("click", ".btn", (event) => {
      const $target = $(event.currentTarget);
      const mode = $target.data("mode") || "new";
      this.$resultMode.find(".btn").removeClass("active").attr("aria-pressed", "false");
      $target.addClass("active").attr("aria-pressed", "true");
      appState.updateStateSlice("ui.resultMode", () => mode);
    });
  }

  // Read current search input values
  getSearchInputs() {
    const mode = settingsManager.get("searchMode");
    if (mode === "advanced") {
      return {
        anime: String(this.$searchAnime.val() || "").trim(),
        artist: String(this.$searchArtist.val() || "").trim(),
        song: String(this.$searchSong.val() || "").trim(),
        composer: String(this.$searchComposer.val() || "").trim()
      };
    }
    return {
      scope: this.$searchScope.val(),
      query: String(this.$searchQuery.val() || "").trim()
    };
  }

  // Read toggle states for building search payloads
  getToggleStates() {
    const isAdvanced = settingsManager.get("searchMode") === "advanced";
    return {
      partial_match: this.$chkPartial.is(":checked"),
      match_case: this.$chkMatchCase.is(":checked"),
      arrangement: this.$chkArrangement.is(":checked"),
      opening_filter: this.$chkOP.is(":checked"),
      ending_filter: this.$chkED.is(":checked"),
      insert_filter: this.$chkIN.is(":checked"),
      max_other_artist: parseInt(this.$inpMaxOther.val(), 10) || 0,
      group_granularity: parseInt(this.$inpGroupMin.val(), 10) || 0,
      and_logic: isAdvanced ? this.$selFilterType.val() === "intersection" : false,
      ignore_duplicate: this.$chkIgnoreDup.is(":checked"),
      normal_broadcast: this.$chkNormal.is(":checked"),
      dub: this.$chkDub.is(":checked"),
      rebroadcast: this.$chkRebroadcast.is(":checked"),
      standard: this.$chkStandard.is(":checked"),
      character: this.$chkCharacter.is(":checked"),
      chanting: this.$chkChanting.is(":checked"),
      instrumental: this.$chkInstrumental.is(":checked")
    };
  }

  // Switch UI between simple and advanced search modes
  applySearchModeUI(mode) {
    const isAdvanced = mode === "advanced";
    if (isAdvanced) {
      this.$simpleSearchMode.addClass("d-none");
      this.$advancedSearchMode.removeClass("d-none");
      this.$selFilterType.prop("disabled", false);
      this.$btnSearchMode.attr("title", "Switch to Simple Search");
      this.$btnSearchMode.find(".btn-label").text("Advanced");
    } else {
      this.$advancedSearchMode.addClass("d-none");
      this.$simpleSearchMode.removeClass("d-none");
      this.$selFilterType.prop("disabled", true);
      this.$btnSearchMode.attr("title", "Switch to Advanced Search");
      this.$btnSearchMode.find(".btn-label").text("Simple");
    }
  }

  // Get the current result mode ("new" or "append")
  getResultMode() {
    return appState.getStateSlice("ui.resultMode") || "new";
  }

  // Emit client filter payload from UI controls
  applyClientFilterFromUI() {
    const payload = {
      action: this.$cfAction.val(),
      field: this.$cfField.val(),
      query: String(this.$cfQuery.val() || ""),
      partial: this.$cfPartial.is(":checked"),
      match_case: this.$cfMatchCase.is(":checked")
    };
    eventBus.emit("table:client-filter-apply", payload);
  }

  // Update placeholder for the simple search input based on scope
  updateScopePlaceholder() {
    const scope = this.$searchScope.val();
    const placeholderMap = {
      Anime: "Search anime",
      Artist: "Search artist",
      Song: "Search song",
      Composer: "Search composer",
      Season: "e.g. Winter 2024",
      ANN: "Enter ANN ID(s), comma-separated",
      ANN_SONG: "Enter ANN Song ID(s), comma-separated",
      AMQ_SONG: "Enter AMQ Song ID(s), comma-separated",
      MAL: "Enter MAL ID(s), comma-separated"
    };
    const placeholder = placeholderMap[scope] || "Search anime, artist, song, composer";
    this.$searchQuery.attr("placeholder", placeholder);
  }
}

const toolbar = new Toolbar();
