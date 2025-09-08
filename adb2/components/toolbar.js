class Toolbar {
  constructor() {
    this.$btnSearch = $("#btnSearch");
    this.$searchQuery = $("#searchQuery");
    this.$searchAnime = $("#searchAnime");
    this.$searchArtist = $("#searchArtist");
    this.$searchSong = $("#searchSong");
    this.$searchComposer = $("#searchComposer");
    this.$searchScope = $("#searchScope");
    this.$btnFilters = $("#btnFilters");
    this.$btnTable = $("#btnTable");
    this.$btnExportCSV = $("#btnExportCSV");
    this.$btnExportJSON = $("#btnExportJSON");
    this.$btnImportJSON = $("#btnImportJSON");
    this.$fileJson = $("#fileJson");
    this.$btnPrevSong = $("#btnPrevSong");
    this.$btnNextSong = $("#btnNextSong");
    this.$btnShuffle = $("#btnShuffle");
    this.$btnReverse = $("#btnReverse");
    this.$btnClearTable = $("#btnClearTable");
    this.$btnSearchMode = $("#btnSearchMode");
    this.$resultMode = $("#resultMode");
    this.$simpleSearchMode = $("#simpleSearchMode");
    this.$advancedSearchMode = $("#advancedSearchMode");
    this.$selFilterType = $("#selFilterType");
    this.wireEvents();
  }

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
    this.$btnImportJSON.on("click", () => this.$fileJson.trigger("click"));
    this.$fileJson.on("change", (event) => tableManager.onUploadJson(event));

    // Player controls
    this.$btnPrevSong.on("click", () => eventBus.emit("audio:previous"));
    this.$btnNextSong.on("click", () => eventBus.emit("audio:next"));

    // Table operations
    this.$btnShuffle.on("click", () => eventBus.emit("table:shuffle"));
    this.$btnReverse.on("click", () => eventBus.emit("table:reverse"));
    this.$btnClearTable.on("click", () => eventBus.emit("table:clear"));

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

  getResultMode() {
    return appState.getStateSlice("ui.resultMode") || "new";
  }

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
