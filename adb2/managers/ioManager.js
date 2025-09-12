class IOManager {

  // Export visible table data as JSON file
  exportAsJSON(data) {
    if (!Array.isArray(data) || data.length === 0) {
      showAlert("No data to export", "warning");
      return;
    }

    const content = JSON.stringify(data, null, 2);
    const filename = this.makeDownloadFilename("json");
    this.downloadFile(content, filename, "application/json");
  }

  // Export visible table data as CSV file
  exportAsCSV(data) {
    if (!Array.isArray(data) || data.length === 0) {
      showAlert("No data to export", "warning");
      return;
    }

    // Columns align with parseCsvToRows mapping
    const columns = [
      { header: "ANN ID", getValue: row => row.annId || "" },
      { header: "Anime English", getValue: row => row.animeENName || "" },
      { header: "Anime Romaji", getValue: row => row.animeJPName || "" },
      { header: "Anime Type", getValue: row => row.animeType || "" },
      { header: "Anime Category", getValue: row => row.animeCategory || "" },
      { header: "Type", getValue: row => row.songType || "" },
      { header: "Song", getValue: row => row.songName || "" },
      { header: "Artist", getValue: row => row.songArtist || "" },
      { header: "Vintage", getValue: row => row.animeVintage || "" },
      { header: "Difficulty", getValue: row => row.songDifficulty || "" },
      { header: "Song Category", getValue: row => row.songCategory || "" },
      { header: "Broadcast", getValue: row => broadcastText(row) },
      { header: "Length", getValue: row => formatDurationSeconds(row.songLength) },
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

    const csvRows = [];
    csvRows.push(columns.map(col => `"${col.header}"`).join(","));
    data.forEach((row, index) => {
      const values = columns.map(col => {
        const value = col.getValue(row, index);
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(","));
    });

    const csvContent = csvRows.join("\n");
    const filename = this.makeDownloadFilename("csv");
    this.downloadFile(csvContent, filename, "text/csv");
  }

  // Build a sanitized download filename from current search inputs
  makeDownloadFilename(extension = "json") {
    if (settingsManager.get("searchMode") === "advanced") {
      const anime = $("#searchAnime").val().trim();
      const artist = $("#searchArtist").val().trim();
      const song = $("#searchSong").val().trim();
      const composer = $("#searchComposer").val().trim();
      const parts = [anime, artist, song, composer].filter(Boolean);
      if (parts.length === 0) return `download.${extension}`;
      const combined = parts.join(" ");
      const safe = combined.replace(/[^a-z0-9 _.-]+/gi, "");
      return (safe || "download") + `.${extension}`;
    } else {
      const q = (($("#searchQuery").val() || "")).trim();
      if (!q) return `download.${extension}`;
      const safe = q.replace(/[^a-z0-9 _.-]+/gi, "");
      return (safe || "download") + `.${extension}`;
    }
  }

  // Trigger a browser download for the given content
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

  // Parse uploaded file text into normalized rows
  parseFileText(fileMeta, text) {
    const name = String(fileMeta?.name || "").toLowerCase();
    const type = String(fileMeta?.type || "").toLowerCase();

    //Parse CSV
    if (name.endsWith(".csv") || type.includes("csv")) {
      return this.parseCsvToRows(text);
    }

    // Parse JSON, support multiple JSON shapes
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.map(s => this.mapSongToRow(s)).filter(Boolean);
    }
    if (parsed && typeof parsed === "object") {
      if (parsed.songs) { // official AMQ format
        return parsed.songs.map(s => this.mapSongToRow(s)).filter(Boolean);
      }
      if (parsed.songHistory) { // Answer Stats script format
        return Object.values(parsed.songHistory).map(s => this.mapSongToRow(s)).filter(Boolean);
      }
    }
    throw new Error("Uploaded JSON must be an array of rows or an object with a songs array.");
  }

  // Convert CSV text into normalized row objects
  parseCsvToRows(text) {
    const records = this.csvParse(text);
    if (records.length === 0) return [];
    const headers = records[0].map(h => String(h).trim());
    const rows = [];
    for (let i = 1; i < records.length; i++) {
      const rec = records[i];
      if (!rec || rec.length === 0) continue;
      const obj = {};
      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = rec[j] ?? "";
      }

      const broadcast = String(obj["Broadcast"] || "").trim();
      const lengthStr = String(obj["Length"] || "").trim();
      const songLength = this.parseCsvLength(lengthStr);

      const linkedIds = {};
      const anilist = String(obj["Anilist ID"] || "").trim();
      const mal = String(obj["MAL ID"] || "").trim();
      const kitsu = String(obj["Kitsu ID"] || "").trim();
      const anidb = String(obj["AniDB ID"] || "").trim();
      if (anilist) linkedIds.anilist = anilist;
      if (mal) linkedIds.myanimelist = mal;
      if (kitsu) linkedIds.kitsu = kitsu;
      if (anidb) linkedIds.anidb = anidb;

      const row = {
        annId: this.tryParseNumber(obj["ANN ID"]),
        animeENName: obj["Anime English"] || "",
        animeJPName: obj["Anime Romaji"] || "",
        animeType: obj["Anime Type"] || "",
        animeCategory: obj["Anime Category"] || "",
        songType: obj["Type"] || "",
        songName: obj["Song"] || "",
        songArtist: obj["Artist"] || "",
        animeVintage: obj["Vintage"] || "",
        songDifficulty: this.tryParseNumber(obj["Difficulty"]),
        songCategory: obj["Song Category"] || "",
        isDub: broadcast === "Dub" || broadcast === "Dub/Rebroadcast",
        isRebroadcast: broadcast === "Rebroadcast" || broadcast === "Dub/Rebroadcast",
        songLength: songLength,
        songComposer: obj["Composer"] || "",
        songArranger: obj["Arranger"] || "",
        annSongId: this.tryParseNumber(obj["ANN Song ID"]),
        amqSongId: this.tryParseNumber(obj["AMQ Song ID"]),
        linked_ids: Object.keys(linkedIds).length ? linkedIds : undefined,
        HQ: obj["720p"] || "",
        MQ: obj["480p"] || "",
        audio: obj["MP3"] || ""
      };
      rows.push(row);
    }
    return rows;
  }

  // RFC4180-style CSV parser with quoted fields
  csvParse(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    let i = 0;
    const pushField = () => { row.push(field); field = ""; };
    const pushRow = () => { rows.push(row); row = []; };
    while (i < text.length) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        } else { field += ch; i++; continue; }
      } else {
        if (ch === '"') { inQuotes = true; i++; continue; }
        if (ch === ',') { pushField(); i++; continue; }
        if (ch === '\n') { pushField(); pushRow(); i++; continue; }
        if (ch === '\r') {
          if (text[i + 1] === '\n') { pushField(); pushRow(); i += 2; continue; }
          pushField(); pushRow(); i++; continue;
        }
        field += ch; i++; continue;
      }
    }
    pushField();
    if (row.length > 1 || (row.length === 1 && row[0] !== "")) {
      pushRow();
    }
    return rows.filter(r => r.length && !(r.length === 1 && r[0] === ""));
  }

  // Parse CSV length column data (MM:SS) to seconds (number)
  parseCsvLength(s) {
    const m = String(s || "").trim().match(/^(\d+):(\d{2})$/);
    if (!m) return "";
    const minutes = parseInt(m[1], 10);
    const seconds = parseInt(m[2], 10);
    const total = minutes * 60 + seconds;
    return Number.isFinite(total) ? total : "";
  }

  // Try to parse a number from a string
  tryParseNumber(v) {
    const n = Number(String(v || "").trim());
    return Number.isFinite(n) ? n : (String(v || "").trim() || "");
  }

  // Map various song schemas to a normalized row
  mapSongToRow(entry) {
    if (!entry || typeof entry !== "object") return null;

    const row = {
      annId: entry.annId ?? entry.siteIds?.annId ?? entry.songInfo?.siteIds?.annId ?? null,
      animeENName: entry.animeENName ?? entry.animeEnglishName ?? entry.songInfo?.animeNames?.english ?? entry.anime?.english ?? entry.animeEnglish ?? entry.animeEng ?? "",
      animeJPName: entry.animeJPName ?? entry.animeRomajiName ?? entry.songInfo?.animeNames?.romaji ?? entry.anime?.romaji ?? entry.animeRomaji ?? entry.animeRom ?? "",
      animeAltName: entry.animeAltName ?? null,
      animeType: entry.animeType ?? entry.songInfo?.animeType ?? "",
      animeCategory: entry.animeCategory ?? "",
      animeVintage: entry.animeVintage ?? entry.vintage ?? entry.songInfo?.vintage ?? "",
      songType: entry.songType ?? entry.type ?? entry.songInfo?.type ?? null,
      songName: entry.songName ?? entry.name ?? entry.songInfo?.songName ?? "",
      songArtist: entry.artist ?? entry.songArtist ?? entry.songInfo?.artist ?? entry.artistInfo?.name ?? "",
      songComposer: entry.songComposer ?? entry.composerInfo?.name ?? "",
      songArranger: entry.songArranger ?? entry.arrangerInfo?.name ?? "",
      songDifficulty: parseFloat(entry.songDifficulty ?? entry.difficulty ?? entry.songInfo?.animeDifficulty) || null,
      songCategory: entry.songCategory ?? "",
      songLength: parseFloat(entry.songLength ?? entry.videoLength) || null,
      isDub: Boolean(entry.isDub ?? entry.dub ?? entry.songInfo?.dub),
      isRebroadcast: Boolean(entry.isRebroadcast ?? entry.rebroadcast ?? entry.songInfo?.rebroadcast),
      annSongId: entry.annSongId ?? null,
      amqSongId: entry.amqSongId ?? null,
      linked_ids: {
        anilist: entry.anilistId ?? entry.linked_ids?.anilist ?? entry.siteIds?.aniListId ?? null,
        myanimelist: entry.malId ?? entry.linked_ids?.myanimelist ?? entry.siteIds?.malId ?? null,
        kitsu: entry.kitsuId ?? entry.linked_ids?.kitsu ?? entry.siteIds?.kitsuId ?? null,
        anidb: entry.anidbId ?? entry.linked_ids?.anidb ?? entry.siteIds?.anidbId ?? null,
      },
      HQ: entry.HQ ?? entry.video720 ?? entry.videoUrl ?? entry.urls?.catbox?.[720] ?? entry.songInfo?.videoTargetMap?.catbox?.[720] ?? entry.songInfo?.urlMap?.catbox?.[720] ?? entry.LinkVideo ?? "",
      MQ: entry.MQ ?? entry.video480 ?? entry.videoUrl ?? entry.urls?.catbox?.[480] ?? entry.songInfo?.videoTargetMap?.catbox?.[480] ?? entry.songInfo?.urlMap?.catbox?.[480] ?? entry.LinkVideo ?? "",
      audio: entry.audio ?? entry.videoUrl ?? entry.urls?.catbox?.[0] ?? entry.songInfo?.videoTargetMap?.catbox?.[0] ?? entry.songInfo?.urlMap?.catbox?.[0] ?? entry.LinkMp3 ?? ""
    };
    if (typeof row.songType === "number") {
      row.songType = this.mapTypeCodeToText(row.songType, entry.songTypeNumber ?? entry.songInfo?.typeNumber);
    }
    return row;
  }

  // Convert numeric type code/number to human-readable text
  mapTypeCodeToText(typeCode, typeNumber) {
    let base = "";
    if (typeCode === 1) base = "Opening";
    else if (typeCode === 2) base = "Ending";
    else if (typeCode === 3) base = "Insert";
    else base = "";
    if (!base) return "";
    if (typeNumber != null && typeNumber !== "") return `${base} ${typeNumber}`;
    return base;
  }
}

const ioManager = new IOManager();
