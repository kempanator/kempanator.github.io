"use strict";

// =====================
// Config & Persistence
// =====================
const API_BASE = "https://anisongdb.com";
const SETTINGS_KEY = "adb_settings";
const DefaultSettings = {
  theme: "dark",
  radioMode: "none", // none | repeat | loopAll
  catboxHost: "nawdist",
  language: "english", // english | romaji
  searchMode: "simple", // simple | advanced
  hotkeys: { downloadJson: "", playPause: "", prev: "", next: "" },
  visibleColumns: {
    plus: true,
    rownum: true,
    annid: true,
    anime: true,
    type: true,
    song: true,
    artist: true,
    vintage: true,
    difficulty: true,
    category: false,
    broadcast: false,
    length: false,
    composer: false,
    arranger: false,
    annSongId: false,
    amqSongId: false,
    anilistId: false,
    malId: false,
    kitsuId: false,
    anidbId: false,
    links: true,
    action: true
  }
};
const SeasonOrder = ["Winter", "Spring", "Summer", "Fall"];

const AppState = {
  settings: loadSettings(),
  results: { raw: [], visible: [], removedKeys: new Set(), sort: { column: null, dir: null }, manualOrderActive: false },
  player: { currentKey: null },
  meta: { lastEndpoint: null, lastRequestBody: null, lastSeasonQuery: null },
  aborter: null
};

// Apply theme ASAP
applyTheme();

// ======
// Ready
// ======
$(document).ready(function () {
  applySettingsToUI();
  wireSettingsEvents();
  initHotkeyInputs();

  updateScopePlaceholder();
  $("#searchScope").on("change", updateScopePlaceholder);
  $("#btnSearch").on("click", onSearchSubmit);
  $("#searchQuery").on("keydown", e => { if (e.key === "Enter") onSearchSubmit(); });
  $("#searchAnime").on("keydown", e => { if (e.key === "Enter") onSearchSubmit(); });
  $("#searchArtist").on("keydown", e => { if (e.key === "Enter") onSearchSubmit(); });
  $("#searchSong").on("keydown", e => { if (e.key === "Enter") onSearchSubmit(); });
  $("#searchComposer").on("keydown", e => { if (e.key === "Enter") onSearchSubmit(); });
  $("#resultsTable thead").on("click", "th", onHeaderSortClick);
  $("#resultsTable tbody").on("click", ".js-play-track", onRowPlayClick);
  $("#resultsTable tbody").on("click", ".js-trash", onRowTrashClick);
  $("#resultsTable tbody").on("click", ".js-info", onRowInfoClick);
  // Mobile cards events
  $("#resultsCards").on("click", ".js-play-track", onRowPlayClick);
  $("#resultsCards").on("click", ".js-trash", onRowTrashClick);
  $("#resultsCards").on("click", ".js-info", onRowInfoClick);
  $("#btnDownloadJson").on("click", downloadRawJson);
  $("#btnUploadJson").on("click", () => $("#fileJson").trigger("click"));
  $("#fileJson").on("change", onUploadJson);
  $("#btnPrevSong").on("click", playPrev);
  $("#btnNextSong").on("click", playNext);
  $("#btnShuffle").on("click", shuffleTable);

  // Mobile: toggle compact/full columns
  $("#btnToggleColumns").on("click", function () {
    const tbl = document.getElementById("resultsTable");
    const compact = tbl.classList.toggle("mobile-compact");
    this.textContent = compact ? "Show all columns" : "Show fewer columns";
  });

  // Result mode btn-group
  $("#resultMode").on("click", ".btn", function () {
    const group = $("#resultMode");
    group.find(".btn").removeClass("active").attr("aria-pressed", "false");
    $(this).addClass("active").attr("aria-pressed", "true");
  });

  // Search mode toggle
  $("#btnSearchMode").on("click", function () {
    const isSimple = AppState.settings.searchMode === "simple";
    AppState.settings.searchMode = isSimple ? "advanced" : "simple";

    if (isSimple) {
      // Switch to advanced mode
      $("#simpleSearchMode").addClass("d-none");
      $("#advancedSearchMode").removeClass("d-none");
      $("#selFilterType").prop("disabled", false);
      $(this).attr("title", "Switch to Simple Search");
      $(this).find(".btn-label").text("Advanced");
    } else {
      // Switch to simple mode
      $("#advancedSearchMode").addClass("d-none");
      $("#simpleSearchMode").removeClass("d-none");
      $("#selFilterType").prop("disabled", true);
      $(this).attr("title", "Switch to Advanced Search");
      $(this).find(".btn-label").text("Simple");
    }

    // Save the setting to localStorage
    saveSettings();
  });

  new Sortable(document.querySelector("#resultsTable tbody"), {
    handle: ".js-grab", animation: 150,
    onEnd: () => {
      AppState.results.manualOrderActive = true;
      const domKeys = getDomOrderKeys();
      AppState.results.visible.sort((a, b) => domKeys.indexOf(rowKey(a)) - domKeys.indexOf(rowKey(b)));
      renderTable();
    }
  });

  const audio = document.getElementById("player");
  audio.addEventListener("ended", onAudioEnded);
  audio.addEventListener("pause", onAudioPause);
  audio.addEventListener("play", onAudioPlay);

  $("#infoViewMode").on("change", updateInfoViewMode);
  $("#btnInfoPrev").on("click", onInfoPrev);
  $("#btnInfoNext").on("click", onInfoNext);

  // Initialize Bootstrap popovers
  const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
  popoverTriggerList.map(function (popoverTriggerEl) {
    return new bootstrap.Popover(popoverTriggerEl);
  });
});

// =========
// Settings
// =========
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const base = raw ? JSON.parse(raw) : {};
    const merged = { ...structuredClone(DefaultSettings), ...base, hotkeys: { ...DefaultSettings.hotkeys, ...(base.hotkeys || {}) } };
    const sanitized = sanitizeSettings(merged);
    return sanitized;
  } catch {
    return structuredClone(DefaultSettings);
  }
}
function sanitizeSettings(s) {
  const out = { ...structuredClone(DefaultSettings), ...s };
  const validTheme = new Set(["dark", "light"]);
  const validRadio = new Set(["none", "repeat", "loopAll"]);
  const validHost = new Set(["eudist", "nawdist", "naedist"]);
  const validLang = new Set(["english", "romaji"]);
  const validSearchMode = new Set(["simple", "advanced"]);
  if (!validTheme.has(out.theme)) out.theme = DefaultSettings.theme;
  if (!validRadio.has(out.radioMode)) out.radioMode = DefaultSettings.radioMode;
  if (!validHost.has(out.catboxHost)) out.catboxHost = DefaultSettings.catboxHost;
  if (!validLang.has(out.language)) out.language = DefaultSettings.language;
  if (!validSearchMode.has(out.searchMode)) out.searchMode = DefaultSettings.searchMode;
  if (!out.hotkeys || typeof out.hotkeys !== "object") out.hotkeys = { ...DefaultSettings.hotkeys };
  else {
    const hk = { ...DefaultSettings.hotkeys, ...out.hotkeys };
    Object.keys(hk).forEach(k => hk[k] = typeof hk[k] === "string" ? hk[k] : "");
    out.hotkeys = hk;
  }
  if (!out.visibleColumns || typeof out.visibleColumns !== "object") out.visibleColumns = { ...DefaultSettings.visibleColumns };
  else {
    const vc = { ...DefaultSettings.visibleColumns, ...out.visibleColumns };
    Object.keys(vc).forEach(k => vc[k] = typeof vc[k] === "boolean" ? vc[k] : DefaultSettings.visibleColumns[k]);
    out.visibleColumns = vc;
  }
  return out;
}
function saveSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(AppState.settings)); }
function applyTheme() { document.documentElement.setAttribute("data-bs-theme", AppState.settings.theme === "dark" ? "dark" : "light"); }
function applySettingsToUI() {
  const setSegmentedSwitchSafe = (containerId, value, fallback) => {
    const container = document.getElementById(containerId);
    if (!container) return fallback;

    // Remove active class from all segments
    container.querySelectorAll(".segment").forEach(seg => seg.classList.remove("active"));

    // Find and activate the correct segment
    const targetSegment = container.querySelector(`[data-value="${value}"]`);
    if (targetSegment) {
      targetSegment.classList.add("active");
      return value;
    } else {
      // Fallback to default
      const fallbackSegment = container.querySelector(`[data-value="${fallback}"]`);
      if (fallbackSegment) {
        fallbackSegment.classList.add("active");
      }
      return fallback;
    }
  };

  // Ensure defaults are reflected in the UI even with missing/invalid stored values
  AppState.settings.theme = setSegmentedSwitchSafe("settingTheme", AppState.settings.theme, DefaultSettings.theme);
  AppState.settings.radioMode = setSegmentedSwitchSafe("settingRadio", AppState.settings.radioMode, DefaultSettings.radioMode);
  AppState.settings.catboxHost = setSegmentedSwitchSafe("settingCatbox", AppState.settings.catboxHost, DefaultSettings.catboxHost);
  AppState.settings.language = setSegmentedSwitchSafe("settingLanguage", AppState.settings.language, DefaultSettings.language);

  // Initialize search mode UI
  initializeSearchMode();

  // Initialize column visibility settings
  initializeColumnVisibility();

  saveSettings();
}

