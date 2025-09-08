class SettingsModal {
  constructor() {
    this.$columnOrderList = $("#columnOrderList");
    this.$theme = $("#settingTheme");
    this.$radio = $("#settingRadio");
    this.$fileHost = $("#settingFileHost");
    this.$lang = $("#settingLanguage");
    this.$resetColsOrder = $("#btnResetColumnOrder");
    this.$resetColsVisibility = $("#btnResetColumns");
    this.$zebraStripe = $("#settingZebraStripe");
    this.$importSettings = $("#btnImportSettings");
    this.$exportSettings = $("#btnExportSettings");
    this.$exportPlaylists = $("#btnExportPlaylists");
    this.$importFile = $("#fileImport");
    this.$resetAllSettings = $("#btnResetAllSettings");
    this.$deleteAllPlaylists = $("#btnDeleteAllPlaylists");
    this.wireEvents();
  }

  wireEvents() {
    // React to settings changes
    eventBus.on("settings:changed", () => this.applyToUI());

    // Column management events for settings modal UI
    eventBus.on("ui:column-visibility-changed", () => this.renderColumnOrderList());
    eventBus.on("ui:column-order-changed", () => this.initColumnReordering());

    // Initialize column UI each time settings is opened
    $("#btnSettings").on("click", () => {
      this.renderColumnOrderList();
      this.initColumnReordering();
    });

    // Theme segmented switch
    this.$theme.on("click", ".segment", (e) => {
      const $seg = $(e.currentTarget).find(".segment");
      $seg.removeClass("active");
      $(e.target).addClass("active");
      settingsManager.set("theme", $(e.target).data("value"));
    });

    // Radio mode segmented switch
    this.$radio.on("click", ".segment", (e) => {
      const $seg = $(e.currentTarget).find(".segment");
      $seg.removeClass("active");
      $(e.target).addClass("active");
      settingsManager.set("radioMode", $(e.target).data("value"));
    });

    // File host segmented switch
    this.$fileHost.on("click", ".segment", (e) => {
      const $seg = $(e.currentTarget).find(".segment");
      $seg.removeClass("active");
      $(e.target).addClass("active");
      settingsManager.set("fileHost", $(e.target).data("value"));
    });

    // Language segmented switch
    this.$lang.on("click", ".segment", (e) => {
      const $seg = $(e.currentTarget).find(".segment");
      $seg.removeClass("active");
      $(e.target).addClass("active");
      settingsManager.set("language", $(e.target).data("value"));
    });

    // Column order reset
    this.$resetColsOrder.on("click", () => {
      tableManager.table.resetColumnOrderToDefault();
    });

    // Reset columns button
    this.$resetColsVisibility.on("click", () => {
      settingsManager.resetColumnVisibilityToDefault();
    });

    // Zebra stripe toggle
    this.$zebraStripe.on("change", (e) => {
      settingsManager.set("zebraStripe", e.target.checked);
      tableManager.table.applyZebraStripe();
    });

    // Import/Export/Reset actions
    this.$importSettings.on("click", () => { this.$importFile.trigger("click"); });
    this.$exportSettings.on("click", () => settingsManager.exportSettings());
    this.$exportPlaylists.on("click", () => playlistManager.exportAllPlaylists());
    this.$importFile.on("change", (evt) => settingsManager.onImportFile(evt));
    this.$resetAllSettings.on("click", () => {
      if (confirm("Are you sure you want to reset all settings to defaults? This action cannot be undone.")) {
        settingsManager.resetAllSettings();
      }
    });
    this.$deleteAllPlaylists.on("click", () => playlistManager.deleteAllPlaylists());
  }

  // Apply current settings to the UI elements
  applyToUI() {
    const setSegmentedSwitchSafe = (containerId, value, fallback) => {
      const $container = $(`#${containerId}`);
      if (!$container.length) return fallback;

      $container.find(".segment").removeClass("active");
      const $targetSegment = $container.find(`.segment[data-value="${value}"]`);
      if ($targetSegment.length) {
        $targetSegment.addClass("active");
        return value;
      } else {
        const $fallbackSegment = $container.find(`.segment[data-value="${fallback}"]`);
        if ($fallbackSegment.length) $fallbackSegment.addClass("active");
        return fallback;
      }
    };

    // Ensure defaults are reflected in the UI even with missing/invalid stored values
    settingsManager.settings.theme = setSegmentedSwitchSafe("settingTheme", settingsManager.settings.theme, settingsManager.defaults.theme);
    settingsManager.settings.radioMode = setSegmentedSwitchSafe("settingRadio", settingsManager.settings.radioMode, settingsManager.defaults.radioMode);
    settingsManager.settings.fileHost = setSegmentedSwitchSafe("settingFileHost", settingsManager.settings.fileHost, settingsManager.defaults.fileHost);
    settingsManager.settings.language = setSegmentedSwitchSafe("settingLanguage", settingsManager.settings.language, settingsManager.defaults.language);

    // Initialize zebra stripe toggle
    this.$zebraStripe.prop("checked", settingsManager.settings.zebraStripe);

    // Refresh hotkey inputs
    hotkeyManager.refreshHotkeyInputs();
  }

  // Renders the column order list in the settings modal with drag-and-drop functionality
  renderColumnOrderList() {
    const columnLabels = {
      plus: "Details (+)",
      rownum: "Row Number (#)",
      annid: "ANN ID",
      anime: "Anime",
      type: "Type",
      song: "Song",
      artist: "Artist",
      vintage: "Vintage",
      difficulty: "Difficulty",
      category: "Category",
      broadcast: "Broadcast",
      length: "Length",
      composer: "Composer",
      arranger: "Arranger",
      annSongId: "ANN Song ID",
      amqSongId: "AMQ Song ID",
      anilistId: "AniList ID",
      malId: "MAL ID",
      kitsuId: "Kitsu ID",
      anidbId: "AniDB ID",
      links: "Links",
      action: "Actions"
    };

    const columnOrder = settingsManager.get("columnOrder");
    const visibleColumns = settingsManager.get("visibleColumns");

    const html = columnOrder.map(col => `
        <div class="list-group-item d-flex align-items-center column-item ${visibleColumns[col] ? 'visible' : 'hidden'}" data-column="${col}">
          <span class="js-col-grab drag-handle me-2" title="Drag to reorder">
            <i class="fa-solid fa-grip-vertical text-muted"></i>
          </span>
          <span class="flex-grow-1">${columnLabels[col] || col}</span>
          <span class="visibility-indicator">
            <i class="fa-solid ${visibleColumns[col] ? 'fa-eye' : 'fa-eye-slash'} text-muted"></i>
          </span>
        </div>
      `).join("");

    this.$columnOrderList.html(html);

    // Wire up column visibility toggles (click entire row)
    this.$columnOrderList.find(".column-item").on("click", function (e) {
      // Don't toggle if clicking the drag handle
      if ($(e.target).closest(".js-col-grab").length) return;

      const $item = $(this);
      const col = $item.data("column");
      const isCurrentlyVisible = settingsManager.get("visibleColumns")[col];

      // Toggle visibility
      const newVisibleColumns = { ...settingsManager.get("visibleColumns") };
      newVisibleColumns[col] = !isCurrentlyVisible;
      settingsManager.set("visibleColumns", newVisibleColumns);

      // Update UI
      $item.toggleClass("visible", !isCurrentlyVisible);
      $item.toggleClass("hidden", isCurrentlyVisible);

      const $icon = $item.find(".visibility-indicator i");
      $icon.attr("class", `fa-solid ${!isCurrentlyVisible ? "fa-eye" : "fa-eye-slash"} text-muted`);

      tableManager.table.applyColumnVisibility();
    });
  }

  // Initializes drag-and-drop column reordering functionality using Sortable.js
  initColumnReordering() {
    const listEl = this.$columnOrderList[0];
    if (!listEl) return;
    new Sortable(listEl, {
      handle: ".js-col-grab",
      animation: 150,
      onEnd: () => {
        const newOrder = Array.from(listEl.querySelectorAll("[data-column]")).map(el => el.dataset.column);
        settingsManager.set("columnOrder", newOrder);
        tableManager.table.render();
      }
    });
  }
}

const settingsModal = new SettingsModal();
