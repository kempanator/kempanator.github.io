class PlaylistManager {
  // Initialize playlist manager with storage key and load existing playlists
  constructor() {
    this.storageKey = PLAYLIST_STORAGE_KEY;
    this.autoAddPlaylistId = null;
    this.lastSelectedPlaylistId = "";
    this.playlists = this.loadAllPlaylists();

    // Listen for events from EventBus
    eventBus.on("playlist:add-song", (data) => {
      const songs = appState.getStateSlice("songs");
      const songData = songs.visible.find(r => tableManager.rowKey(r) === data.songId) ||
        songs.raw.find(r => tableManager.rowKey(r) === data.songId);

      if (!songData || !songData.annSongId) {
        showAlert("Cannot add song to playlist - missing ANN Song ID", "warning");
        return;
      }

      // Check for auto-add playlists first
      const autoAddPlaylist = this.getAutoAddPlaylist();
      if (autoAddPlaylist) {
        console.log(songData)
        this.toggleSongInPlaylist(autoAddPlaylist.id, songData, data.target);
        return;
      }

      playlistSelectionModal.show(songData);
    });
  }

  // Create and save a new playlist with the given name and song IDs
  savePlaylist(name, annSongIds) {
    const playlists = this.loadAllPlaylists();
    const playlistId = `playlist_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    const playlist = {
      name: name,
      annSongIds: annSongIds,
      songCount: annSongIds.length,
      createdAt: new Date().toISOString()
    };

    playlists[playlistId] = playlist;
    localStorage.setItem(this.storageKey, JSON.stringify(playlists));

    // Update internal state
    this.playlists = playlists;

    return playlistId;
  }

  // Replace a playlist's contents with current table data
  replacePlaylist(playlistId) {
    const playlists = this.loadAllPlaylists();
    const playlist = playlists[playlistId];

    if (!playlist) {
      showAlert("Playlist not found", "error");
      return;
    }

    // Get current table data
    const songs = appState.getStateSlice("songs");
    const annSongIds = songs.visible.map(row => row.annSongId).filter(Boolean);

    if (annSongIds.length === 0) {
      showAlert("No valid songs in current table to save", "warning");
      return;
    }

    // Update playlist with new data
    playlist.annSongIds = annSongIds;
    playlist.songCount = annSongIds.length;
    playlist.updatedAt = new Date().toISOString();

    // Save updated playlist
    localStorage.setItem(this.storageKey, JSON.stringify(playlists));

    // Update internal state
    this.playlists = playlists;

    // Re-render playlist list to show updated count
    playlistModal.renderPlaylistList();

    showAlert(`Playlist "${playlist.name}" replaced with ${annSongIds.length} songs`, "success");
  }

  // Load all playlists from localStorage and return as object
  loadAllPlaylists() {
    return JSON.parse(localStorage.getItem(this.storageKey) || "{}");
  }

  // Load a specific playlist by ID from localStorage
  loadPlaylist(playlistId) {
    const playlists = this.loadAllPlaylists();
    return playlists[playlistId] || null;
  }

  // Delete a playlist by ID and clear auto-add state if needed
  deletePlaylist(playlistId) {
    const playlists = this.loadAllPlaylists();
    delete playlists[playlistId];
    localStorage.setItem(this.storageKey, JSON.stringify(playlists));

    // If the deleted playlist was the auto-add playlist, clear the auto-add state
    if (this.autoAddPlaylistId === playlistId) {
      this.autoAddPlaylistId = null;
    }

    // Update internal state
    this.playlists = playlists;
  }

  // Rename a playlist by ID with the new name
  renamePlaylist(playlistId, newName) {
    const playlists = this.loadAllPlaylists();
    if (playlists[playlistId]) {
      playlists[playlistId].name = newName;
      localStorage.setItem(this.storageKey, JSON.stringify(playlists));

      // Update internal state
      this.playlists = playlists;
    }
  }

  // Add a song to a playlist and show success message
  addSongToPlaylist(playlistId, songData) {
    const playlists = this.loadAllPlaylists();
    const playlist = playlists[playlistId];

    if (!playlist) {
      showAlert("Playlist not found", "error");
      return;
    }

    // Check if song is already in playlist
    if (playlist.annSongIds.includes(songData.annSongId)) {
      showAlert("Song is already in this playlist", "warning");
      return;
    }

    // Add song to playlist
    playlist.annSongIds.push(songData.annSongId);
    playlist.songCount = playlist.annSongIds.length;

    // Save updated playlist
    localStorage.setItem(this.storageKey, JSON.stringify(playlists));

    // Update internal state
    this.playlists = playlists;

    // Only refresh row indicators globally if auto-add is enabled for this playlist
    if (this.autoAddPlaylistId === playlistId) {
      tableManager.table.markExistingInPlaylist(playlistId);
    }

    // Close modal and show success
    playlistSelectionModal.hide();
    showAlert(`Song added to playlist "${playlist.name}"`, "success");
  }

  // Toggle a song in/out of a playlist and update button styling
  toggleSongInPlaylist(playlistId, songData, buttonElement) {
    const playlists = this.loadAllPlaylists();
    const playlist = playlists[playlistId];

    if (!playlist) {
      showAlert("Playlist not found", "error");
      return;
    }

    const songIndex = playlist.annSongIds.indexOf(songData.annSongId);

    if (songIndex === -1) {
      // Add song to playlist
      playlist.annSongIds.push(songData.annSongId);
      playlist.songCount = playlist.annSongIds.length;
      showAlert(`Song added to playlist "${playlist.name}"`, "success");

      // Update button styling
      if (buttonElement) {
        buttonElement.classList.add("marked");
      }
    } else {
      // Remove song from playlist
      playlist.annSongIds.splice(songIndex, 1);
      playlist.songCount = playlist.annSongIds.length;
      showAlert(`Song removed from playlist "${playlist.name}"`, "info");

      // Update button styling
      if (buttonElement) {
        buttonElement.classList.remove("marked");
      }
    }

    // Save updated playlist
    localStorage.setItem(this.storageKey, JSON.stringify(playlists));

    // Update internal state
    this.playlists = playlists;

    // Only refresh all row indicators when auto-add is enabled for this playlist
    if (this.autoAddPlaylistId === playlistId) {
      tableManager.table.markExistingInPlaylist(playlistId);
    }
  }

  // Get the currently active auto-add playlist or null if none
  getAutoAddPlaylist() {
    if (!this.autoAddPlaylistId) return null;
    const playlists = this.loadAllPlaylists();
    const playlist = playlists[this.autoAddPlaylistId];
    return playlist ? { id: this.autoAddPlaylistId, ...playlist } : null;
  }

  // Toggle auto-add functionality for a specific playlist
  toggleAutoAddPlaylist(playlistId) {
    const playlists = this.loadAllPlaylists();
    const playlist = playlists[playlistId];

    if (!playlist) return;

    if (this.autoAddPlaylistId === playlistId) {
      this.autoAddPlaylistId = null;
      showAlert(`Auto-add disabled for "${playlist.name}"`, "info");
      tableManager.table.resetPlaylistIndicators();
    } else {
      this.autoAddPlaylistId = playlistId;
      showAlert(`Auto-add enabled for "${playlist.name}"`, "success");
      tableManager.table.markExistingInPlaylist(playlistId);
    }

    playlistModal.renderPlaylistList();
  }

  // Filter delegates
  filterPlaylists(searchTerm) {
    playlistModal.filterPlaylists(searchTerm);
  }

  // Load a playlist's songs into the table by fetching song data in chunks
  loadPlaylistIntoTable(playlistId) {
    const playlist = this.loadPlaylist(playlistId);
    if (!playlist) {
      showAlert("Playlist not found", "error");
      return;
    }

    // Get all songs from the playlist
    const allResults = [];
    const chunkSize = 500; // Process in chunks to avoid overwhelming the API
    const chunks = [];

    for (let i = 0; i < playlist.annSongIds.length; i += chunkSize) {
      chunks.push(playlist.annSongIds.slice(i, i + chunkSize));
    }

    if (chunks.length === 0) {
      showAlert("Playlist is empty", "warning");
      return;
    }

    // Show loading spinner during playlist loading
    searchManager.setLoading(true);

    // Process chunks sequentially
    const processChunk = (chunkIndex) => {
      if (chunkIndex >= chunks.length) {
        // All chunks processed, show success and stop loading
        searchManager.setLoading(false);
        showAlert(`Loaded ${allResults.length} song${allResults.length === 1 ? "" : "s"} from playlist "${playlist.name}"`, "success");
        return;
      }

      const chunk = chunks[chunkIndex];
      const body = {
        ann_song_ids: chunk
      };

      searchManager.postJson(`${API_BASE}/api/ann_song_ids_request`, body)
        .then(data => {
          allResults.push(...data);

          // Load first chunk into table, append subsequent chunks
          if (chunkIndex === 0) {
            tableManager.loadData(allResults);
          } else {
            tableManager.appendData(data);
          }

          // Process next chunk
          processChunk(chunkIndex + 1);
        })
        .catch(err => {
          showAlert(`Failed to load chunk ${chunkIndex + 1}/${chunks.length}: ${err.message || err}`, "danger");
          searchManager.onFetchError(err);
          searchManager.setLoading(false);
        });
    };

    // Start processing chunks
    processChunk(0);
  }

  // Export a single playlist as JSON file with playlist metadata
  exportPlaylist(playlistId) {
    const playlist = this.loadPlaylist(playlistId);
    if (!playlist) {
      showAlert("Playlist not found", "error");
      return;
    }

    // Create export data with playlist info
    const exportData = {
      type: "playlist",
      data: {
        [playlistId]: playlist
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const filename = `${playlist.name.replace(/[^a-z0-9 _.-]+/gi, "")}_playlist.json`;
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    showAlert(`Playlist "${playlist.name}" exported successfully`, "success");
  }

  // Export all playlists as a single JSON file with metadata
  exportAllPlaylists() {
    const playlists = this.loadAllPlaylists();
    if (Object.keys(playlists).length === 0) {
      showAlert("No playlists to export", "warning");
      return;
    }

    // Create export data with all playlists
    const exportData = {
      type: "playlists",
      data: playlists
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const filename = `adb2_playlists_${new Date().toISOString().slice(0, 10)}.json`;
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    showAlert(`Exported ${Object.keys(playlists).length} playlists successfully`, "success");
  }

  // Delete all playlists after user confirmation
  deleteAllPlaylists() {
    if (confirm("Are you sure you want to delete all playlists? This action cannot be undone.")) {
      localStorage.removeItem(this.storageKey);
      this.playlists = {};
      this.autoAddPlaylistId = null;
      this.renderPlaylistList();
      showAlert("All playlists have been deleted", "success");
    }
  }
}

const playlistManager = new PlaylistManager();
