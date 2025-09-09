class PlaylistModal {
  constructor() {
    this.$modal = $("#playlistsModal");
    this.$btnSavePlaylist = $("#btnSavePlaylist");
    this.$playlistName = $("#playlistName");
    this.$playlistSearch = $("#playlistSearch");
    this.$playlistList = $("#playlistList");
    this.$noPlaylistsMessage = $("#noPlaylistsMessage");
    this.wireEvents();
  }

  show() {
    this.$modal.modal("show");
  }

  hide() {
    this.$modal.modal("hide");
  }

  wireEvents() {
    // Save current results as playlist
    this.$btnSavePlaylist.on("click", () => {
      const name = $("#playlistName").val().trim();
      if (!name) {
        showAlert("Please enter a playlist name.", "warning");
        return;
      }

      const songs = appState.getStateSlice("songs");
      const annSongIds = songs.visible.map(row => row.annSongId).filter(Boolean);
      if (annSongIds.length === 0) {
        showAlert("No valid songs to save.", "warning");
        return;
      }

      playlistManager.savePlaylist(name, annSongIds);
      this.$playlistName.val("");
      this.renderPlaylistList();
      showAlert(`Playlist "${name}" saved with ${annSongIds.length} songs`, "success");
    });

    // Enter to save
    this.$playlistName.on("keydown", function (e) {
      if (e.key === "Enter") $("#btnSavePlaylist").click();
    });

    // Filter input
    this.$playlistSearch.on("input", function () {
      playlistManager.filterPlaylists(this.value);
    });

    // When playlists modal is shown, render list
    this.$modal.on("shown.bs.modal", () => {
      this.renderPlaylistList();
    });
  }
  // Render the playlist list UI with all playlists and action buttons
  renderPlaylistList() {
    const playlists = playlistManager.loadAllPlaylists();

    if (Object.keys(playlists).length === 0) {
      this.$playlistList.empty();
      this.$noPlaylistsMessage.show();
      return;
    }

    this.$noPlaylistsMessage.hide();

    const playlistCards = Object.entries(playlists)
      .sort(([, a], [, b]) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(([id, playlist]) => {
        const createdAt = new Date(playlist.createdAt);
        const createdStr = createdAt.toLocaleDateString();

        let dateInfo = `Created: ${createdStr}`;
        if (playlist.updatedAt) {
          const updatedAt = new Date(playlist.updatedAt);
          const updatedStr = updatedAt.toLocaleDateString();
          dateInfo = `Created: ${createdStr} • Updated: ${updatedStr}`;
        }

        return `
            <div class="card mb-2 playlist-card" data-playlist-id="${id}">
              <div class="card-body p-3">
                <div class="d-flex justify-content-between align-items-start">
                  <div class="flex-grow-1">
                    <h6 class="card-title mb-1">${escapeHtml(playlist.name)}</h6>
                    <p class="card-text text-muted small mb-2">${playlist.songCount} songs • ${dateInfo}</p>
                    <div class="btn-group btn-group-sm">
                      <button class="btn btn-outline-primary btn-load-playlist" data-playlist-id="${id}" title="Load playlist into table">
                        <i class="fa-solid fa-table me-1"></i>Load
                      </button>
                      <button class="btn btn-outline-info btn-rename-playlist" data-playlist-id="${id}" title="Rename playlist">
                        <i class="fa-solid fa-edit me-1"></i>Rename
                      </button>
                      <button class="btn btn-outline-success btn-replace-playlist" data-playlist-id="${id}" title="Replace playlist with current table contents">
                        <i class="fa-solid fa-arrow-right-arrow-left me-1"></i>Replace
                      </button>
                      <button class="btn btn-outline-secondary btn-export-playlist" data-playlist-id="${id}" title="Export this playlist as JSON">
                        <i class="fa-solid fa-file-export me-1"></i>Export
                      </button>
                      <button class="btn btn-outline-warning btn-auto-add-playlist ${playlistManager.autoAddPlaylistId === id ? "active" : ""}" data-playlist-id="${id}" title="Auto add song to this playlist when action is clicked">
                        <i class="fa-solid fa-magic me-1"></i>Auto Add
                      </button>
                      <button class="btn btn-outline-danger btn-delete-playlist" data-playlist-id="${id}" title="Delete playlist">
                        <i class="fa-solid fa-trash me-1"></i>Delete
                      </button>
      </div>
                  </div>
                </div>
              </div>
            </div>
          `;
      }).join("");

    this.$playlistList.html(playlistCards);

    // Wire up event handlers for the new buttons
    this.$playlistList.find(".btn-load-playlist").on("click", function () {
      const playlistId = this.dataset.playlistId;
      playlistModal.hide();
      playlistManager.loadPlaylistIntoTable(playlistId);
    });

    this.$playlistList.find(".btn-replace-playlist").on("click", function () {
      const playlistId = this.dataset.playlistId;
      const playlist = playlistManager.loadPlaylist(playlistId);
      if (playlist && confirm(`Are you sure you want to replace playlist "${playlist.name}" with the current table contents?`)) {
        playlistManager.replacePlaylist(playlistId);
      }
    });

    this.$playlistList.find(".btn-rename-playlist").on("click", function () {
      const playlistId = this.dataset.playlistId;
      const playlist = playlistManager.loadPlaylist(playlistId);
      if (playlist) {
        const newName = prompt("Enter new playlist name:", playlist.name);
        if (newName && newName.trim() !== playlist.name) {
          playlistManager.renamePlaylist(playlistId, newName.trim());
          playlistModal.renderPlaylistList();
        }
      }
    });

    this.$playlistList.find(".btn-export-playlist").on("click", function () {
      const playlistId = this.dataset.playlistId;
      playlistManager.exportPlaylist(playlistId);
    });

    this.$playlistList.find(".btn-auto-add-playlist").on("click", function () {
      const playlistId = this.dataset.playlistId;
      playlistManager.toggleAutoAddPlaylist(playlistId);
    });

    this.$playlistList.find(".btn-delete-playlist").on("click", function () {
      const playlistId = this.dataset.playlistId;
      const playlist = playlistManager.loadPlaylist(playlistId);
      if (playlist && confirm(`Are you sure you want to delete playlist "${playlist.name}"?`)) {
        playlistManager.deletePlaylist(playlistId);
        playlistModal.renderPlaylistList();
      }
    });
  }

  // Filter playlist cards based on search term in playlist names
  filterPlaylists(searchTerm) {
    const $cards = this.$playlistList.find(".playlist-card");
    const lowerSearch = searchTerm.toLowerCase();
    $cards.each(function () {
      const $card = $(this);
      const title = $card.find(".card-title").text().toLowerCase();
      $card.toggle(title.includes(lowerSearch));
    });
  }
}

const playlistModal = new PlaylistModal();