function initializeSearchMode() {
  const isAdvanced = AppState.settings.searchMode === "advanced";

  if (isAdvanced) {
    // Switch to advanced mode
    $("#simpleSearchMode").addClass("d-none");
    $("#advancedSearchMode").removeClass("d-none");
    $("#selFilterType").prop("disabled", false);
    $("#btnSearchMode").attr("title", "Switch to Simple Search");
    $("#btnSearchMode").find(".btn-label").text("Advanced");
  } else {
    // Switch to simple mode
    $("#advancedSearchMode").addClass("d-none");
    $("#simpleSearchMode").removeClass("d-none");
    $("#selFilterType").prop("disabled", true);
    $("#btnSearchMode").attr("title", "Switch to Advanced Search");
    $("#btnSearchMode").find(".btn-label").text("Simple");
  }
}

function initializeColumnVisibility() {
  const columnCheckboxMap = {
    plus: "colPlus",
    rownum: "colRownum",
    annid: "colAnnid",
    anime: "colAnime",
    type: "colType",
    song: "colSong",
    artist: "colArtist",
    vintage: "colVintage",
    difficulty: "colDifficulty",
    category: "colCategory",
    broadcast: "colBroadcast",
    length: "colLength",
    composer: "colComposer",
    arranger: "colArranger",
    annSongId: "colAnnSongId",
    amqSongId: "colAmqSongId",
    anilistId: "colAnilistId",
    malId: "colMalId",
    kitsuId: "colKitsuId",
    anidbId: "colAnidbId",
    links: "colLinks",
    action: "colAction"
  };

  // Set checkbox states based on settings
  Object.keys(AppState.settings.visibleColumns).forEach(col => {
    const checkboxId = columnCheckboxMap[col];
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) {
      checkbox.checked = AppState.settings.visibleColumns[col];
    }
  });

  // Apply column visibility to table
  applyColumnVisibility();
}

function applyColumnVisibility() {
  const table = document.getElementById("resultsTable");
  if (!table) return;

  const columnOrder = [
    "plus", "rownum", "annid", "anime", "type", "song", "artist", "vintage", "difficulty",
    "category", "broadcast", "length", "composer", "arranger", "annSongId", "amqSongId", "anilistId", "malId", "kitsuId", "anidbId", "links", "action"
  ];

  // Apply visibility to colgroup
  const colgroup = table.querySelector("colgroup");
  if (colgroup) {
    colgroup.querySelectorAll("col").forEach((col, index) => {
      const colClass = columnOrder[index];
      const isVisible = AppState.settings.visibleColumns[colClass];
      col.style.display = isVisible ? "" : "none";
    });
  }

  // Apply visibility to header
  const thead = table.querySelector("thead");
  if (thead) {
    thead.querySelectorAll("th").forEach((th, index) => {
      const colClass = columnOrder[index];
      const isVisible = AppState.settings.visibleColumns[colClass];
      th.style.display = isVisible ? "" : "none";
    });
  }

  // Apply visibility to body rows
  const tbody = table.querySelector("tbody");
  if (tbody) {
    tbody.querySelectorAll("tr").forEach(tr => {
      tr.querySelectorAll("td").forEach((td, index) => {
        const colClass = columnOrder[index];
        const isVisible = AppState.settings.visibleColumns[colClass];
        td.style.display = isVisible ? "" : "none";
      });
    });
  }
}


function wireSettingsEvents() {
  // Theme segmented switch
  document.getElementById("settingTheme").addEventListener("click", function (e) {
    if (e.target.classList.contains("segment")) {
      // Remove active class from all segments
      this.querySelectorAll(".segment").forEach(seg => seg.classList.remove("active"));
      // Add active class to clicked segment
      e.target.classList.add("active");
      // Update setting
      AppState.settings.theme = e.target.dataset.value;
      saveSettings();
      applyTheme();
    }
  });

  // Radio mode segmented switch
  document.getElementById("settingRadio").addEventListener("click", function (e) {
    if (e.target.classList.contains("segment")) {
      this.querySelectorAll(".segment").forEach(seg => seg.classList.remove("active"));
      e.target.classList.add("active");
      AppState.settings.radioMode = e.target.dataset.value;
      saveSettings();
    }
  });

  // Catbox host segmented switch
  document.getElementById("settingCatbox").addEventListener("click", function (e) {
    if (e.target.classList.contains("segment")) {
      this.querySelectorAll(".segment").forEach(seg => seg.classList.remove("active"));
      e.target.classList.add("active");
      AppState.settings.catboxHost = e.target.dataset.value;
      saveSettings();
      // Rerender links for new host; if playing, update current src
      renderTable();
      if (AppState.player.currentKey) {
        const tr = document.querySelector(`#resultsTable tbody tr[data-key="${CSS.escape(AppState.player.currentKey)}"]`);
        if (tr) {
          const a = document.getElementById("player");
          const src = pickBestUrl(tr);
          if (src) {
            a.src = src;
            if (!a.paused) a.play();
          }
        }
      }
    }
  });

  // Language segmented switch
  document.getElementById("settingLanguage").addEventListener("click", function (e) {
    if (e.target.classList.contains("segment")) {
      this.querySelectorAll(".segment").forEach(seg => seg.classList.remove("active"));
      e.target.classList.add("active");
      AppState.settings.language = e.target.dataset.value;
      saveSettings();
      renderTable();
    }
  });

  // Column visibility checkboxes
  const columnCheckboxMap = {
    plus: "colPlus",
    rownum: "colRownum",
    annid: "colAnnid",
    anime: "colAnime",
    type: "colType",
    song: "colSong",
    artist: "colArtist",
    vintage: "colVintage",
    difficulty: "colDifficulty",
    category: "colCategory",
    broadcast: "colBroadcast",
    length: "colLength",
    composer: "colComposer",
    arranger: "colArranger",
    annSongId: "colAnnSongId",
    amqSongId: "colAmqSongId",
    anilistId: "colAnilistId",
    malId: "colMalId",
    kitsuId: "colKitsuId",
    anidbId: "colAnidbId",
    links: "colLinks",
    action: "colAction"
  };

  Object.keys(AppState.settings.visibleColumns).forEach(col => {
    const checkboxId = columnCheckboxMap[col];
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) {
      checkbox.addEventListener("change", function () {
        AppState.settings.visibleColumns[col] = this.checked;
        saveSettings();
        applyColumnVisibility();
      });
    }
  });

  // Reset columns button
  const resetButton = document.getElementById("btnResetColumns");
  if (resetButton) {
    resetButton.addEventListener("click", function () {
      resetColumnVisibilityToDefault();
    });
  }
}

