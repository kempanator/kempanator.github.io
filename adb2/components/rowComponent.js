class RowComponent {
  // Initialize a data row with song data, index, and key
  constructor(data, index, key) {
    this.data = data;
    this.index = index;
    this.key = key;
    this.$tableElement = null;
    this.$cardElement = null;
  }

  // Create and return the table row element for this data row
  renderAsTable() {
    if (!this.$tableElement) {
      this.$tableElement = this.createTableRow();
    }
    return this.$tableElement[0];
  }

  // Create and return the mobile card element for this data row
  renderAsCard() {
    if (!this.$cardElement) {
      this.$cardElement = this.createMobileCard();
    }
    return this.$cardElement[0];
  }

  // Build and return a complete table row element with all cells and event listeners
  createTableRow() {
    const $tr = $("<tr>")
      .attr("data-key", this.key)
      .attr("data-hq", this.data.HQ || "")
      .attr("data-mq", this.data.MQ || "")
      .attr("data-mp3", this.data.audio || "");

    this.appendTableCells($tr);
    this.setupTableEventListeners($tr);

    return $tr;
  }

  // Build and return a mobile card element with song information and action buttons
  createMobileCard() {
    const anime = this.sanitize(this.getAnimeTitle());
    const type = this.shortTypeDisplay(this.data.songType);
    const artist = this.sanitize(this.data.songArtist);
    const song = this.sanitize(this.data.songName);
    const vintage = this.sanitize(this.data.animeVintage || "");

    const hasAnySource = this.hasPlayableSources();

    const $card = $("<div>")
      .addClass("result-card")
      .attr("data-key", this.key)
      .html(`
        <div class="rc-header">
          <div class="rc-head-left">
            <button class="btn btn-sm btn-outline-secondary js-info" title="Details"><i class="fa-solid fa-circle-plus"></i></button>
            <div class="rc-badges"><span class="text-muted">#${this.index + 1}</span>${vintage ? `<span>• ${escapeHtml(vintage)}</span>` : ""}${type ? `<span class="badge bg-secondary">${escapeHtml(type)}</span>` : ""}</div>
          </div>
          <div class="rc-actions">
            <button class="btn btn-sm btn-outline-primary js-play-track" ${hasAnySource ? "" : "disabled"}><i class="fa-solid fa-play"></i></button>
            <button class="btn btn-sm btn-outline-warning js-add-to-playlist"><i class="fa-solid fa-plus"></i></button>
            <button class="btn btn-sm btn-outline-danger js-trash"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
        <div class="rc-title">${escapeHtml(anime)}</div>
        <div class="rc-sub">${escapeHtml(song)}${artist ? ` — ${escapeHtml(artist)}` : ""}</div>
      `);

    this.setupCardEventListeners($card);
    return $card;
  }

  // Append all table cells to the given table row in the correct column order
  appendTableCells($tr) {
    const cells = this.buildAllCells();
    const columnOrder = settingsManager.get("columnOrder");

    columnOrder.forEach(colName => {
      if (cells[colName]) {
        cells[colName].attr("data-col", colName);
        $tr.append(cells[colName]);
      }
    });
  }

  // Build and return all table cells as a map of column name to cell element
  buildAllCells() {
    const anime = this.sanitize(this.getAnimeTitle());
    const type = this.shortTypeDisplay(this.data.songType);
    const song = this.sanitize(this.data.songName);
    const artist = this.sanitize(this.data.songArtist);
    const vintage = this.sanitize(this.data.animeVintage);
    const difficulty = this.formatDifficulty(this.data.songDifficulty);
    const category = this.sanitize(this.data.songCategory || "");
    const broadcast = broadcastText(this.data);
    const length = formatDurationSeconds(this.data.songLength);
    const composer = this.sanitize(this.data.songComposer || "");
    const arranger = this.sanitize(this.data.songArranger || "");
    const annSongId = this.data.annSongId ?? "";
    const amqSongId = this.data.amqSongId ?? "";
    const ids = this.data.linked_ids || {};
    const anilistId = ids.anilist ?? "";
    const malId = ids.myanimelist ?? "";
    const kitsuId = ids.kitsu ?? "";
    const anidbId = ids.anidb ?? "";

    const $tdPlus = $("<td>").addClass("nw").html(`<button class="btn btn-sm btn-outline-secondary js-info" title="Details"><i class="fa-solid fa-circle-plus"></i></button>`);
    const $tdNum = $("<td>").addClass("nw").text(String(this.index + 1));
    const $tdAnn = $("<td>").addClass("nw").text(this.data.annId ?? "");
    const $tdAnime = $("<td>").addClass("trunc").text(anime).attr("title", anime);
    const $tdType = $("<td>").addClass("nw").text(type).append(this.tdTypeSubTextElement(this.data)).attr("title", this.tdTypeTitleText(this.data));
    const $tdSong = $("<td>").addClass("trunc").text(song).attr("title", song);
    const $tdArtist = $("<td>").addClass("trunc").text(artist).attr("title", artist);
    const $tdVintage = $("<td>").addClass("nw").text(vintage || "");
    const $tdDiff = $("<td>").addClass("nw").text(difficulty);
    const $tdCategory = $("<td>").addClass("nw").text(category);
    const $tdBroadcast = $("<td>").addClass("nw").text(broadcast);
    const $tdLength = $("<td>").addClass("nw").text(length);
    const $tdComposer = $("<td>").addClass("trunc").text(composer).attr("title", composer);
    const $tdArranger = $("<td>").addClass("trunc").text(arranger).attr("title", arranger);
    const $tdAnnSongId = $("<td>").addClass("nw").text(annSongId);
    const $tdAmqSongId = $("<td>").addClass("nw").text(amqSongId);
    const $tdAnilistId = $("<td>").addClass("nw").text(anilistId);
    const $tdMalId = $("<td>").addClass("nw").text(malId);
    const $tdKitsuId = $("<td>").addClass("nw").text(kitsuId);
    const $tdAnidbId = $("<td>").addClass("nw").text(anidbId);

    // Links: always render 720/480/mp3, disabled if missing
    const hqUrl = audioPlayer.buildMediaUrl(this.data.HQ) || "";
    const mqUrl = audioPlayer.buildMediaUrl(this.data.MQ) || "";
    const mp3Url = audioPlayer.buildMediaUrl(this.data.audio) || "";
    const $tdLinks = $("<td>").addClass("nw");
    $tdLinks.append(this.renderLinkLabel("720", hqUrl));
    $tdLinks.append(this.renderLinkLabel("480", mqUrl));
    $tdLinks.append(this.renderLinkLabel("MP3", mp3Url));

    const hasAnySource = Boolean(hqUrl || mqUrl || mp3Url);

    // Action: Play, Add to Playlist, Trash, Drag (drag handle AFTER trash)
    const $tdAct = $("<td>").addClass("nw").html(`
      <button class="btn btn-sm btn-outline-primary js-play-track me-1" title="Play" ${hasAnySource ? "" : "disabled"}><i class="fa-solid fa-play"></i></button>
      <button class="btn btn-sm btn-outline-warning js-add-to-playlist me-1" title="Add to Playlist"><i class="fa-solid fa-plus"></i></button>
      <button class="btn btn-sm btn-outline-danger js-trash me-2" title="Remove"><i class="fa-solid fa-trash"></i></button>
      <span class="js-grab drag-handle" title="Drag to reorder"><i class="fa-solid fa-grip-vertical"></i></span>
    `);

    return {
      plus: $tdPlus,
      rownum: $tdNum,
      annid: $tdAnn,
      anime: $tdAnime,
      type: $tdType,
      song: $tdSong,
      artist: $tdArtist,
      vintage: $tdVintage,
      difficulty: $tdDiff,
      category: $tdCategory,
      broadcast: $tdBroadcast,
      length: $tdLength,
      composer: $tdComposer,
      arranger: $tdArranger,
      annSongId: $tdAnnSongId,
      amqSongId: $tdAmqSongId,
      anilistId: $tdAnilistId,
      malId: $tdMalId,
      kitsuId: $tdKitsuId,
      anidbId: $tdAnidbId,
      links: $tdLinks,
      action: $tdAct
    };
  }

  // format the song difficulty into an integer
  formatDifficulty(dif) {
    dif = parseInt(dif);
    return isNaN(dif) ? "" : dif;
  }

  // create a sub text element to show dub and rebroadcast flags for the type column
  tdTypeSubTextElement(d) {
    let text = "";
    if (d.isDub) text += "D";
    if (d.isRebroadcast) text += "R";
    if (text) {
      return $("<span>")
        .addClass("text-muted ms-1 fw-bold")
        .css({ fontSize: "0.8em" })
        .text(text)
    }
    return null;
  }

  // create a title attribute text to show dub and rebroadcast flags for the type column
  tdTypeTitleText(d) {
    if (d.isDub && d.isRebroadcast) return `${d.songType} (Dub/Rebroadcast)`;
    if (d.isDub) return `${d.songType} (Dub)`;
    if (d.isRebroadcast) return `${d.songType} (Rebroadcast)`;
    return d.songType;
  }

  // Create a link or disabled span element for media file labels
  renderLinkLabel(label, url) {
    if (url) {
      return $("<a>")
        .addClass("link-label")
        .attr("data-label", label)
        .attr("href", escapeHtml(url))
        .attr("target", "_blank")
        .attr("rel", "noreferrer")
        .text(label);
    }
    return $("<span>")
      .addClass("link-label disabled")
      .attr("data-label", label)
      .attr("aria-disabled", "true")
      .text(label);
  }

  // Update link hrefs in-place by rewriting host on existing anchors
  updateLinkHrefs() {
    const $linksCell = this.$tableElement.find('td[data-col="links"]');
    $linksCell.find("a.link-label").each(function () {
      const current = this.getAttribute("href");
      const rewritten = audioPlayer.rewriteFileHost(current);
      if (rewritten !== current) {
        this.setAttribute("href", rewritten);
      }
    });
  }

  // Update a specific link label ("720" | "480" | "MP3") with success/error styling
  updateLinkLabelStatus(label, isOk) {
    const $linksCell = this.$tableElement.find('td[data-col="links"]');
    const $label = $linksCell.find(`.link-label[data-label="${label}"]`);
    if (!$label.length) return;
    $label.toggleClass("text-success", Boolean(isOk));
    $label.toggleClass("text-danger", !Boolean(isOk));
  }

  // Mark or unmark the ANN Song ID cell as duplicate (red text)
  setAnnSongIdDuplicate(isDuplicate) {
    const $cell = this.$tableElement.find('td[data-col="annSongId"]');
    if (!$cell.length) return;
    $cell.toggleClass("text-danger fw-bold", Boolean(isDuplicate));
  }

  // Attach event listeners to table row elements for user interactions
  setupTableEventListeners($element) {
    $element.on("click", (e) => {
      const $target = $(e.target);
      if ($target.closest(".js-play-track").length) {
        eventBus.emit("song:play", this.key);
      } else if ($target.closest(".js-add-to-playlist").length) {
        eventBus.emit("playlist:add-song", { songId: this.key, target: $target.closest(".js-add-to-playlist")[0] });
      } else if ($target.closest(".js-trash").length) {
        eventBus.emit("song:remove", this.key);
      } else if ($target.closest(".js-info").length) {
        eventBus.emit("song:show-info", this.key);
      }
    });
  }

  // Attach event listeners to mobile card elements for user interactions
  setupCardEventListeners($element) {
    $element.on("click", (e) => {
      const $target = $(e.target);
      if ($target.closest(".js-play-track").length) {
        eventBus.emit("song:play", this.key);
      } else if ($target.closest(".js-add-to-playlist").length) {
        eventBus.emit("playlist:add-song", { songId: this.key, target: $target.closest(".js-add-to-playlist")[0] });
      } else if ($target.closest(".js-trash").length) {
        eventBus.emit("song:remove", this.key);
      } else if ($target.closest(".js-info").length) {
        eventBus.emit("song:show-info", this.key);
      }
    });
  }

  // Update play button visual states for both table and card views
  updatePlayButtonState() {
    const currentSongId = appState.getStateSlice("audio.currentSongId");
    const isCurrent = currentSongId === this.key;
    const isPlaying = audioPlayer.isPlaying();

    [this.$tableElement, this.$cardElement].forEach($el => {
      if ($el) {
        const $btn = $el.find(".js-play-track");
        $btn.toggleClass("isPlaying", isCurrent && isPlaying);
        $btn.toggleClass("isPaused", isCurrent && !isPlaying && currentSongId != null);
      }
    });
  }

  // Set the visibility state and update DOM element display properties
  setVisible(isVisible) {
    this.$tableElement.toggleClass("d-none", !isVisible);
    this.$cardElement.toggleClass("d-none", !isVisible);
  }

  // Check if this data row has any available audio or video sources
  hasPlayableSources() {
    return Boolean(this.data.HQ || this.data.MQ || this.data.audio);
  }

  // Get the anime title based on current language preference setting
  getAnimeTitle() {
    return (settingsManager.get("language") === "romaji")
      ? (this.data.animeJPName || this.data.animeENName || "")
      : (this.data.animeENName || this.data.animeJPName || "");
  }

  // Clean text by removing line breaks and normalizing whitespace
  sanitize(text) {
    return String(text ?? "").replace(/[\r\n]+/g, " ");
  }

  // Convert song type to short display format (OP1, ED2, IN, etc.)
  shortTypeDisplay(t) {
    const s = String(t || "").trim();
    const up = s.toUpperCase();
    const getDigits = (str) => {
      let out = "";
      for (const ch of String(str)) {
        if (ch >= "0" && ch <= "9") out += ch;
      }
      return out;
    };
    if (up.startsWith("OPENING") || up.startsWith("OP")) { const n = getDigits(s); return "OP" + n; }
    if (up.startsWith("ENDING") || up.startsWith("ED")) { const n = getDigits(s); return "ED" + n; }
    if (up.startsWith("INSERT") || up.startsWith("IN")) { return "IN"; }
    return s;
  }

  // Clean up DOM elements and remove them from the document
  destroy() {
    if (this.$tableElement?.length) {
      this.$tableElement.remove();
      this.$tableElement = null;
    }
    if (this.$cardElement?.length) {
      this.$cardElement.remove();
      this.$cardElement = null;
    }
  }
}
