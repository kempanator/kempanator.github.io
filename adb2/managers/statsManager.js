// Statistics Manager Class
class StatsManager {
  constructor() {}

  // Calculate statistics from current table data
  calculateStats() {
    const tableData = appState.getStateSlice("songs.visible");
    if (!tableData || tableData.length === 0) {
      return {
        total_songs: 0,
        total_anime: 0,
        total_artists: 0,
        total_seasons: 0,
        songs_by_type: {},
        songs_by_category: {},
        songs_by_anime_type: {},
        songs_by_broadcast: {},
        total_links: {},
        vintage_distribution: {},
        difficulty_distribution: {},
        difficulty_histogram: Array(10).fill(0),
        playable_content: { total: 0, with_hq: 0, with_mq: 0, with_audio: 0 },
        top_artists: [],
        top_anime: []
      };
    }

    const stats = {
      total_songs: tableData.length,
      total_anime: 0,
      total_artists: 0,
      total_seasons: 0,
      average_difficulty: 0,
      average_length_seconds: 0,
      songs_by_type: {},
      songs_by_category: {},
      songs_by_anime_type: {},
      songs_by_broadcast: {},
      total_links: { HQ: 0, MQ: 0, audio: 0 },
      vintage_distribution: {},
      difficulty_distribution: {},
      difficulty_histogram: Array(10).fill(0),
      playable_content: { total: 0, with_hq: 0, with_mq: 0, with_audio: 0 },
      top_artists: [],
      top_anime: []
    };

    const animeSet = new Set();
    const artistSet = new Set();
    const seasonSet = new Set();
    const artistCounts = {};
    const animeCounts = {};

    tableData.forEach(row => {
      // Song types
      const songType = this.categorizeSongType(row.songType);
      stats.songs_by_type[songType] = (stats.songs_by_type[songType] || 0) + 1;

      // Song categories
      const category = row.songCategory || "No Category";
      stats.songs_by_category[category] = (stats.songs_by_category[category] || 0) + 1;

      // Anime types
      const animeType = row.animeType;
      stats.songs_by_anime_type[animeType] = (stats.songs_by_anime_type[animeType] || 0) + 1;

      // Broadcast types
      const broadcastType = broadcastText(row);
      stats.songs_by_broadcast[broadcastType] = (stats.songs_by_broadcast[broadcastType] || 0) + 1;

      // Links
      if (row.HQ) stats.total_links.HQ++;
      if (row.MQ) stats.total_links.MQ++;
      if (row.audio) stats.total_links.audio++;

      // Playable content
      if (row.HQ || row.MQ || row.audio) {
        stats.playable_content.total++;
        if (row.HQ) stats.playable_content.with_hq++;
        if (row.MQ) stats.playable_content.with_mq++;
        if (row.audio) stats.playable_content.with_audio++;
      }

      // Vintage distribution
      const vintage = row.animeVintage || "Unknown";
      stats.vintage_distribution[vintage] = (stats.vintage_distribution[vintage] || 0) + 1;

      // Difficulty distribution
      const difficulty = this.categorizeDifficulty(row.songDifficulty);
      stats.difficulty_distribution[difficulty] = (stats.difficulty_distribution[difficulty] || 0) + 1;

      // Numeric difficulty histogram (1-100 in bins of 10). Exclude 0/null.
      const numDifRaw = Number(row.songDifficulty);
      if (Number.isFinite(numDifRaw) && numDifRaw > 0) {
        const clamped = Math.min(numDifRaw, 100);
        const binIndex = Math.min(9, Math.floor((clamped - 1) / 10));
        stats.difficulty_histogram[binIndex] = (stats.difficulty_histogram[binIndex] || 0) + 1;
      }

      // Unique counts
      const animeTitle = this.getAnimeTitle(row) || "Unknown";
      const artist = row.songArtist || "Unknown";
      const season = row.animeVintage || "Unknown";

      animeSet.add(animeTitle);
      artistSet.add(artist);
      seasonSet.add(season);

      // Count for top lists
      artistCounts[artist] = (artistCounts[artist] || 0) + 1;
      animeCounts[animeTitle] = (animeCounts[animeTitle] || 0) + 1;
    });

    // Calculate average difficulty and average length
    // Difficulty: consider numeric songDifficulty when present
    let difficultySum = 0;
    let difficultyCount = 0;
    let lengthSum = 0;
    let lengthCount = 0;

    tableData.forEach(row => {
      const dif = Number.isFinite(Number(row.songDifficulty)) ? Number(row.songDifficulty) : null;
      // Treat difficulty == 0 as 'no difficulty' and exclude from average
      if (dif !== null && dif !== 0) {
        difficultySum += dif;
        difficultyCount++;
      }

      const len = Number.isFinite(Number(row.songLength)) ? Number(row.songLength) : null;
      if (len !== null) {
        lengthSum += len;
        lengthCount++;
      }
    });

    stats.average_difficulty = difficultyCount > 0 ? (difficultySum / difficultyCount) : 0;
    stats.average_length_seconds = lengthCount > 0 ? (lengthSum / lengthCount) : 0;

    stats.total_anime = animeSet.size;
    stats.total_artists = artistSet.size;
    stats.total_seasons = seasonSet.size;

    // Get top artists and anime
    stats.top_artists = Object.entries(artistCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([artist, count]) => ({ artist, count }));

    stats.top_anime = Object.entries(animeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([anime, count]) => ({ anime, count }));

    return stats;
  }

  getAnimeTitle(row) {
    return row.animeENName || row.animeJPName || "Unknown";
  }

  // Categorize song type into main categories
  categorizeSongType(songType) {
    if (!songType) return "Unknown";

    const s = String(songType).trim().toUpperCase();

    if (s.startsWith("OPENING") || s.startsWith("OP")) {
      return "Opening";
    }
    if (s.startsWith("ENDING") || s.startsWith("ED")) {
      return "Ending";
    }
    if (s.startsWith("INSERT") || s.startsWith("IN")) {
      return "Insert";
    }

    return "Unknown";
  }

  // Categorize difficulty into groups based on numeric value
  categorizeDifficulty(difficulty) {
    if (difficulty === null || difficulty === undefined || difficulty === "") {
      return "Unknown";
    }

    const num = parseFloat(difficulty);
    if (isNaN(num)) {
      return "Unknown";
    }

    if (num >= 60) {
      return "Easy";
    } else if (num >= 25) {
      return "Medium";
    } else {
      return "Hard";
    }
  }

}

const statsManager = new StatsManager();