// =======
// Hotkeys
// =======
function initHotkeyInputs() {
  ["downloadJson", "playPause", "prev", "next"].forEach(k => {
    const elId = { downloadJson: "hkDownloadJson", playPause: "hkPlayPause", prev: "hkPrev", next: "hkNext" }[k];
    const el = document.getElementById(elId); if (!el) return;
    el.value = AppState.settings.hotkeys[k] || "";
    el.addEventListener("keydown", e => captureHotkey(e, el, k));
  });
  document.addEventListener("keydown", handleGlobalHotkeys);
}
function captureHotkey(e, el, keyName) {
  e.preventDefault(); e.stopPropagation();
  if (e.key === "Escape") return;
  if (["Backspace", "Delete"].includes(e.key)) {
    AppState.settings.hotkeys[keyName] = ""; el.value = ""; saveSettings(); return;
  }
  const combo = normalizeCombo(e); if (!combo) return;
  for (const [k, v] of Object.entries(AppState.settings.hotkeys)) {
    if (k !== keyName && v && v === combo) { el.classList.add("is-invalid"); setTimeout(() => el.classList.remove("is-invalid"), 600); return; }
  }
  AppState.settings.hotkeys[keyName] = combo; el.value = combo.replaceAll("+", " + "); saveSettings();
}
function normalizeCombo(e) {
  const key = (e.key || "").toUpperCase();
  if (["SHIFT", "CONTROL", "ALT", "META"].includes(key)) return "";
  const parts = [];
  if (e.ctrlKey) parts.push("CTRL");
  if (e.metaKey) parts.push("META");
  if (e.altKey) parts.push("ALT");
  if (e.shiftKey) parts.push("SHIFT");
  let k = key; if (k === " ") k = "SPACE"; if (k.startsWith("ARROW")) k = k.replace("ARROW", "");
  parts.push(k);
  return parts.join("+");
}
function handleGlobalHotkeys(e) {
  const tag = (document.activeElement?.tagName || "").toLowerCase();
  const editable = document.activeElement?.isContentEditable;
  if (["input", "textarea", "select"].includes(tag) || editable) return;

  // Check if info modal is open and handle arrow keys for navigation
  const modal = document.getElementById("infoModal");
  if (modal && modal.classList.contains("show")) {
    const key = (e.key || "").toUpperCase();
    if (["ARROWLEFT", "ARROWRIGHT", "ARROWUP", "ARROWDOWN"].includes(key)) {
      e.preventDefault();
      switch (key) {
        case "ARROWLEFT":
        case "ARROWUP":
          return onInfoPrev();
        case "ARROWRIGHT":
        case "ARROWDOWN":
          return onInfoNext();
      }
    }
  }

  const combo = normalizeCombo(e); if (!combo) return;
  switch (combo) {
    case AppState.settings.hotkeys.downloadJson: return downloadRawJson();
    case AppState.settings.hotkeys.playPause: return togglePlayPause();
    case AppState.settings.hotkeys.prev: return playPrev();
    case AppState.settings.hotkeys.next: return playNext();
  }
}

// ==========
// Searching
// ==========
function updateScopePlaceholder() {
  const s = $("#searchScope").val();
  const map = { Anime: "Search anime", Artist: "Search artist", Song: "Search song", Composer: "Search composer", Season: "e.g. Winter 2024", ANN: "Enter ANN ID(s), comma-separated", MAL: "Enter MAL ID(s), comma-separated" };
  $("#searchQuery").attr("placeholder", map[s] || "Search anime, artist, song, composer");
}

function onSearchSubmit() {
  clearAlert();
  const mode = document.querySelector("#resultMode .btn.active")?.dataset.mode || "new";
  const isAppend = (mode === "append");
  if (!isAppend) {
    AppState.results.removedKeys.clear();
    AppState.results.manualOrderActive = false;
    AppState.results.sort = { column: null, dir: null };
  }

  const t = readToggles();

  if (AppState.aborter) { AppState.aborter.abort(); }
  AppState.aborter = new AbortController();

  if (AppState.settings.searchMode === "advanced") {
    // Advanced search mode - use individual fields
    const anime = $("#searchAnime").val().trim();
    const artist = $("#searchArtist").val().trim();
    const song = $("#searchSong").val().trim();
    const composer = $("#searchComposer").val().trim();

    // Check if at least one field has content
    if (!anime && !artist && !song && !composer) {
      return showAlert("Please enter at least one search term.", "warning");
    }

    const body = buildAdvancedSearchBody(anime, artist, song, composer, t);
    AppState.meta.lastEndpoint = "/api/search_request";
    AppState.meta.lastRequestBody = body;
    postJson(`${API_BASE}/api/search_request`, body)
      .then(data => {
        AppState.results.raw = data;
        const newRows = applyClientSideFiltering(data.slice(), t);
        if (isAppend) {
          AppState.results.visible = AppState.results.visible.concat(newRows);
          AppState.results.manualOrderActive = true;
          AppState.results.sort = { column: null, dir: null };
        } else {
          AppState.results.visible = newRows;
        }
        renderTable();
      })
      .catch(onFetchError);
    return;
  }

  // Simple search mode - original logic
  const scope = $("#searchScope").val();
  const q = $("#searchQuery").val().trim();

  if (scope === "Season") {
    const seasonStr = parseSeason(q);
    if (!seasonStr) { return showAlert("Invalid season. Use e.g. 'Spring 2024'.", "warning"); }
    AppState.meta.lastEndpoint = "/api/filter_season";
    AppState.meta.lastSeasonQuery = seasonStr;
    fetch(`${API_BASE}/api/filter_season?season=${encodeURIComponent(seasonStr)}`, { signal: AppState.aborter.signal })
      .then(okJson)
      .then(data => {
        AppState.results.raw = data;
        const filteredData = seasonClientFilter(data, t);
        const newRows = applyClientSideFiltering(filteredData, t);
        if (isAppend) {
          AppState.results.visible = AppState.results.visible.concat(newRows);
          AppState.results.manualOrderActive = true;
          AppState.results.sort = { column: null, dir: null };
        } else {
          AppState.results.visible = newRows;
        }
        renderTable();
      })
      .catch(onFetchError);
    return;
  }

  if (scope === "ANN") {
    const ids = q.split(",").map(s => s.trim()).filter(Boolean);
    if (ids.some(id => !/^\d+$/.test(id))) return showAlert("ANN IDs must be numeric (comma-separated).", "warning");
    if (ids.length > 500) return showAlert("Too many ANN IDs (max 500).", "warning");
    const body = buildAnnBody(ids.map(Number), t);
    AppState.meta.lastEndpoint = "/api/annIdList_request";
    AppState.meta.lastRequestBody = body;
    postJson(`${API_BASE}/api/annIdList_request`, body)
      .then(data => {
        AppState.results.raw = data;
        const newRows = applyClientSideFiltering(data.slice(), t);
        if (isAppend) {
          AppState.results.visible = AppState.results.visible.concat(newRows);
          AppState.results.manualOrderActive = true;
          AppState.results.sort = { column: null, dir: null };
        } else {
          AppState.results.visible = newRows;
        }
        renderTable();
      })
      .catch(onFetchError);
    return;
  }

  if (scope === "MAL") {
    const ids = q.split(",").map(s => s.trim()).filter(Boolean);
    if (ids.some(id => !/^\d+$/.test(id))) return showAlert("MAL IDs must be numeric (comma-separated).", "warning");
    if (ids.length > 500) return showAlert("Too many MAL IDs (max 500).", "warning");
    const body = buildMalBody(ids.map(Number), t);
    AppState.meta.lastEndpoint = "/api/malIDs_request";
    AppState.meta.lastRequestBody = body;
    postJson(`${API_BASE}/api/malIDs_request`, body)
      .then(data => {
        AppState.results.raw = data;
        const newRows = applyClientSideFiltering(data.slice(), t);
        if (isAppend) {
          AppState.results.visible = AppState.results.visible.concat(newRows);
          AppState.results.manualOrderActive = true;
          AppState.results.sort = { column: null, dir: null };
        } else {
          AppState.results.visible = newRows;
        }
        renderTable();
      })
      .catch(onFetchError);
    return;
  }

  // All/Anime/Artist/Song/Composer => search_request
  const body = buildSearchBody(scope, q, t);
  AppState.meta.lastEndpoint = "/api/search_request";
  AppState.meta.lastRequestBody = body;
  postJson(`${API_BASE}/api/search_request`, body)
    .then(data => {
      AppState.results.raw = data;
      const newRows = applyClientSideFiltering(data.slice(), t);
      if (isAppend) {
        AppState.results.visible = AppState.results.visible.concat(newRows);
        AppState.results.manualOrderActive = true;
        AppState.results.sort = { column: null, dir: null };
      } else {
        AppState.results.visible = newRows;
      }
      renderTable();
    })
    .catch(onFetchError);
}

function readToggles() {
  return {
    partial_match: $("#chkPartial").is(":checked"),
    match_case: $("#chkMatchCase").is(":checked"),
    arrangement: $("#chkArrangement").is(":checked"),
    opening_filter: $("#chkOP").is(":checked"),
    ending_filter: $("#chkED").is(":checked"),
    insert_filter: $("#chkIN").is(":checked"),
    max_other_artist: parseInt($("#inpMaxOther").val(), 10) || 0,
    group_granularity: parseInt($("#inpGroupMin").val(), 10) || 0,
    and_logic: $("#selFilterType").val() === "intersection",
    ignore_duplicate: $("#chkIgnoreDup").is(":checked"),
    normal_broadcast: $("#chkNormal").is(":checked"),
    dub: $("#chkDub").is(":checked"),
    rebroadcast: $("#chkRebroadcast").is(":checked"),
    standard: $("#chkStandard").is(":checked"),
    character: $("#chkCharacter").is(":checked"),
    chanting: $("#chkChanting").is(":checked"),
    instrumental: $("#chkInstrumental").is(":checked")
  };
}

