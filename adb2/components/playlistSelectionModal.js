class PlaylistSelectionModal {
  constructor() {
    this.$modal = $("#playlistSelectionModal");
    this.$select = $("#playlistSelection");
    this.$newPlaylistName = $("#newPlaylistName");
    this.$btnAddToPlaylist = $("#btnAddToPlaylist");
    this.$btnCreateAndAdd = $("#btnCreateAndAdd");
    this.wireEvents();
  }

  show(songData) {
    // Populate song info
    const $songInfo = this.$modal.find(".song-info");
    const anime = tableManager.getAnimeTitle(songData);
    const songName = songData.songName || "";
    const artist = songData.songArtist || "";
    $songInfo.empty();
    $songInfo.append($("<div>", { class: "fw-bold", text: anime }));
    $songInfo.append($("<div>", { class: "text-muted", text: songName + (artist ? " — " + artist : "") }));

    // Populate playlist dropdown
    this.$select.html('<option value="">-- Select a playlist --</option>');
    const playlists = playlistManager.loadAllPlaylists();
    Object.entries(playlists).forEach(([id, playlist]) => {
      const $option = $("<option>", { value: id, text: `${playlist.name} (${playlist.songCount} songs)` });
      this.$select.append($option);
    });
    
    // Restore last selected playlist
    if (playlistManager.lastSelectedPlaylistId && playlists[playlistManager.lastSelectedPlaylistId]) {
      this.$select.val(playlistManager.lastSelectedPlaylistId);
      this.$btnAddToPlaylist.prop("disabled", false);
    }

    // Store song data for later use
    this.$modal.data("songData", JSON.stringify(songData));

    // Show modal
    this.$modal.modal("show");
  }

  hide() {
    this.$modal.modal("hide");
  }

  wireEvents() {
    // Selection change enables Add button and remembers last selection
    this.$select.on("change", (e) => {
      const selected = $(e.currentTarget).val();
      this.$btnAddToPlaylist.prop("disabled", !selected);
      playlistManager.lastSelectedPlaylistId = selected;
    });

    // Add to existing playlist
    this.$btnAddToPlaylist.on("click", () => {
      const selectedPlaylistId = this.$select.val();
      if (!selectedPlaylistId) return;
      const songData = JSON.parse(this.$modal.data("songData") || "{}");
      playlistManager.addSongToPlaylist(selectedPlaylistId, songData);
    });

    // Create new playlist and add the song
    this.$btnCreateAndAdd.on("click", () => {
      const newPlaylistName = this.$newPlaylistName.val().trim();
      if (!newPlaylistName) {
        showAlert("Please enter a playlist name", "warning");
        return;
      }
      const songData = JSON.parse(this.$modal.data("songData") || "{}");
      const playlistId = playlistManager.savePlaylist(newPlaylistName, [songData.annSongId]);
      this.hide();
      this.$newPlaylistName.val("");
      showAlert(`Song added to new playlist "${newPlaylistName}"`, "success");
    });
  }
}

const playlistSelectionModal = new PlaylistSelectionModal();
