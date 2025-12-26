class SearchManager {
  constructor() {
    this.currentAborter = null;
    this.isLoading = false;

    // React to search submits emitted by toolbar
    eventBus.on("search:submit", (payload) => this.submitSearch(payload));
  }

  // Toggle loading UI state for search
  setLoading(isLoading) {
    this.isLoading = Boolean(isLoading);
    $("#btnSearch").prop("disabled", isLoading);
    $("#searchLoading").toggleClass("d-none", !isLoading);
  }

  // Handles search form submission and triggers appropriate API requests
  submitSearch(payload) {
    // Ignore submissions while loading (Enter key or programmatic)
    if (this.isLoading) {
      return;
    }

    // Abort any ongoing request
    this.abortCurrentRequest();
    this.currentAborter = new AbortController();

    // If payload provided, treat it as authoritative and do NOT read toolbar
    if (payload && Object.keys(payload).length > 0) {
      const toggleKeys = [
        "partial_match", "match_case", "arrangement",
        "opening_filter", "ending_filter", "insert_filter",
        "max_other_artist", "group_granularity", "and_logic",
        "ignore_duplicate", "normal_broadcast", "dub", "rebroadcast",
        "standard", "character", "chanting", "instrumental"
      ];
      // Respect result mode in payload if present
      const isAppend = payload.result_mode === "append";
      if (!isAppend) this.newTableResetState();
      const authoritativeToggles = this.pickKeys(payload, toggleKeys);

      if (payload.scope && payload.query) {
        const authoritativeInputs = this.pickKeys(payload, ["scope", "query"]);
        this.performSimpleSearch(isAppend, authoritativeToggles, authoritativeInputs);
      }
      else if (payload.anime || payload.artist || payload.song || payload.composer) {
        const authoritativeInputs = this.pickKeys(payload, ["anime", "artist", "song", "composer"]);
        this.performAdvancedSearch(isAppend, authoritativeToggles, authoritativeInputs);
      }
      else {
        console.log("Invalid search payload.", payload);
        showAlert("Invalid search payload.", "danger");
      }
      return;
    }

    // No payload → fall back to toolbar state
    const isAdvanced = settingsManager.get("searchMode") === "advanced";
    const isAppend = appState.getStateSlice("ui.resultMode") === "append";
    if (!isAppend) this.newTableResetState();
    const baseInputs = toolbar.getSearchInputs();
    const baseToggles = toolbar.getToggleStates();
    if (isAdvanced) {
      this.performAdvancedSearch(isAppend, baseToggles, baseInputs);
    } else {
      this.performSimpleSearch(isAppend, baseToggles, baseInputs);
    }
  }

  // Performs advanced search with individual field inputs
  performAdvancedSearch(isAppend, toggles, inputs) {
    const anime = String(inputs?.anime || "").trim();
    const artist = String(inputs?.artist || "").trim();
    const song = String(inputs?.song || "").trim();
    const composer = String(inputs?.composer || "").trim();

    // Check if at least one field has content
    if (!anime && !artist && !song && !composer) {
      showAlert("Please enter at least one search term.", "warning");
      return;
    }

    const body = this.buildAdvancedSearchBody(anime, artist, song, composer, toggles);
    this.makeSearchRequest(`${API_BASE}/api/search_request`, body, isAppend, Boolean(toggles.match_case));
  }

  // Performs simple search based on scope and query
  performSimpleSearch(isAppend, toggles, inputs) {
    const scope = String(inputs?.scope || "All");
    const query = String(inputs?.query || "").trim();

    if (scope === "Season") {
      this.handleSeasonSearch(query, isAppend, toggles);
    } else if (scope === "ANN") {
      this.handleAnnSearch(query, isAppend, toggles);
    } else if (scope === "ANN_SONG") {
      this.handleAnnSongSearch(query, isAppend, toggles);
    } else if (scope === "AMQ_SONG") {
      this.handleAmqSongSearch(query, isAppend, toggles);
    } else if (scope === "MAL") {
      this.handleMalSearch(query, isAppend, toggles);
    } else {
      // All/Anime/Artist/Song/Composer => search_request
      const body = this.buildSearchBody(scope, query, toggles);
      const allowMatchCase = ["All", "Anime", "Artist", "Song", "Composer"].includes(scope);
      this.makeSearchRequest(`${API_BASE}/api/search_request`, body, isAppend, allowMatchCase && Boolean(toggles.match_case));
    }
  }

  // Handles season search
  handleSeasonSearch(query, isAppend, toggles) {
    const seasonStr = this.parseSeason(query);
    if (!seasonStr) {
      showAlert("Invalid season. Use e.g. 'Spring 2024'.", "warning");
      return;
    }

    const body = this.buildSeasonBody(seasonStr, toggles);
    this.makeSearchRequest(`${API_BASE}/api/season_request`, body, isAppend, false);
  }

  // Handles ANN ID search
  handleAnnSearch(query, isAppend, toggles) {
    const ids = this.parseIdList(query, "ANN IDs");
    if (!ids) return;

    const body = this.buildAnnBody(ids, toggles);
    this.makeSearchRequest(`${API_BASE}/api/ann_ids_request`, body, isAppend, false);
  }

  // Handles ANN Song ID search
  handleAnnSongSearch(query, isAppend, toggles) {
    const ids = this.parseIdList(query, "ANN Song IDs");
    if (!ids) return;

    const body = this.buildAnnSongIdsBody(ids, toggles);
    this.makeSearchRequest(`${API_BASE}/api/ann_song_ids_request`, body, isAppend, false);
  }

  // Handles AMQ Song ID search
  handleAmqSongSearch(query, isAppend, toggles) {
    const ids = this.parseIdList(query, "AMQ Song IDs");
    if (!ids) return;

    const body = this.buildAmqSongIdsBody(ids, toggles);
    this.makeSearchRequest(`${API_BASE}/api/amq_song_ids_request`, body, isAppend, false);
  }

  // Handles MAL ID search
  handleMalSearch(query, isAppend, toggles) {
    const ids = this.parseIdList(query, "MAL IDs");
    if (!ids) return;

    const body = this.buildMalBody(ids, toggles);
    this.makeSearchRequest(`${API_BASE}/api/mal_ids_request`, body, isAppend, false);
  }

  // Parses a comma-separated list of IDs
  parseIdList(query, idType) {
    const MAX_IDS = 500;
    if (!query) return [];

    const segments = String(query)
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    const parsedIds = [];
    for (const raw of segments) {
      const segment = raw.replace(/\s*-\s*/, "-");
      const rangeMatch = /^(\d+)-(\d+)$/.exec(segment);
      if (rangeMatch) {
        const start = Number(rangeMatch[1]);
        const end = Number(rangeMatch[2]);
        if (start > end) {
          showAlert(`${idType} ranges must be ascending.`, "warning");
          return null;
        }
        const size = end - start + 1;
        if (parsedIds.length + size > MAX_IDS) {
          showAlert(`Too many ${idType} (max ${MAX_IDS}).`, "warning");
          return null;
        }
        for (let i = start; i <= end; i += 1) parsedIds.push(i);
        continue;
      }

      if (!/^\d+$/.test(segment)) {
        showAlert(`${idType} must be numeric or ranges (comma-separated).`, "warning");
        return null;
      }

      if (parsedIds.length + 1 > MAX_IDS) {
        showAlert(`Too many ${idType} (max ${MAX_IDS}).`, "warning");
        return null;
      }

      parsedIds.push(Number(segment));
    }

    return parsedIds;
  }

  // Makes a search request to the API and applies client-side case filtering if needed
  makeSearchRequest(url, body, isAppend, matchCase) {
    this.setLoading(true);
    this.postJson(url, body)
      .then(data => {
        const sortedByType = this.sortBySongType(data);
        const searchTerms = this.extractTextSearchTermsFromBody(body);
        const finalRows = matchCase && searchTerms.length > 0
          ? this.filterCaseSensitiveForTextScopes(sortedByType, searchTerms)
          : sortedByType;
        if (isAppend) {
          tableManager.appendData(finalRows);
        } else {
          tableManager.loadData(finalRows);
        }
      })
      .catch(err => this.onFetchError(err))
      .finally(() => this.setLoading(false));
  }

  // Derive text search terms from the request body for client-side case filtering
  extractTextSearchTermsFromBody(body) {
    const terms = [];
    if (!body || typeof body !== "object") return terms;
    const anime = body.anime_search_filter?.search;
    const artist = body.artist_search_filter?.search;
    const song = body.song_name_search_filter?.search;
    const composer = body.composer_search_filter?.search;
    if (anime) terms.push({ field: "anime", term: String(anime) });
    if (artist) terms.push({ field: "artist", term: String(artist) });
    if (song) terms.push({ field: "song", term: String(song) });
    if (composer) terms.push({ field: "composer", term: String(composer) });
    return terms;
  }

  // Apply case-sensitive filtering for text scopes (Anime/Artist/Song/Composer/All)
  filterCaseSensitiveForTextScopes(rows, searchTerms) {
    if (!Array.isArray(rows)) return rows;
    if (searchTerms.length === 0) return rows;

    return rows.filter(row => {
      const matchesField = ({ field, term }) => {
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
        return fieldValue.includes(term);
      };

      // If terms span only the text fields (All), allow any to match; else require all
      const onlyTextFields = searchTerms.every(st => ["anime", "artist", "song", "composer"].includes(st.field));
      if (onlyTextFields && searchTerms.length > 1) {
        return searchTerms.some(matchesField);
      }
      return searchTerms.every(matchesField);
    });
  }

  // Aborts the current search request
  abortCurrentRequest() {
    if (this.currentAborter) {
      this.currentAborter.abort();
      this.currentAborter = null;
    }
  }

  // Builds the request body for simple search mode
  buildSearchBody(scope, query, toggles) {
    const base = this.buildBaseBody(toggles);

    const anime = {
      search: query,
      partial_match: toggles.partial_match
    };
    const song = {
      search: query,
      partial_match: toggles.partial_match
    };
    const artist = {
      search: query,
      partial_match: toggles.partial_match,
      group_granularity: toggles.group_granularity,
      max_other_artist: toggles.max_other_artist
    };
    const composer = {
      search: query,
      partial_match: toggles.partial_match,
      arrangement: toggles.arrangement
    };

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

  // Builds the request body for advanced search mode
  buildAdvancedSearchBody(anime, artist, song, composer, toggles) {
    const base = this.buildBaseBody(toggles);
    const result = { ...base };

    // Only add search filters if they have values
    if (anime && anime.trim()) {
      result.anime_search_filter = {
        search: anime,
        partial_match: toggles.partial_match
      };
    }

    if (artist && artist.trim()) {
      result.artist_search_filter = {
        search: artist,
        partial_match: toggles.partial_match,
        group_granularity: toggles.group_granularity,
        max_other_artist: toggles.max_other_artist
      };
    }

    if (song && song.trim()) {
      result.song_name_search_filter = {
        search: song,
        partial_match: toggles.partial_match
      };
    }

    if (composer && composer.trim()) {
      result.composer_search_filter = {
        search: composer,
        partial_match: toggles.partial_match,
        arrangement: toggles.arrangement
      };
    }

    return result;
  }

  // Builds the base body with common toggle settings
  buildBaseBody(toggles) {
    return {
      and_logic: toggles.and_logic,
      ignore_duplicate: toggles.ignore_duplicate,
      opening_filter: toggles.opening_filter,
      ending_filter: toggles.ending_filter,
      insert_filter: toggles.insert_filter,
      normal_broadcast: toggles.normal_broadcast,
      dub: toggles.dub,
      rebroadcast: toggles.rebroadcast,
      standard: toggles.standard,
      character: toggles.character,
      chanting: toggles.chanting,
      instrumental: toggles.instrumental
    };
  }

  // Builds the request body for ANN ID search
  buildAnnBody(ids, toggles) {
    return {
      ann_ids: ids,
      ...this.buildBaseBody(toggles)
    };
  }

  // Builds the request body for MAL ID search
  buildMalBody(ids, toggles) {
    return {
      mal_ids: ids,
      ...this.buildBaseBody(toggles)
    };
  }

  // Builds the request body for season search
  buildSeasonBody(season, toggles) {
    return {
      season: season,
      ...this.buildBaseBody(toggles)
    };
  }

  // Builds the request body for ANN Song IDs search
  buildAnnSongIdsBody(annSongIds, toggles) {
    return {
      ann_song_ids: annSongIds,
      ...this.buildBaseBody(toggles)
    };
  }

  // Builds the request body for AMQ Song IDs search
  buildAmqSongIdsBody(amqSongIds, toggles) {
    return {
      amq_song_ids: amqSongIds,
      ...this.buildBaseBody(toggles)
    };
  }

  // Sort rows by ANN ID group, then by song type within each group (OP/ED/IN with ascending number),
  // and for ties (e.g., two OP1), order by broadcast: Normal, then Dub, then Rebroadcast.
  sortBySongType(rows) {
    if (!Array.isArray(rows)) return rows;
    const copy = rows.slice();
    copy.sort((a, b) => {
      const annA = this.safeNum(a?.annId);
      const annB = this.safeNum(b?.annId);
      if (annA !== annB) return annA - annB;

      const ra = this.getSongTypeRank(a?.songType);
      const rb = this.getSongTypeRank(b?.songType);
      if (ra.group !== rb.group) return ra.group - rb.group;
      if (ra.number !== rb.number) return ra.number - rb.number;

      const ba = this.broadcastWeight(a);
      const bb = this.broadcastWeight(b);
      if (ba !== bb) return ba - bb;
      return 0;
    });
    return copy;
  }

  // Get song type rank for sorting
  getSongTypeRank(typeValue) {
    const raw = String(typeValue || "").trim();
    const upper = raw.toUpperCase();
    const numberMatch = raw.match(/\d+/);
    const number = numberMatch ? parseInt(numberMatch[0], 10) || 0 : 0;

    if (upper.startsWith("OPENING") || upper.startsWith("OP")) {
      return { group: 1, number };
    }
    if (upper.startsWith("ENDING") || upper.startsWith("ED")) {
      return { group: 2, number };
    }
    if (upper.startsWith("INSERT") || upper.startsWith("IN")) {
      return { group: 3, number };
    }
    return { group: 99, number };
  }

  // Broadcast weight: Normal (0), Dub only (1), Rebroadcast only (2), both (3)
  broadcastWeight(row) {
    const isDub = Boolean(row?.isDub);
    const isRebroadcast = Boolean(row?.isRebroadcast);
    return (isDub ? 1 : 0) + (isRebroadcast ? 2 : 0);
  }

  // Safe numeric parse for ANN ID sorting
  safeNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
  }

  // Parses season query string to extract year and season information
  parseSeason(query) {
    const match = /^(Winter|Spring|Summer|Fall)\s+(\d{4})$/i.exec(query.trim());
    if (!match) return null;
    return match[1] + " " + match[2];
  }

  // Makes a POST request with JSON body and returns parsed response
  postJson(url, body) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: this.currentAborter?.signal
    }).then(async resp => {
      // Read response text so we can surface any error details
      const text = await resp.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (e) {
        data = text;
      }

      if (!resp.ok) {
        const message = (data && (data.detail || data.message)) || `HTTP ${resp.status}`;
        const err = new Error(message);
        err.status = resp.status;
        err.response = data;
        throw err;
      }

      return data;
    });
  }

  // Handles fetch errors and displays appropriate error messages
  onFetchError(err) {
    if (err?.name === "AbortError") return;
    // Prefer API-provided detail or message, fall back to error message
    const detail = err?.response?.detail ?? err?.response?.message ?? err?.detail ?? err?.message ?? String(err);
    console.error("Fetch error:", err);
    showAlert(`Request failed: ${detail}`, "danger");
  }

  // Reset the state for a new table
  newTableResetState() {
    appState.updateStateSlice("songs.removedKeys", () => new Set());
    appState.updateStateSlice("table.manualOrderActive", () => false);
    appState.updateStateSlice("table.sort.column", () => null);
    appState.updateStateSlice("table.sort.dir", () => null);
  }

  // Utility: pick only allowed keys from an object, ignoring undefined
  pickKeys(obj, keys) {
    const out = {};
    if (!obj) return out;
    keys.forEach(k => {
      if (obj[k] !== undefined) out[k] = obj[k];
    });
    return out;
  }

  // Fetch rows by ANN Song IDs in chunks of 500
  async fetchRowsByAnnSongIds(annSongIds) {
    const ids = Array.isArray(annSongIds) ? annSongIds.map(n => Number(n)).filter(Number.isFinite) : [];
    if (ids.length === 0) return [];
    const chunkSize = 500;
    const all = [];
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const body = { ann_song_ids: chunk };
      const data = await this.postJson(`${API_BASE}/api/ann_song_ids_request`, body);
      if (Array.isArray(data)) all.push(...data);
    }
    return all;
  }
}

const searchManager = new SearchManager();