// Build minimal body for /api/search_request: include only the active scope's filter (All includes all four)
function buildSearchBody(scope, q, t) {
  const base = {
    and_logic: t.and_logic,
    ignore_duplicate: t.ignore_duplicate,
    opening_filter: t.opening_filter,
    ending_filter: t.ending_filter,
    insert_filter: t.insert_filter,
    normal_broadcast: t.normal_broadcast,
    dub: t.dub,
    rebroadcast: t.rebroadcast,
    standard: t.standard,
    character: t.character,
    chanting: t.chanting,
    instrumental: t.instrumental
  };

  const anime = { search: q, partial_match: t.partial_match, group_granularity: t.group_granularity, max_other_artist: t.max_other_artist };
  const song = { search: q, partial_match: t.partial_match };
  const artist = { search: q, partial_match: t.partial_match, group_granularity: t.group_granularity, max_other_artist: t.max_other_artist };
  const composer = { search: q, partial_match: t.partial_match, arrangement: t.arrangement };

  switch (scope) {
    case "Anime":
      return { ...base, anime_search_filter: anime };
    case "Song":
      return { ...base, song_name_search_filter: song };
    case "Artist":
      return { ...base, artist_search_filter: artist };
    case "Composer":
      return { ...base, composer_search_filter: composer };
    case "All":
    default:
      return {
        ...base,
        anime_search_filter: anime,
        song_name_search_filter: song,
        artist_search_filter: artist,
        composer_search_filter: composer
      };
  }
}

function buildAdvancedSearchBody(anime, artist, song, composer, t) {
  const base = {
    and_logic: t.and_logic,
    ignore_duplicate: t.ignore_duplicate,
    opening_filter: t.opening_filter,
    ending_filter: t.ending_filter,
    insert_filter: t.insert_filter,
    normal_broadcast: t.normal_broadcast,
    dub: t.dub,
    rebroadcast: t.rebroadcast,
    standard: t.standard,
    character: t.character,
    chanting: t.chanting,
    instrumental: t.instrumental
  };

  const result = { ...base };

  // Only add search filters if they have values
  if (anime && anime.trim()) {
    result.anime_search_filter = {
      search: anime,
      partial_match: t.partial_match,
      group_granularity: t.group_granularity,
      max_other_artist: t.max_other_artist
    };
  }

  if (artist && artist.trim()) {
    result.artist_search_filter = {
      search: artist,
      partial_match: t.partial_match,
      group_granularity: t.group_granularity,
      max_other_artist: t.max_other_artist
    };
  }

  if (song && song.trim()) {
    result.song_name_search_filter = {
      search: song,
      partial_match: t.partial_match
    };
  }

  if (composer && composer.trim()) {
    result.composer_search_filter = {
      search: composer,
      partial_match: t.partial_match,
      arrangement: t.arrangement
    };
  }

  return result;
}

function buildAnnBody(annIds, t) {
  return {
    annIds,
    ignore_duplicate: t.ignore_duplicate,
    opening_filter: t.opening_filter,
    ending_filter: t.ending_filter,
    insert_filter: t.insert_filter,
    normal_broadcast: t.normal_broadcast,
    dub: t.dub,
    rebroadcast: t.rebroadcast,
    standard: t.standard,
    character: t.character,
    chanting: t.chanting,
    instrumental: t.instrumental
  };
}
function buildMalBody(ids, t) {
  return {
    malIds: ids,
    ignore_duplicate: t.ignore_duplicate,
    opening_filter: t.opening_filter,
    ending_filter: t.ending_filter,
    insert_filter: t.insert_filter,
    normal_broadcast: t.normal_broadcast,
    dub: t.dub,
    rebroadcast: t.rebroadcast,
    standard: t.standard,
    character: t.character,
    chanting: t.chanting,
    instrumental: t.instrumental
  };
}

function parseSeason(q) {
  const m = /^(Winter|Spring|Summer|Fall)\s+(\d{4})$/i.exec(q.trim());
  if (!m) return null;
  return m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase() + " " + m[2];
}

function seasonClientFilter(rows, t) {
  if (!Array.isArray(rows)) return [];
  const allowedTypes = new Set([
    ...(t.opening_filter ? ["OP"] : []),
    ...(t.ending_filter ? ["ED"] : []),
    ...(t.insert_filter ? ["IN"] : [])
  ]);
  const allowedBroadcasts = new Set([
    ...(t.normal_broadcast ? ["Normal"] : []),
    ...(t.dub ? ["Dub"] : []),
    ...(t.rebroadcast ? ["Rebroadcast"] : [])
  ]);
  const allowedCats = new Set([
    ...(t.standard ? ["Standard"] : []),
    ...(t.character ? ["Character"] : []),
    ...(t.chanting ? ["Chanting"] : []),
    ...(t.instrumental ? ["Instrumental"] : [])
  ]);
  const normType = (v) => {
    const s = String(v || "").toUpperCase();
    if (s.startsWith("OPENING") || s.startsWith("OP")) return "OP";
    if (s.startsWith("ENDING") || s.startsWith("ED")) return "ED";
    if (s.startsWith("INSERT") || s.startsWith("IN")) return "IN";
    return s;
  };
  const getBroadcast = (r) => (r.isDub === true || r.dub === true) ? "Dub" : ((r.isRebroadcast === true || r.rebroadcast === true) ? "Rebroadcast" : "Normal");
  const getCategory = (r) => r.songCategory || r.category || "No Category";

  return rows.filter(r => {
    const songType = normType(r.songType || r.type);
    const okType = allowedTypes.size ? allowedTypes.has(songType) : true;
    const okBroadcast = allowedBroadcasts.size ? allowedBroadcasts.has(getBroadcast(r)) : true;
    const cat = getCategory(r);
    const okCat = (cat === "No Category") || allowedCats.has(cat);
    return okType && okBroadcast && okCat;
  });
}

