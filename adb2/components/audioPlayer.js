class AudioPlayer {
  constructor() {
    this.audio = document.getElementById("player");
    this.wireEvents();
  }

  // Wire up audio element event listeners
  wireEvents() {
    this.audio.addEventListener("ended", () => this.onEnded());
    this.audio.addEventListener("pause", () => this.onPause());
    this.audio.addEventListener("play", () => this.onPlay());
    this.audio.addEventListener("error", () => this.onError());

    // Listen for song play events from EventBus
    eventBus.on("song:play", (songId) => {
      if (this.getCurrentKey() === songId) {
        this.togglePlayPause();
      } else {
        this.play(songId);
      }
    });

    // Listen for audio control events
    eventBus.on("audio:previous", () => {
      this.previous();
    });

    eventBus.on("audio:next", () => {
      this.next();
    });

    eventBus.on("audio:toggle-play-pause", () => {
      this.togglePlayPause();
    });

    // React to file host changes by updating current audio source
    eventBus.on("settings:fileHost-changed", () => {
      const key = this.getCurrentKey();
      if (!key) return;
      const src = this.getBestSourceUrlForKey(key);
      if (!src) return;
      const wasPlaying = !this.audio.paused;
      if (this.audio.src !== src) {
        this.audio.src = src;
      }
      if (wasPlaying) {
        this.audio.play().catch(() => { });
      }
    });
  }

  // Play a song by its unique key identifier
  play(key) {
    if (!key) return;

    const src = this.getBestSourceUrlForKey(key);
    if (!src) return;

    // Update global state instead of local state
    appState.updateStateSlice("audio.currentSongId", () => key);

    if (this.audio.src !== src) {
      this.audio.src = src;
    }

    this.ensureVisible();

    // Update button states before attempting to play
    this.updatePlayButtonStates(key);

    // Handle audio.play() Promise and potential autoplay restrictions
    this.audio.play().catch(error => {
      console.warn("AudioPlayer.play: Failed to play audio:", error);
      // Reset button states on play failure
      this.updatePlayButtonStates();
    });
  }

  // Pause the currently playing audio
  pause() {
    this.audio.pause();
  }

  // Stop playback and reset to beginning
  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
    appState.updateStateSlice("audio.currentSongId", () => null);
    this.updatePlayButtonStates();
  }

  // Toggle between play and pause states
  togglePlayPause() {
    if (this.audio.paused) {
      // Update button states before attempting to play
      this.updatePlayButtonStates();

      this.audio.play().catch(error => {
        console.warn("AudioPlayer.togglePlayPause: Failed to play audio:", error);
        // Reset button states on play failure
        this.updatePlayButtonStates();
      });
    } else {
      this.audio.pause();
    }
  }

  // Play the next song in the playlist
  next() {
    const nextKey = this.getNextPlayableKey();
    if (nextKey) {
      this.play(nextKey);
    }
  }

  // Play the previous song in the playlist
  previous() {
    const prevKey = this.getPreviousPlayableKey();
    if (prevKey) {
      this.play(prevKey);
    }
  }

  // Get the currently playing song data object
  getCurrentSong() {
    const currentKey = appState.getStateSlice("audio.currentSongId");
    if (!currentKey) return null;

    // Find the song data from state manager
    const songs = appState.getStateSlice("songs");
    return songs.visible.find(r => tableManager.getKeyForRow(r) === currentKey) ||
      songs.raw.find(r => tableManager.getKeyForRow(r) === currentKey);
  }

  // Check if audio is currently playing
  isPlaying() {
    return !this.audio.paused;
  }

  // Get playback progress as percentage (0-100)
  getProgress() {
    return this.audio.duration > 0 ? (this.audio.currentTime / this.audio.duration) * 100 : 0;
  }

  // Handle audio playback ended event
  onEnded() {
    const mode = settingsManager.get("radioMode");

    if (mode === "repeat") {
      this.audio.currentTime = 0;
      this.audio.play().catch(error => {
        console.warn("AudioPlayer.onEnded: Failed to repeat audio:", error);
      });
    } else if (mode === "loopAll") {
      this.next();
    }
  }

  // Handle audio error event (e.g., 404 on source). In loop mode, skip to next song.
  onError() {
    if (settingsManager.get("radioMode") === "loopAll") {
      this.next();
    }
  }

  // Handle audio play event
  onPlay() {
    this.updatePlayButtonStates();
  }

  // Handle audio pause event
  onPause() {
    this.updatePlayButtonStates();
  }

  // Get the next song key in the current order
  getNextKey() {
    const order = this.getOrderKeys();
    if (!order.length) return null;

    const currentKey = this.getCurrentKey();
    const i = Math.max(0, order.indexOf(currentKey));
    return order[(i + 1) % order.length];
  }

  // Get the previous song key in the current order
  getPreviousKey() {
    const order = this.getOrderKeys();
    if (!order.length) return null;

    const currentKey = this.getCurrentKey();
    const i = Math.max(0, order.indexOf(currentKey));
    return order[(i - 1 + order.length) % order.length];
  }

  // Get the next song key that has playable audio sources
  getNextPlayableKey() {
    const order = this.getOrderKeys();
    if (!order.length) return null;

    const currentKey = this.getCurrentKey();
    const start = Math.max(0, order.indexOf(currentKey));

    for (let step = 1; step <= order.length; step++) {
      const index = (start + step) % order.length;
      const k = order[index];
      if (this.getBestSourceUrlForKey(k)) return k;
    }

    return null;
  }

  // Get the previous song key that has playable audio sources
  getPreviousPlayableKey() {
    const order = this.getOrderKeys();
    if (!order.length) return null;

    const currentKey = this.getCurrentKey();
    const start = Math.max(0, order.indexOf(currentKey));

    for (let step = 1; step <= order.length; step++) {
      const index = (start - step + order.length) % order.length;
      const k = order[index];
      if (this.getBestSourceUrlForKey(k)) return k;
    }

    return null;
  }

  // Update all play button states to reflect the current playing state
  updatePlayButtonStates() {
    tableManager.table.markPlaying();
    infoModal.updateModalPlayButton();
  }

  // updateModalPlayButton moved to InfoModal

  // Ensure the audio player is visible in the UI
  ensureVisible() {
    const wrap = document.getElementById("playerWrap");
    if (wrap && !wrap.classList.contains("show")) {
      wrap.classList.add("show");
      document.body.classList.add("has-player");
    }
  }

  // Build a media URL from a given value
  buildMediaUrl(value) {
    if (!value) return "";

    // If already a URL, rewrite its host if it's animemusicquiz
    if (/^https?:\/\//i.test(value)) {
      return this.rewriteFileHost(value);
    }

    // Treat as filename (.webm, .mp3, etc.)
    const clean = String(value).replace(/^\/+/, "");
    if (clean.includes("..")) return "";

    return `https://${settingsManager.get("fileHost")}.animemusicquiz.com/${encodeURIComponent(clean)}`;
  }

  // Rewrite file host URLs to use configured host
  rewriteFileHost(url) {
    try {
      const u = new URL(url);
      if (u.hostname.endsWith(".animemusicquiz.com")) {
        const parts = u.hostname.split(".");
        parts[0] = settingsManager.get("fileHost");
        u.hostname = parts.join(".");
        return u.toString();
      }
    } catch { }
    return url;
  }

  // Pick the best available media URL from song data
  pickBestUrlFromData(row) {
    if (!row) return "";
    const mp3 = row.audio || "";
    const mq = row.MQ || ""; // 480
    const hq = row.HQ || ""; // 720
    return this.buildMediaUrl(mp3) || this.buildMediaUrl(mq) || this.buildMediaUrl(hq);
  }

  // Get the current order of keys from state (visible songs order)
  getOrderKeys() {
    const songs = appState.getStateSlice("songs");
    return (songs.visible || []).map(r => tableManager.getKeyForRow(r));
  }

  // Resolve the best source URL for a given key using state data
  getBestSourceUrlForKey(key) {
    const songs = appState.getStateSlice("songs");
    const row = (songs.visible || []).find(r => tableManager.getKeyForRow(r) === key) ||
      (songs.raw || []).find(r => tableManager.getKeyForRow(r) === key);
    return this.pickBestUrlFromData(row);
  }

  // Get the current song key
  getCurrentKey() {
    return appState.getStateSlice("audio.currentSongId");
  }

  // Set the current song key
  setCurrentKey(key) {
    // Update global state instead of local state
    appState.updateStateSlice("audio.currentSongId", () => key);
  }

  // Get current playback time in seconds
  getCurrentTime() {
    return this.audio.currentTime;
  }

  // Get total duration of current audio in seconds
  getDuration() {
    return this.audio.duration;
  }

  // Set current playback time in seconds
  setCurrentTime(time) {
    if (Number.isFinite(time) && time >= 0) {
      this.audio.currentTime = time;
    }
  }

  // Get current volume level (0-1)
  getVolume() {
    return this.audio.volume;
  }

  // Set volume level (0-1)
  setVolume(volume) {
    this.audio.volume = Math.max(0, Math.min(1, volume));
  }

  // Check if audio is muted
  isMuted() {
    return this.audio.muted;
  }

  // Set audio mute state
  setMuted(muted) {
    this.audio.muted = muted;
  }

  // Get current time formatted as MM:SS
  getCurrentTimeFormatted() {
    return this.formatTime(this.audio.currentTime);
  }

  // Get duration formatted as MM:SS
  getDurationFormatted() {
    return this.formatTime(this.audio.duration);
  }

  // Format seconds into MM:SS time string
  formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  // Get all available audio sources for a song
  getSongSources(key) {
    const songs = appState.getStateSlice("songs");
    const row = (songs.visible || []).find(r => tableManager.getKeyForRow(r) === key) ||
      (songs.raw || []).find(r => tableManager.getKeyForRow(r) === key);
    if (!row) return { hq: null, mq: null, mp3: null };
    return {
      hq: this.buildMediaUrl(row.HQ || ""),
      mq: this.buildMediaUrl(row.MQ || ""),
      mp3: this.buildMediaUrl(row.audio || "")
    };
  }
}

const audioPlayer = new AudioPlayer();
