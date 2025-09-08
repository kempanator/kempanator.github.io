const API_BASE = "https://anisongdb.com";
const SETTINGS_KEY = "adb_settings";
const PLAYLIST_STORAGE_KEY = "adb_playlists";

const DefaultColumnOrder = [
  "plus", "rownum", "annid", "anime", "type", "song", "artist",
  "vintage", "difficulty", "links", "action", "category", "broadcast", "length",
  "composer", "arranger", "annSongId", "amqSongId", "anilistId",
  "malId", "kitsuId", "anidbId"
];

const DefaultSettings = {
  theme: "dark",
  radioMode: "none", // none | repeat | loopAll
  fileHost: "nawdist",
  language: "english", // english | romaji
  searchMode: "simple", // simple | advanced
  zebraStripe: true, // zebra stripe styling for table rows
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
  },
  columnOrder: [...DefaultColumnOrder]
};