function applyClientSideFiltering(rows, t) {
  if (!Array.isArray(rows)) return rows;

  // If match case is not enabled, return original results
  if (!t.match_case) return rows;

  // Get search terms from the current search inputs
  const searchTerms = [];

  if (AppState.settings.searchMode === "advanced") {
    // Advanced search mode - get from individual fields
    const anime = $("#searchAnime").val().trim();
    const artist = $("#searchArtist").val().trim();
    const song = $("#searchSong").val().trim();
    const composer = $("#searchComposer").val().trim();

    if (anime) searchTerms.push({ field: 'anime', term: anime });
    if (artist) searchTerms.push({ field: 'artist', term: artist });
    if (song) searchTerms.push({ field: 'song', term: song });
    if (composer) searchTerms.push({ field: 'composer', term: composer });
  } else {
    // Simple search mode - get from main search query
    const query = $("#searchQuery").val().trim();
    const scope = $("#searchScope").val();

    if (query) {
      if (scope === "All") {
        // For "All" scope, search across multiple fields
        searchTerms.push({ field: 'anime', term: query });
        searchTerms.push({ field: 'artist', term: query });
        searchTerms.push({ field: 'song', term: query });
        searchTerms.push({ field: 'composer', term: query });
      } else {
        searchTerms.push({ field: scope.toLowerCase(), term: query });
      }
    }
  }

  // If no search terms, return original results
  if (searchTerms.length === 0) return rows;

  return rows.filter(row => {
    // For "All" scope, we need to check if ANY field matches
    if (searchTerms.length > 0 && searchTerms.every(st => ['anime', 'artist', 'song', 'composer'].includes(st.field))) {
      // This is an "All" scope search - check if ANY field matches
      return searchTerms.some(({ field, term }) => {
        let fieldValue = "";

        switch (field) {
          case 'anime':
            fieldValue = (row.animeENName || row.animeJPName || "").toString();
            break;
          case 'artist':
            fieldValue = (row.songArtist || "").toString();
            break;
          case 'song':
            fieldValue = (row.songName || "").toString();
            break;
          case 'composer':
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
          case 'anime':
            fieldValue = (row.animeENName || row.animeJPName || "").toString();
            break;
          case 'artist':
            fieldValue = (row.songArtist || "").toString();
            break;
          case 'song':
            fieldValue = (row.songName || "").toString();
            break;
          case 'composer':
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

// ============
// Networking
// ============
function okJson(resp) { if (!resp.ok) throw new Error(`HTTP ${resp.status}`); return resp.json(); }
function postJson(url, body) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AppState.aborter.signal
  }).then(okJson);
}
function onFetchError(err) { if (err?.name === "AbortError") return; showAlert(`Request failed: ${err.message || err}`, "danger"); }

// ==========
// Rendering
// ==========
function sanitize(text) { return String(text ?? "").replace(/[\r\n]+/g, " "); }

function renderTable() {
  const tbody = document.querySelector("#resultsTable tbody");
  const rows = AppState.results.visible;
  if (AppState.results.sort.column) {
    const { column, dir } = AppState.results.sort; const factor = dir === "asc" ? 1 : -1;
    rows.sort((a, b) => compareBy(column, a, b) * factor);
  }
  const frag = document.createDocumentFragment();
  rows.forEach((row, idx) => frag.appendChild(buildRow(row, idx)));
  tbody.innerHTML = ""; tbody.appendChild(frag);
  updateHeaderSortIndicators();
  const rc = document.getElementById("resultsCount"); if (rc) rc.textContent = String(rows.length);

  // Apply column visibility after rendering
  applyColumnVisibility();
}

function rowKey(r) { return `${r.annId}-${r.annSongId}`; }

function buildRow(r, idx) {
  const tr = document.createElement("tr");
  tr.dataset.key = rowKey(r);
  tr.dataset.hq = r.HQ || "";
  tr.dataset.mq = r.MQ || "";
  tr.dataset.mp3 = r.audio || "";

  const anime = sanitize(getAnimeTitle(r));
  const type = shortTypeDisplay(r.songType);
  const song = sanitize(r.songName);
  const artist = sanitize(r.songArtist);
  const vintage = sanitize(r.animeVintage);
  const difficulty = (r.songDifficulty ?? "");
  const category = sanitize(r.songCategory || "");
  const broadcast = r.isDub ? "Dub" : (r.isRebroadcast ? "Rebroadcast" : "Normal");
  const length = formatDurationSeconds(r.songLength);
  const composer = sanitize(r.songComposer || "");
  const arranger = sanitize(r.songArranger || "");
  const annSongId = r.annSongId ?? "";
  const amqSongId = r.amqSongId ?? "";
  const ids = r.linked_ids || {};
  const anilistId = ids.anilist ?? "";
  const malId = ids.myanimelist ?? "";
  const kitsuId = ids.kitsu ?? "";
  const anidbId = ids.anidb ?? "";

  const tdPlus = document.createElement("td");
  tdPlus.className = "nw";
  tdPlus.innerHTML = `<button class="btn btn-sm btn-outline-secondary js-info" title="Details"><i class="fa-solid fa-circle-plus"></i></button>`;

  const tdNum = document.createElement("td"); tdNum.className = "nw"; tdNum.textContent = String(idx + 1);
  const tdAnn = document.createElement("td"); tdAnn.className = "nw"; tdAnn.textContent = r.annId ?? "";

  const tdAnime = document.createElement("td"); tdAnime.className = "trunc"; tdAnime.textContent = anime;
  const tdType = document.createElement("td"); tdType.className = "nw"; tdType.textContent = type;
  const tdSong = document.createElement("td"); tdSong.className = "trunc"; tdSong.textContent = song;
  const tdArtist = document.createElement("td"); tdArtist.className = "trunc"; tdArtist.textContent = artist;
  const tdVintage = document.createElement("td"); tdVintage.className = "nw"; tdVintage.textContent = vintage || "";
  const tdDiff = document.createElement("td"); tdDiff.className = "nw"; tdDiff.textContent = (difficulty === null || difficulty === undefined) ? "" : String(difficulty);

  const tdCategory = document.createElement("td"); tdCategory.className = "nw"; tdCategory.textContent = category;
  const tdBroadcast = document.createElement("td"); tdBroadcast.className = "nw"; tdBroadcast.textContent = broadcast;
  const tdLength = document.createElement("td"); tdLength.className = "nw"; tdLength.textContent = length;
  const tdComposer = document.createElement("td"); tdComposer.className = "trunc"; tdComposer.textContent = composer;
  const tdArranger = document.createElement("td"); tdArranger.className = "trunc"; tdArranger.textContent = arranger;
  const tdAnnSongId = document.createElement("td"); tdAnnSongId.className = "nw"; tdAnnSongId.textContent = annSongId;
  const tdAmqSongId = document.createElement("td"); tdAmqSongId.className = "nw"; tdAmqSongId.textContent = amqSongId;
  const tdAnilistId = document.createElement("td"); tdAnilistId.className = "nw"; tdAnilistId.textContent = anilistId;
  const tdMalId = document.createElement("td"); tdMalId.className = "nw"; tdMalId.textContent = malId;
  const tdKitsuId = document.createElement("td"); tdKitsuId.className = "nw"; tdKitsuId.textContent = kitsuId;
  const tdAnidbId = document.createElement("td"); tdAnidbId.className = "nw"; tdAnidbId.textContent = anidbId;

  // Links: always render 720/480/mp3, disabled if missing
  const tdLinks = document.createElement("td"); tdLinks.className = "nw";
  const hqUrl = buildMediaUrl(r.HQ);
  const mqUrl = buildMediaUrl(r.MQ);
  const mp3Url = buildMediaUrl(r.audio);
  tdLinks.innerHTML = [
    renderLinkLabel("720", hqUrl),
    renderLinkLabel("480", mqUrl),
    renderLinkLabel("MP3", mp3Url)
  ].join(" ");

  const hasAnySource = Boolean(hqUrl || mqUrl || mp3Url);

  // Action: Play, Trash, Drag (drag handle AFTER trash)
  const tdAct = document.createElement("td"); tdAct.className = "nw";
  tdAct.innerHTML = `
    <button class="btn btn-sm btn-outline-primary js-play-track me-1" title="Play" ${hasAnySource ? "" : "disabled"}><i class="fa-solid fa-play"></i></button>
    <button class="btn btn-sm btn-outline-danger js-trash me-2" title="Remove"><i class="fa-solid fa-trash"></i></button>
    <span class="js-grab drag-handle" title="Drag to reorder"><i class="fa-solid fa-grip-vertical"></i></span>
  `;

  tr.append(tdPlus, tdNum, tdAnn, tdAnime, tdType, tdSong, tdArtist, tdVintage, tdDiff, tdCategory, tdBroadcast, tdLength, tdComposer, tdArranger, tdAnnSongId, tdAmqSongId, tdAnilistId, tdMalId, tdKitsuId, tdAnidbId, tdLinks, tdAct);
  return tr;
}

function renderLinkLabel(label, url) {
  if (url) {
    return `<a class="link-label" href="${escapeHtml(url)}" target="_blank" rel="noopener">${label}</a>`;
  }
  return `<span class="link-label disabled" aria-disabled="true">${label}</span>`;
}

function compareBy(column, a, b) {
  switch (column) {
    case "annid": return num(a.annId) - num(b.annId);
    case "anime": return str(a.animeENName || a.animeJPName).localeCompare(str(b.animeENName || b.animeJPName), undefined, { sensitivity: "base" });
    case "song": return str(a.songName).localeCompare(str(b.songName), undefined, { sensitivity: "base" });
    case "artist": return str(a.songArtist).localeCompare(str(b.songArtist), undefined, { sensitivity: "base" });
    case "type": return typeOrder(a.songType) - typeOrder(b.songType);
    case "vintage": return vintageOrder(a.animeVintage) - vintageOrder(b.animeVintage);
    case "difficulty": return num(a.songDifficulty) - num(b.songDifficulty);
    case "category": return str(a.songCategory || "").localeCompare(str(b.songCategory || ""), undefined, { sensitivity: "base" });
    case "broadcast": return str(getBroadcastType(a)).localeCompare(str(getBroadcastType(b)), undefined, { sensitivity: "base" });
    case "length": return num(a.songLength) - num(b.songLength);
    case "composer": return str(a.songComposer || "").localeCompare(str(b.songComposer || ""), undefined, { sensitivity: "base" });
    case "arranger": return str(a.songArranger || "").localeCompare(str(b.songArranger || ""), undefined, { sensitivity: "base" });
    case "annSongId": return num(a.annSongId) - num(b.annSongId);
    case "amqSongId": return num(a.amqSongId) - num(b.amqSongId);
    case "anilistId": return num((a.linked_ids || {}).anilist) - num((b.linked_ids || {}).anilist);
    case "malId": return num((a.linked_ids || {}).myanimelist) - num((b.linked_ids || {}).myanimelist);
    case "kitsuId": return num((a.linked_ids || {}).kitsu) - num((b.linked_ids || {}).kitsu);
    case "anidbId": return num((a.linked_ids || {}).anidb) - num((b.linked_ids || {}).anidb);
    case "rownum": default: return 0;
  }
}

function getBroadcastType(r) {
  return r.isDub ? "Dub" : (r.isRebroadcast ? "Rebroadcast" : "Normal");
}

function resetColumnVisibilityToDefault() {
  // Reset to default settings
  AppState.settings.visibleColumns = { ...DefaultSettings.visibleColumns };

  // Update checkbox states
  const columnCheckboxMap = {
    plus: "colPlus",
    rownum: "colRownum",
    annid: "colAnnid",
    anime: "colAnime",
    type: "colType",
    song: "colSong",
    artist: "colArtist",
    vintage: "colVintage",
    difficulty: "colDifficulty",
    category: "colCategory",
    broadcast: "colBroadcast",
    length: "colLength",
    composer: "colComposer",
    arranger: "colArranger",
    annSongId: "colAnnSongId",
    amqSongId: "colAmqSongId",
    anilistId: "colAnilistId",
    malId: "colMalId",
    kitsuId: "colKitsuId",
    anidbId: "colAnidbId",
    links: "colLinks",
    action: "colAction"
  };

  Object.keys(AppState.settings.visibleColumns).forEach(col => {
    const checkboxId = columnCheckboxMap[col];
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) {
      checkbox.checked = AppState.settings.visibleColumns[col];
    }
  });

  // Save settings and apply changes
  saveSettings();
  applyColumnVisibility();
}
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY; }
function str(v) { return (v ?? "").toString(); }
function shortTypeDisplay(t) {
  const s = String(t || "").trim();
  const up = s.toUpperCase();
  const getDigits = (str) => { let out = ""; for (const ch of String(str)) { if (ch >= "0" && ch <= "9") { out += ch; } } return out; };
  if (up.startsWith("OPENING") || up.startsWith("OP")) { const n = getDigits(s); return "OP" + n; }
  if (up.startsWith("ENDING") || up.startsWith("ED")) { const n = getDigits(s); return "ED" + n; }
  if (up.startsWith("INSERT") || up.startsWith("IN")) { return "IN"; }
  return s;
}
function canonicalType(t) {
  const s = String(t || "").toUpperCase().trim();
  if (s.startsWith("OPENING") || s.startsWith("OP")) return "OP";
  if (s.startsWith("ENDING") || s.startsWith("ED")) return "ED";
  if (s.startsWith("INSERT") || s.startsWith("IN")) return "IN";
  return s;
}
function typeOrder(t) { const c = canonicalType(t); return c === "OP" ? 1 : c === "ED" ? 2 : c === "IN" ? 3 : 99; }
function vintageOrder(v) { if (!v) return 9999999; const m = /^(Winter|Spring|Summer|Fall)\s+(\d{4})$/.exec(v); if (!m) return 9999999; const year = Number(m[2]); const s = SeasonOrder.indexOf(m[1]); return (Number.isFinite(year) ? year : 999999) * 10 + (s === -1 ? 9 : s); }

function updateHeaderSortIndicators() {
  const { column, dir } = AppState.results.sort;
  $("#resultsTable thead th").each(function () {
    const th = $(this); const col = th.data("col"); th.find(".sort-ind").remove(); if (!col) return;
    let icon = "<i class=\"fa-solid fa-sort text-muted sort-ind\"></i>";
    if (column === col) { icon = dir === "asc" ? "<i class=\"fa-solid fa-sort-up sort-ind\"></i>" : "<i class=\"fa-solid fa-sort-down sort-ind\"></i>"; }
    th.append(icon);
  });
}
function onHeaderSortClick() {
  const col = $(this).data("col"); if (!col) return;
  const s = AppState.results.sort;
  if (s.column !== col) { s.column = col; s.dir = "asc"; }
  else if (s.dir === "asc") { s.dir = "desc"; }
  else { s.column = null; s.dir = null; }
  if (s.column) { AppState.results.manualOrderActive = false; }
  renderTable();
}

function getDomOrderKeys() { return Array.from(document.querySelectorAll("#resultsTable tbody tr")).map(tr => tr.dataset.key); }

function getKeyFromElement(el) {
  const host = el.closest("tr") || el.closest(".result-card");
  return host ? host.dataset.key : null;
}

// ==========
// Row actions
// ==========
function onRowPlayClick() {
  const key = getKeyFromElement(this); if (!key || this.hasAttribute("disabled")) return;
  // Clear all first and restore defaults
  resetAllPlayButtonsToDefault();
  // Highlight the clicked button immediately
  this.classList.remove("btn-outline-primary");
  this.classList.add("btn-success", "is-playing");
  playByKey(key);
}
function onRowTrashClick() {
  const key = getKeyFromElement(this); if (!key) return;
  AppState.results.removedKeys.add(key);
  AppState.results.visible = AppState.results.visible.filter(r => rowKey(r) !== key);
  renderTable();
  const rc = document.getElementById("resultsCount"); if (rc) rc.textContent = String(document.querySelectorAll("#resultsTable tbody tr").length);
}
function onRowInfoClick() {
  const key = getKeyFromElement(this); if (!key) return;
  updateInfoModalForKey(key);
  new bootstrap.Modal(document.getElementById("infoModal")).show();
}

function updateInfoModalForKey(key) {
  const data = AppState.results.visible.find(r => rowKey(r) === key) || AppState.results.raw.find(r => rowKey(r) === key);
  if (!data) return;
  const modal = document.getElementById("infoModal");
  modal.dataset.key = key;
  // Update modal title with row number (spaced)
  const idx = AppState.results.visible.findIndex(r => rowKey(r) === key);
  const titleEl = modal.querySelector(".modal-title");
  if (titleEl) { titleEl.innerHTML = `Song Details${idx >= 0 ? ` <span class=\"text-muted small ms-2\">#${idx + 1}</span>` : ""}`; }
  // Raw JSON stays verbatim
  document.getElementById("infoJson").textContent = JSON.stringify(data, null, 2);
  // Formatted view with row index (#)
  document.getElementById("infoFormatted").innerHTML = buildInfoFormattedHTML(data, idx);
  // Configure Play button (disabled if zero links)
  const hasAny = Boolean(buildMediaUrl(data.audio) || buildMediaUrl(data.MQ) || buildMediaUrl(data.HQ));
  const btn = document.getElementById("btnInfoPlay");
  btn.disabled = !hasAny;
  btn.onclick = () => { if (!hasAny) return; const k = document.getElementById("infoModal").dataset.key; const a = document.getElementById("player"); if (AppState.player.currentKey === k && a && !a.paused) { a.pause(); } else { playByKey(k); } };
  // Reflect current playing state on modal's play button
  const audioEl = document.getElementById("player");
  setModalPlayButtonState(AppState.player.currentKey === key && audioEl && !audioEl.paused);
  updateInfoViewMode();
}

function buildInfoFormattedHTML(d, idx) {
  const title = sanitize(getAnimeTitle(d));
  const typeBadge = sanitize(d.songType || "");
  const vintage = sanitize(d.animeVintage || "");
  const dif = (d.songDifficulty ?? null);
  const artist = sanitize(d.songArtist || "");
  const songName = sanitize(d.songName || "");
  const category = sanitize(d.songCategory || "");
  const broadcast = d.isDub ? "Dub" : (d.isRebroadcast ? "Rebroadcast" : "Normal");
  const length = formatDurationSeconds(d.songLength);

  // Linked ID buttons (no icons). Disabled if not available
  const ids = d.linked_ids || {};
  const buttons = [
    idButton("AniList", ids.anilist ? `https://anilist.co/anime/${encodeURIComponent(ids.anilist)}` : ""),
    idButton("MAL", ids.myanimelist ? `https://myanimelist.net/anime/${encodeURIComponent(ids.myanimelist)}` : ""),
    idButton("Kitsu", ids.kitsu ? `https://kitsu.io/anime/${encodeURIComponent(ids.kitsu)}` : ""),
    idButton("ANN", d.annId ? `https://www.animenewsnetwork.com/encyclopedia/anime.php?id=${encodeURIComponent(d.annId)}` : ""),
    idButton("AniDB", ids.anidb ? `https://anidb.net/anime/${encodeURIComponent(ids.anidb)}` : "")
  ].join(" ");

  // File links with filenames
  const hq = buildMediaUrl(d.HQ); const mq = buildMediaUrl(d.MQ); const mp3 = buildMediaUrl(d.audio);
  const nameHQ = fileBaseName(d.HQ || hq);
  const nameMQ = fileBaseName(d.MQ || mq);
  const nameMP3 = fileBaseName(d.audio || mp3);

  const composer = sanitize(d.songComposer || "");
  const arranger = sanitize(d.songArranger || "");

  const annSongId = d.annSongId ?? "";
  const amqSongId = d.amqSongId ?? "";

  return `
    <div class="detail-header mb-2">
      <div class="d-flex justify-content-between align-items-start">
        <div>
          <h5 class="mb-1">${escapeHtml(title)}</h5>
          <div class="text-muted small">${escapeHtml(songName)}${artist ? ` — ${escapeHtml(artist)}` : ""}</div>
        </div>
      </div>
    </div>

    <!-- New two-column meta block -->
    <div class="row g-3 mb-3">
      <div class="col-md-6">
        ${typeBadge ? `<div><strong>Type:</strong> ${escapeHtml(typeBadge)}</div>` : ""}
        ${Number.isFinite(Number(dif)) ? `<div><strong>Difficulty:</strong> ${escapeHtml(dif)}</div>` : ""}
        ${vintage ? `<div><strong>Season:</strong> ${escapeHtml(vintage)}</div>` : ""}
      </div>
      <div class="col-md-6">
        ${category ? `<div><strong>Category:</strong> ${escapeHtml(category)}</div>` : ""}
        ${broadcast ? `<div><strong>Broadcast:</strong> ${escapeHtml(broadcast)}</div>` : ""}
        ${length ? `<div><strong>Length:</strong> ${escapeHtml(length)}</div>` : ""}
      </div>
    </div>

    <!-- Composer / Arranger block -->
    ${(composer || arranger) ? `
    <div class="row g-3 mb-3">
      <div class="col-md-6">${composer ? `<div><strong>Composer:</strong> ${escapeHtml(composer)}</div>` : ""}</div>
      <div class="col-md-6">${arranger ? `<div><strong>Arranger:</strong> ${escapeHtml(arranger)}</div>` : ""}</div>
    </div>`: ""}

    <div class="mb-3">
      <div class="fw-semibold mb-1">IDs</div>
      <div class="d-flex flex-wrap gap-2">${buttons}</div>
    </div>

    ${(annSongId || amqSongId) ? `<div class=\"mb-3\">${annSongId ? `<div><strong>ANN Song ID:</strong> ${escapeHtml(annSongId)}</div>` : ""}${amqSongId ? `<div><strong>AMQ Song ID:</strong> ${escapeHtml(amqSongId)}</div>` : ""}</div>` : ""}

    <div class="mb-3">
      <div class="fw-semibold mb-1">Files</div>
      ${hq ? `<div>720: <a href=\"${escapeHtml(hq)}\" target=\"_blank\" rel=\"noopener\">${escapeHtml(nameHQ)}</a></div>` : ""}
      ${mq ? `<div>480: <a href=\"${escapeHtml(mq)}\" target=\"_blank\" rel=\"noopener\">${escapeHtml(nameMQ)}</a></div>` : ""}
      ${mp3 ? `<div>MP3: <a href=\"${escapeHtml(mp3)}\" target=\"_blank\" rel=\"noopener\">${escapeHtml(nameMP3)}</a></div>` : ""}
    </div>`;
}

function idButton(label, href) {
  if (href) {
    return `<a class="btn btn-sm btn-outline-secondary" href="${escapeHtml(href)}" target="_blank" rel="noopener">${label}</a>`;
  }
  return `<a class="btn btn-sm btn-outline-secondary disabled" role="button" tabindex="-1" aria-disabled="true">${label}</a>`;
}

function fileBaseName(pathOrUrl) {
  if (!pathOrUrl) return "";
  try {
    if (/^https?:\/\//i.test(pathOrUrl)) {
      const u = new URL(pathOrUrl);
      const p = u.pathname.split("/").filter(Boolean).pop() || "";
      return p;
    }
    const p = String(pathOrUrl).split("?")[0].split("#")[0];
    return p.split("/").pop() || p;
  } catch { return String(pathOrUrl).split("/").pop() || ""; }
}

function updateInfoViewMode() {
  const mode = document.getElementById("infoViewMode").value;
  document.getElementById("infoFormatted").classList.toggle("d-none", mode !== "formatted");
  document.getElementById("infoJson").classList.toggle("d-none", mode !== "raw");
}

// ==========
// Info helpers (Song Details modal)
// ==========
function nextKeyFrom(key) { const order = getOrderKeys(); if (!order.length) return null; const i = Math.max(0, order.indexOf(key)); return order[(i + 1) % order.length]; }
function prevKeyFrom(key) { const order = getOrderKeys(); if (!order.length) return null; const i = Math.max(0, order.indexOf(key)); return order[(i - 1 + order.length) % order.length]; }
function onInfoNext() { const modal = document.getElementById("infoModal"); const k = nextKeyFrom(modal.dataset.key); if (k) updateInfoModalForKey(k); }
function onInfoPrev() { const modal = document.getElementById("infoModal"); const k = prevKeyFrom(modal.dataset.key); if (k) updateInfoModalForKey(k); }

// ==================
// Player + Radio
// ==================
function buildMediaUrl(v) {
  if (!v) return "";
  // If already a URL, rewrite its host if it's animemusicquiz
  if (/^https?:\/\//i.test(v)) return rewriteCatboxHost(v);
  // Treat as filename (.webm, .mp3, etc.)
  const clean = String(v).replace(/^\/+/, "");
  if (clean.includes("..")) return "";
  return `https://${AppState.settings.catboxHost}.animemusicquiz.com/${encodeURIComponent(clean)}`;
}
function rewriteCatboxHost(url) {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith(".animemusicquiz.com")) {
      const parts = u.hostname.split(".");
      parts[0] = AppState.settings.catboxHost;
      u.hostname = parts.join(".");
      return u.toString();
    }
  } catch { }
  return url;
}
function pickBestUrl(tr) {
  const mp3 = tr.dataset.mp3 || "";
  const mq = tr.dataset.mq || ""; // 480
  const hq = tr.dataset.hq || ""; // 720
  return buildMediaUrl(mp3) || buildMediaUrl(mq) || buildMediaUrl(hq);
}
function ensurePlayerVisible() {
  const wrap = document.getElementById("playerWrap");
  if (wrap && !wrap.classList.contains("show")) {
    wrap.classList.add("show");
    document.body.classList.add("has-player");
  }
}
function playByKey(key) {
  const tr = document.querySelector(`#resultsTable tbody tr[data-key="${CSS.escape(key)}"]`);
  if (!tr) return;
  const src = pickBestUrl(tr);
  if (!src) return;
  AppState.player.currentKey = key;
  const audio = document.getElementById("player");
  if (audio.src !== src) { audio.src = src; }
  ensurePlayerVisible();
  audio.play();
  // Update button styles
  document.querySelectorAll(".js-play-track").forEach(btn => btn.classList.remove("btn-success", "is-playing"));
  const btn = tr.querySelector(".js-play-track");
  if (btn) { btn.classList.remove("btn-outline-primary"); btn.classList.add("btn-success", "is-playing"); }
}
function onAudioEnded() {
  const mode = AppState.settings.radioMode;
  if (mode === "repeat") { const a = document.getElementById("player"); a.currentTime = 0; a.play(); }
  else if (mode === "loopAll") { const next = nextPlayableKey(); if (next) playByKey(next); }
}
function setModalPlayButtonState(isPlaying) {
  const btn = document.getElementById("btnInfoPlay");
  if (!btn) return;
  btn.classList.toggle("is-playing", isPlaying);
  btn.innerHTML = isPlaying ? '<i class="fa-solid fa-pause me-1"></i>Pause' : '<i class="fa-solid fa-play me-1"></i>Play';
  // Ensure base btn-primary remains so sizing/contrast stays consistent
  if (!btn.classList.contains("btn")) btn.classList.add("btn", "btn-primary");
}
function onAudioPause() {
  resetAllPlayButtonsToDefault();
}
function onAudioPlay() {
  // Clear all buttons first
  resetAllPlayButtonsToDefault();
  if (AppState.player.currentKey) {
    // Table row button
    const tr = document.querySelector(`#resultsTable tbody tr[data-key="${CSS.escape(AppState.player.currentKey)}"]`);
    const rowBtn = tr?.querySelector(".js-play-track");
    if (rowBtn) { rowBtn.classList.remove("btn-outline-primary"); rowBtn.classList.add("btn-success", "is-playing"); }
    // Mobile card button
    const card = document.querySelector(`.result-card[data-key="${CSS.escape(AppState.player.currentKey)}"]`);
    const cardBtn = card?.querySelector(".js-play-track");
    if (cardBtn) { cardBtn.classList.remove("btn-outline-primary"); cardBtn.classList.add("btn-success", "is-playing"); }
  }
  const audio = document.getElementById("player");
  const modal = document.getElementById("infoModal");
  const isModalTrack = Boolean(modal && modal.dataset.key && modal.dataset.key === AppState.player.currentKey && audio && !audio.paused);
  setModalPlayButtonState(isModalTrack);
}
function getOrderKeys() { return Array.from(document.querySelectorAll("#resultsTable tbody tr")).map(tr => tr.dataset.key); }
function nextKey() { const order = getOrderKeys(); if (!order.length) return null; const i = Math.max(0, order.indexOf(AppState.player.currentKey)); return order[(i + 1) % order.length]; }
function nextPlayableKey() {
  const order = getOrderKeys();
  if (!order.length) return null;
  const start = Math.max(0, order.indexOf(AppState.player.currentKey));
  for (let step = 1; step <= order.length; step++) {
    const idx = (start + step) % order.length;
    const k = order[idx];
    const tr = document.querySelector(`#resultsTable tbody tr[data-key="${CSS.escape(k)}"]`);
    if (tr && pickBestUrl(tr)) return k; // skip rows with zero links
  }
  return null;
}

function prevPlayableKey() {
  const order = getOrderKeys();
  if (!order.length) return null;
  const start = Math.max(0, order.indexOf(AppState.player.currentKey));
  for (let step = 1; step <= order.length; step++) {
    const idx = (start - step + order.length) % order.length;
    const k = order[idx];
    const tr = document.querySelector(`#resultsTable tbody tr[data-key="${CSS.escape(k)}"]`);
    if (tr && pickBestUrl(tr)) return k; // skip rows with zero links
  }
  return null;
}

function prevKey() { const order = getOrderKeys(); if (!order.length) return null; const i = Math.max(0, order.indexOf(AppState.player.currentKey)); return order[(i - 1 + order.length) % order.length]; }
function playNext() { const k = nextPlayableKey(); if (k) playByKey(k); }
function playPrev() { const k = prevPlayableKey(); if (k) playByKey(k); }
function togglePlayPause() { const a = document.getElementById("player"); if (a.paused) a.play(); else a.pause(); }

// =======
// Alerts
// =======
function showAlert(msg, type) {
  const div = document.createElement("div");
  div.className = `alert alert-${type} alert-dismissible`;
  div.role = "alert";
  const close = document.createElement("button");
  close.type = "button"; close.className = "btn-close";
  close.setAttribute("data-bs-dismiss", "alert");
  close.setAttribute("aria-label", "Close");
  div.textContent = String(msg);
  div.appendChild(close);
  document.getElementById("alertHost").innerHTML = "";
  document.getElementById("alertHost").appendChild(div);
}
function clearAlert() { document.getElementById("alertHost").innerHTML = ""; }
function escapeHtml(s) { const d = document.createElement("div"); d.textContent = String(s); return d.innerHTML; }
function getAnimeTitle(row) { return (AppState.settings.language === "romaji") ? (row.animeJPName || row.animeENName || "") : (row.animeENName || row.animeJPName || ""); }

// =====================
// Shuffle Table
// =====================
function shuffleTable() {
  const a = AppState.results.visible;
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; }
  AppState.results.manualOrderActive = true;
  AppState.results.sort = { column: null, dir: null };
  renderTable();
}

