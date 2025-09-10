class InfoModal {
  constructor() {
    this.$modal = $("#infoModal");
    this.$title = $("#infoModal .modal-title");
    this.$infoViewMode = $("#infoViewMode");
    this.$infoFormatted = $("#infoFormatted");
    this.$infoJson = $("#infoJson");
    this.$btnInfoPlay = $("#btnInfoPlay");
    this.$btnInfoPrev = $("#btnInfoPrev");
    this.$btnInfoNext = $("#btnInfoNext");
    this.wireEvents();
  }

  wireEvents() {
    eventBus.on("song:show-info", (key) => {
      this.showForKey(key);
      this.$modal.modal("show");
    });

    eventBus.on("modal:info-prev", () => this.navigate("prev"));
    eventBus.on("modal:info-next", () => this.navigate("next"));

    this.$infoViewMode.on("change", () => this.updateViewMode());

    this.$btnInfoPrev.on("click", () => eventBus.emit("modal:info-prev"));
    this.$btnInfoNext.on("click", () => eventBus.emit("modal:info-next"));

    this.$modal.on("click", ".search-link", (event) => {
      event.preventDefault();
      const scope = event.target.dataset.scope;
      const searchTerm = event.target.dataset.search;
      if (searchTerm) {
        $("#searchScope").val(scope);
        $("#searchQuery").val(searchTerm);
        this.$modal.modal("hide");
        eventBus.emit("search:submit");
      }
    });
  }

  // Update the modal play button state and text using jQuery
  updateModalPlayButton() {
    const currentKey = audioPlayer.getCurrentKey();
    const modalKey = this.$modal.data("key");
    const isPlaying = audioPlayer.isPlaying();
    const isModalTrack = modalKey && modalKey === currentKey && isPlaying;

    this.$btnInfoPlay.toggleClass("isPlaying", isModalTrack);
    this.$btnInfoPlay.toggleClass("isPaused", !isPlaying && modalKey === currentKey);

    this.$btnInfoPlay.html(
      isModalTrack
        ? '<i class="fa-solid fa-pause me-1"></i>Pause'
        : '<i class="fa-solid fa-play me-1"></i>Play'
    );
  }

  showForKey(key) {
    if (!key) return;

    const songs = appState.getStateSlice("songs");
    const data = songs.visible.find(r => tableManager.rowKey(r) === key) || songs.raw.find(r => tableManager.rowKey(r) === key);
    if (!data) return;

    this.$modal.data("key", key);

    const index = songs.visible.findIndex(r => tableManager.rowKey(r) === key);
    this.$title.html(`Song Details${index >= 0 ? ` <span class="text-muted small ms-2">#${index + 1}</span>` : ""}`);

    this.$infoJson.text(JSON.stringify(data, null, 2));
    this.$infoFormatted.html(this.buildInfoFormattedHTML(data, index));

    const hasAny = Boolean(
      audioPlayer.buildMediaUrl(data.audio) ||
      audioPlayer.buildMediaUrl(data.MQ) ||
      audioPlayer.buildMediaUrl(data.HQ)
    );
    this.$btnInfoPlay.prop("disabled", !hasAny);

    // Reset listeners
    this.$btnInfoPlay.off("click").on("click", () => {
      if (!hasAny) return;
      const key = this.$modal.data("key");
      if (key) eventBus.emit("song:play", key);
    });

    this.updateModalPlayButton();
    this.updateViewMode();
  }

  updateViewMode() {
    const mode = this.$infoViewMode.val();
    this.$infoFormatted.toggleClass("d-none", mode !== "formatted");
    this.$infoJson.toggleClass("d-none", mode !== "raw");
  }

  navigate(direction) {
    const currentKey = this.$modal.data("key");
    if (!currentKey) return;
    const nextKey = direction === "next" ? this.nextKeyFrom(currentKey) : this.prevKeyFrom(currentKey);
    if (nextKey && nextKey !== currentKey) this.showForKey(nextKey);
  }

  nextKeyFrom(key) {
    const order = tableManager.table.getDomOrderKeys();
    if (!order.length) return null;
    const i = Math.max(0, order.indexOf(key));
    return order[(i + 1) % order.length];
  }

  prevKeyFrom(key) {
    const order = tableManager.table.getDomOrderKeys();
    if (!order.length) return null;
    const i = Math.max(0, order.indexOf(key));
    return order[(i - 1 + order.length) % order.length];
  }

  sanitize(text) {
    return String(text ?? "").replace(/[\r\n]+/g, " ");
  }

  fileBaseName(pathOrUrl) {
    if (!pathOrUrl) return "";
    try {
      if (/^https?:\/\//i.test(pathOrUrl)) {
        const u = new URL(pathOrUrl);
        const p = u.pathname.split("/").filter(Boolean).pop() || "";
        return p;
      }
      const p = String(pathOrUrl).split("?")[0].split("#")[0];
      return p.split("/").pop() || p;
    } catch {
      return String(pathOrUrl).split("/").pop() || "";
    }
  }

  buildArtistInfo(artist, scope = "Artist") {
    if (!artist) return "";
    const names = artist.names || [];
    const groups = artist.groups || [];
    const members = artist.members || [];
    const $container = $("<div>").addClass("artist-info mb-2 p-2 border rounded");

    if (names.length > 0) {
      const artistNames = names.map(name => escapeHtml(name)).join(", ");
      const $nameDiv = $("<div>").addClass("fw-semibold");
      $nameDiv.append($("<span>").text(artistNames));
      $nameDiv.append(
        $("<i>")
          .addClass("fa-solid fa-magnifying-glass text-muted ms-2 search-link")
          .attr("data-search", names[0])
          .attr("data-scope", scope)
      );
      $container.append($nameDiv);
    }

    if (groups.length > 0) {
      const $groupsDiv = $("<div>").addClass("mt-1");
      $groupsDiv.append($("<small>").addClass("text-muted").text("Groups:"));
      $groupsDiv.append(" ");
      groups.forEach(group => {
        const groupNames = group.names || [];
        const groupName = groupNames[0] || "";
        const $badge = $("<span>")
          .addClass("badge bg-secondary me-1 search-link")
          .attr("data-search", groupName)
          .attr("data-scope", scope)
          .html(groupNames.map(name => escapeHtml(name)).join(", "));
        $groupsDiv.append($badge);
      });
      $container.append($groupsDiv);
    }

    if (members.length > 0) {
      const $membersDiv = $("<div>").addClass("mt-1");
      $membersDiv.append($("<small>").addClass("text-muted").text("Members:"));
      $membersDiv.append(" ");
      members.forEach(member => {
        const memberNames = member.names || [];
        const memberName = memberNames[0] || "";
        const $badge = $("<span>")
          .addClass("badge bg-info me-1 search-link")
          .attr("data-search", memberName)
          .attr("data-scope", scope)
          .html(memberNames.map(name => escapeHtml(name)).join(", "));
        $membersDiv.append($badge);
      });
      $container.append($membersDiv);
    }

    return $container.prop("outerHTML");
  }

  // Builds a table row for an ID
  idRow(title, id, siteUrl, siteScope, idLogoPath) {
    const $row = $("<tr>");
    const $titleCell = $("<td>");
    if (idLogoPath) {
      $titleCell.append(
        $("<img>")
          .attr("src", idLogoPath)
          .attr("alt", title + " logo")
          .addClass("me-2")
          .css({ width: "20px", height: "20px" })
      );
    }
    $titleCell.append($("<span>").text(title).addClass("fw-semibold"));
    if (siteUrl) {
      $titleCell.append(
        $("<a>")
          .attr("href", siteUrl)
          .attr("target", "_blank")
          .attr("rel", "noreferrer")
          .addClass("ms-2")
          .append($("<i>").addClass("fa-solid fa-external-link"))
      );
    }
    $row.append($titleCell);
    // ID
    const $idCell = $("<td>");
    $idCell.text(id || "");
    if (siteScope) {
      $idCell.append(
        $("<i>")
          .addClass("fa-solid fa-magnifying-glass text-muted ms-2 search-link")
          .attr("data-search", id)
          .attr("data-scope", siteScope)
      );
    }
    $row.append($idCell);
    return $row;
  }

  buildInfoFormattedHTML(d, index) {
    const title = this.sanitize(tableManager.getAnimeTitle(d));
    const songType = this.sanitize(d.songType || "");
    const vintage = this.sanitize(d.animeVintage || "");
    const dif = (d.songDifficulty ?? null);
    const artist = this.sanitize(d.songArtist || "");
    const songName = this.sanitize(d.songName || "");
    const songCategory = this.sanitize(d.songCategory || "");
    const animeType = this.sanitize(d.animeType || "");
    const animeCategory = this.sanitize(d.animeCategory || "");
    const broadcast = broadcastText(d);
    const length = formatDurationSeconds(d.songLength);

    const ids = d.linked_ids || {};

    const hq = audioPlayer.buildMediaUrl(d.HQ) || "";
    const mq = audioPlayer.buildMediaUrl(d.MQ) || "";
    const mp3 = audioPlayer.buildMediaUrl(d.audio) || "";
    const nameHQ = this.fileBaseName(d.HQ || hq);
    const nameMQ = this.fileBaseName(d.MQ || mq);
    const nameMP3 = this.fileBaseName(d.audio || mp3);

    const composer = this.sanitize(d.songComposer || "");
    const arranger = this.sanitize(d.songArranger || "");

    // Use jQuery to build the HTML structure
    const $root = $("<div>");
    // Header
    const $header = $("<div>").addClass("detail-header mb-2");
    const $headerRow = $("<div>").addClass("d-flex justify-content-between align-items-start");
    const $headerCol = $("<div>");
    const $h5 = $("<h5>").addClass("mb-1").append(
      $("<span>", { text: title }),
      $("<i>")
        .addClass("fa-solid fa-magnifying-glass text-muted ms-2 search-link")
        .attr("data-search", title)
        .attr("data-scope", "Anime")
    );
    $headerCol.append($h5);
    $headerCol.append(
      $("<div>")
        .addClass("text-muted small")
        .html(escapeHtml(songName) + (artist ? ` — ${escapeHtml(artist)}` : ""))
    );
    $headerRow.append($headerCol);
    $header.append($headerRow);
    $root.append($header);

    // Info rows
    const $row1 = $("<div>").addClass("row g-3 mb-3");
    const $col1 = $("<div>").addClass("col-md-6");
    $col1.append($("<div>").html(`<span class="fw-semibold">Type:</span> ${escapeHtml(songType)}`));
    $col1.append($("<div>").html(`<span class="fw-semibold">Season:</span> ${escapeHtml(vintage)}`)
      .append($("<i>")
        .addClass("fa-solid fa-magnifying-glass text-muted ms-2 search-link")
        .attr("data-search", vintage)
        .attr("data-scope", "Season")
      )
    );
    $col1.append($("<div>").html(`<span class="fw-semibold">Length:</span> ${escapeHtml(length)}`));
    $col1.append($("<div>").html(`<span class="fw-semibold">Difficulty:</span> ${escapeHtml(dif)}`));
    $row1.append($col1);

    const $col2 = $("<div>").addClass("col-md-6");
    $col2.append($("<div>").html(`<span class="fw-semibold">Anime Type:</span> ${escapeHtml(animeType)}`));
    $col2.append($("<div>").html(`<span class="fw-semibold">Anime Category:</span> ${escapeHtml(animeCategory)}`));
    $col2.append($("<div>").html(`<span class="fw-semibold">Song Category:</span> ${escapeHtml(songCategory)}`));
    $col2.append($("<div>").html(`<span class="fw-semibold">Broadcast:</span> ${escapeHtml(broadcast)}`));
    $row1.append($col2);
    $root.append($row1);

    // Composer/Arranger row
    const $row2 = $("<div>").addClass("row g-3 mb-3");
    const $col3 = $("<div>").addClass("col-md-6");
    $col3.append($("<div>").html(`<span class="fw-semibold">Composer:</span> ${escapeHtml(composer)}`));
    $row2.append($col3);
    const $col4 = $("<div>").addClass("col-md-6");
    $col4.append($("<div>").html(`<span class="fw-semibold">Arranger:</span> ${escapeHtml(arranger)}`));
    $row2.append($col4);
    $root.append($row2);

    // IDs and Files combined row
    const $row3 = $("<div>").addClass("row g-3 mb-3");
    // IDs column
    const $colIds = $("<div>").addClass("col-md-6");
    $colIds.append($("<div>").addClass("fw-semibold mb-1").text("IDs"));
    const $idTable = $("<table>").addClass("table-sm");
    const $idTbody = $("<tbody>");
    if (d.annId) {
      $idTbody.append(this.idRow(
        "ANN ID",
        d.annId,
        `https://www.animenewsnetwork.com/encyclopedia/anime.php?id=${encodeURIComponent(d.annId)}`,
        "ANN",
        "assets/logo_ann.png"
      ));
    }
    if (ids.anilist) {
      $idTbody.append(this.idRow(
        "Anilist ID",
        ids.anilist,
        `https://anilist.co/anime/${encodeURIComponent(ids.anilist)}`,
        null,
        "assets/logo_anilist.png"
      ));
    }
    if (ids.myanimelist) {
      $idTbody.append(this.idRow(
        "MAL ID",
        ids.myanimelist,
        `https://myanimelist.net/anime/${encodeURIComponent(ids.myanimelist)}`,
        null,
        "assets/logo_mal.png"
      ));
    }
    if (ids.kitsu) {
      $idTbody.append(this.idRow(
        "Kitsu ID",
        ids.kitsu,
        `https://kitsu.io/anime/${encodeURIComponent(ids.kitsu)}`,
        null,
        "assets/logo_kitsu.png"
      ));
    }
    if (ids.anidb) {
      $idTbody.append(this.idRow(
        "AniDB ID",
        ids.anidb,
        `https://anidb.net/anime/${encodeURIComponent(ids.anidb)}`,
        null,
        "assets/logo_anidb.png"
      ));
    }
    if (d.annSongId) {
      $idTbody.append(this.idRow(
        "ANN Song ID",
        d.annSongId,
        null,
        "ANN_SONG"
      ));
    }
    if (d.amqSongId) {
      $idTbody.append(this.idRow(
        "AMQ Song ID",
        d.amqSongId,
        null,
        "AMQ_SONG"
      ));
    }
    $idTable.append($idTbody);
    $colIds.append($idTable);

    // Files column
    const $colFiles = $("<div>").addClass("col-md-6");
    $colFiles.append($("<div>").addClass("fw-semibold mb-1").text("Files"));
    const $fileTable = $("<table>").addClass("table-sm mb-0");
    const $fileTbody = $("<tbody>");
    if (hq) {
      $fileTbody.append(
        $("<tr>")
          .append($("<td>").addClass("fw-semibold").text("720"))
          .append(
            $("<td>").html(
              `<a href="${escapeHtml(hq)}" target="_blank" rel="noopener">${escapeHtml(nameHQ)}</a>`
            )
          )
      );
    }
    if (mq) {
      $fileTbody.append(
        $("<tr>")
          .append($("<td>").addClass("fw-semibold").text("480"))
          .append(
            $("<td>").html(
              `<a href="${escapeHtml(mq)}" target="_blank" rel="noopener">${escapeHtml(nameMQ)}</a>`
            )
          )
      );
    }
    if (mp3) {
      $fileTbody.append(
        $("<tr>")
          .append($("<td>").addClass("fw-semibold").text("MP3"))
          .append(
            $("<td>").html(
              `<a href="${escapeHtml(mp3)}" target="_blank" rel="noopener">${escapeHtml(nameMP3)}</a>`
            )
          )
      );
    }
    $fileTable.append($fileTbody);
    $colFiles.append($fileTable);

    $row3.append($colIds, $colFiles);
    $root.append($row3);

    // Artists
    if (d.artists && d.artists.length > 0) {
      const $artists = $("<div>").addClass("mb-3");
      $artists.append($("<div>").addClass("fw-semibold mb-2").text("Artists"));
      d.artists.forEach(artist => {
        $artists.append(this.buildArtistInfo(artist));
      });
      $root.append($artists);
    }

    // Composers
    if (d.composers && d.composers.length > 0) {
      const $composers = $("<div>").addClass("mb-3");
      $composers.append($("<div>").addClass("fw-semibold mb-2").text("Composers"));
      d.composers.forEach(composer => {
        $composers.append(this.buildArtistInfo(composer, "Composer"));
      });
      $root.append($composers);
    }

    // Arrangers
    if (d.arrangers && d.arrangers.length > 0) {
      const $arrangers = $("<div>").addClass("mb-3");
      $arrangers.append($("<div>").addClass("fw-semibold mb-2").text("Arrangers"));
      d.arrangers.forEach(arranger => {
        $arrangers.append(this.buildArtistInfo(arranger, "Composer"));
      });
      $root.append($arrangers);
    }

    return $root.html();
  }
}

const infoModal = new InfoModal();