// =====================
// Download / Upload IO
// =====================
function makeDownloadFilename() {
  if (AppState.settings.searchMode === "advanced") {
    // Advanced search mode - combine all 4 inputs
    const anime = $("#searchAnime").val().trim();
    const artist = $("#searchArtist").val().trim();
    const song = $("#searchSong").val().trim();
    const composer = $("#searchComposer").val().trim();

    // Combine all non-empty values with a separator
    const parts = [anime, artist, song, composer].filter(Boolean);
    if (parts.length === 0) return "download.json";

    const combined = parts.join(" ");
    const safe = combined.replace(/[^a-z0-9 _.-]+/gi, "");
    return (safe || "download") + ".json";
  } else {
    // Simple search mode - use search query
    const q = (($("#searchQuery").val() || "")).trim();
    if (!q) return "download.json";
    const safe = q.replace(/[^a-z0-9 _.-]+/gi, "");
    return (safe || "download") + ".json";
  }
}
function downloadRawJson() {
  // Export exactly what's shown in the table, in the exact visual order
  const keys = getDomOrderKeys();
  const byKey = new Map(AppState.results.visible.map(r => [rowKey(r), r]));
  const data = keys.map(k => byKey.get(k)).filter(Boolean);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const filename = makeDownloadFilename();
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
async function onUploadJson(evt) {
  const f = evt.target.files?.[0];
  evt.target.value = ""; // reset
  if (!f) return;
  try {
    const text = await f.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error("Uploaded JSON must be an array of rows.");
    AppState.results.raw = parsed;
    AppState.results.visible = parsed.slice();
    AppState.results.removedKeys.clear();
    AppState.results.manualOrderActive = false;
    AppState.results.sort = { column: null, dir: null };
    renderTable();
  } catch (err) { showAlert(`Upload failed: ${err.message || err}`, "danger"); }
}

function renderCards() {
  const host = document.getElementById("resultsCards");
  if (!host) return;
  const rows = AppState.results.visible;
  const frag = document.createDocumentFragment();
  rows.forEach((r, idx) => {
    const card = document.createElement("div");
    card.className = "result-card";
    card.dataset.key = rowKey(r);

    const anime = sanitize(getAnimeTitle(r));
    const type = shortTypeDisplay(r.songType);
    const artist = sanitize(r.songArtist);
    const song = sanitize(r.songName);
    const vintage = sanitize(r.animeVintage || "");

    const hqUrl = buildMediaUrl(r.HQ);
    const mqUrl = buildMediaUrl(r.MQ);
    const mp3Url = buildMediaUrl(r.audio);
    const hasAnySource = Boolean(hqUrl || mqUrl || mp3Url);

    card.innerHTML = `
      <div class="rc-header">
        <div class="rc-head-left">
          <button class="btn btn-sm btn-outline-secondary js-info" title="Details"><i class="fa-solid fa-circle-plus"></i></button>
          <div class="rc-badges"><span class="text-muted">#${idx + 1}</span>${vintage ? `<span>• ${escapeHtml(vintage)}</span>` : ""}${type ? `<span class="badge bg-secondary">${escapeHtml(type)}</span>` : ""}</div>
        </div>
        <div class="rc-actions">
          <button class="btn btn-sm btn-outline-primary js-play-track" ${hasAnySource ? "" : "disabled"}><i class="fa-solid fa-play"></i></button>
          <button class="btn btn-sm btn-outline-danger js-trash"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div class="rc-title">${escapeHtml(anime)}</div>
      <div class="rc-sub">${escapeHtml(song)}${artist ? ` — ${escapeHtml(artist)}` : ""}</div>
    `;
    frag.appendChild(card);
  });
  host.innerHTML = "";
  host.appendChild(frag);
}

// Wrap renderTable to also render mobile cards
const _renderTableOrig = renderTable;
renderTable = function () {
  _renderTableOrig();
  renderCards();
};

function resetAllPlayButtonsToDefault() {
  // Table and mobile card play buttons default to outline primary
  document.querySelectorAll(".js-play-track").forEach(btn => {
    btn.classList.remove("btn-success", "is-playing");
    btn.classList.add("btn-outline-primary");
  });
  // Modal play button text/icon and state
  setModalPlayButtonState(false);
}

function formatDurationSeconds(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return "";
  const m = Math.floor(n / 60);
  const s = Math.round(n - m * 60);
  const ss = String(s).padStart(2, "0");
  return `${m}:${ss}`;
}