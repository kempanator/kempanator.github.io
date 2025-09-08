class StatsModal {
  constructor() {
    this.charts = {};
    this.hasLoaded = false;
    this.latestStats = null;

    // Store jQuery references
    this.$btnStats = $("#btnStats");
    this.$btnRetryStats = $("#btnRetryStats");
    this.$statsModal = $("#statsModal");
    this.$statsLoading = $("#statsLoading");
    this.$statsError = $("#statsError");
    this.$statsContent = $("#statsContent");
    this.$chartsView = $("#chartsView");
    this.$totalSongs = $("#totalSongs");
    this.$totalAnime = $("#totalAnime");
    this.$totalArtists = $("#totalArtists");
    this.$totalSeasons = $("#totalSeasons");
    this.$avgDifficulty = $("#avgDifficulty");
    this.$avgSongLength = $("#avgSongLength");
    this.$topArtistsNumbers = $("#topArtistsNumbers");
    this.$topAnimeNumbers = $("#topAnimeNumbers");
    this.$btnSongTypesToggle = $("#btnSongTypesToggle");
    this.$songTypesNumbersInline = $("#songTypesNumbersInline");
    this.$btnSongCategoriesToggle = $("#btnSongCategoriesToggle");
    this.$songCategoriesNumbersInline = $("#songCategoriesNumbersInline");
    this.$btnBroadcastTypesToggle = $("#btnBroadcastTypesToggle");
    this.$broadcastTypesNumbersInline = $("#broadcastTypesNumbersInline");
    this.$btnAnimeTypesToggle = $("#btnAnimeTypesToggle");
    this.$animeTypesNumbersInline = $("#animeTypesNumbersInline");

    this.wireEvents();
  }

  formatNumber(num) {
    return new Intl.NumberFormat().format(num);
  }

  wireEvents() {
    // Open/Retry
    this.$btnStats.on("click", () => this.loadStats());
    this.$btnRetryStats.on("click", () => this.loadStats());

    // Song Types per-card toggle
    this.$btnSongTypesToggle.on("click", () => this.toggleSongTypesCard());

    // Other per-card toggles
    this.$btnSongCategoriesToggle.on("click", () => this.toggleSongCategoriesCard());
    this.$btnBroadcastTypesToggle.on("click", () => this.toggleBroadcastTypesCard());
    this.$btnAnimeTypesToggle.on("click", () => this.toggleAnimeTypesCard());

    // Auto-load when modal shown
    this.$statsModal.on("shown.bs.modal", () => this.loadStats());
  }

  createChart(canvasId, data, options = {}) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    if (this.charts[canvasId]) {
      this.charts[canvasId].destroy();
    }

    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { usePointStyle: true, padding: 15 } }
      }
    };

    this.charts[canvasId] = new Chart(ctx, { type: "doughnut", data, options: { ...defaultOptions, ...options } });
    return this.charts[canvasId];
  }

  createSongTypesChart(data) {
    const order = ["Opening", "Ending", "Insert"];
    const orderedData = order.map(key => data.songs_by_type[key] || 0);
    const chartData = { labels: order, datasets: [{ data: orderedData, backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56"], borderWidth: 2, borderColor: "#fff" }] };
    return this.createChart("songTypesChart", chartData, {
      plugins: { tooltip: { callbacks: { label: (ctx) => { const total = ctx.dataset.data.reduce((a, b) => a + b, 0); const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : "0.0"; return `${ctx.label}: ${this.formatNumber(ctx.parsed)} (${pct}%)`; } } } }
    });
  }

  createAnimeTypesChart(data) {
    const order = ["TV", "Movie", "OVA", "ONA", "Special"];
    const orderedData = order.map(key => data.songs_by_anime_type[key] || 0);
    const chartData = { labels: order, datasets: [{ data: orderedData, backgroundColor: ["#8BC34A", "#E91E63", "#9C27B0", "#00BCD4", "#FFC107"], borderWidth: 2, borderColor: "#fff" }] };
    return this.createChart("animeTypesChart", chartData, {
      plugins: { tooltip: { callbacks: { label: (ctx) => { const total = ctx.dataset.data.reduce((a, b) => a + b, 0); const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : "0.0"; return `${ctx.label}: ${this.formatNumber(ctx.parsed)} (${pct}%)`; } } } }
    });
  }

  createSongCategoriesChart(data) {
    const order = ["Standard", "Character", "Chanting", "Instrumental"];
    const orderedData = order.map(key => data.songs_by_category[key] || 0);
    const chartData = { labels: order, datasets: [{ data: orderedData, backgroundColor: ["#4BC0C0", "#FF9F40", "#9966FF", "#FF6384"], borderWidth: 2, borderColor: "#fff" }] };
    return this.createChart("songCategoriesChart", chartData, {
      plugins: { tooltip: { callbacks: { label: (ctx) => { const total = ctx.dataset.data.reduce((a, b) => a + b, 0); const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : "0.0"; return `${ctx.label}: ${this.formatNumber(ctx.parsed)} (${pct}%)`; } } } }
    });
  }

  createBroadcastTypesChart(data) {
    const order = ["Normal", "Dub", "Rebroadcast"];
    const orderedData = order.map(key => data.songs_by_broadcast[key] || 0);
    const chartData = { labels: order, datasets: [{ data: orderedData, backgroundColor: ["#36A2EB", "#FFCE56", "#4BC0C0"], borderWidth: 2, borderColor: "#fff" }] };
    return this.createChart("broadcastTypesChart", chartData, {
      plugins: { tooltip: { callbacks: { label: (ctx) => { const total = ctx.dataset.data.reduce((a, b) => a + b, 0); const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : "0.0"; return `${ctx.label}: ${this.formatNumber(ctx.parsed)} (${pct}%)`; } } } }
    });
  }

  // Song Links chart removed

  createVintageChart(data) {
    const yearCounts = {};
    Object.entries(data.vintage_distribution).forEach(([vintage, count]) => {
      if (vintage === "Unknown") return;
      const yearMatch = vintage.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) { const year = yearMatch[0]; yearCounts[year] = (yearCounts[year] || 0) + count; }
    });
    const sortedYears = Object.keys(yearCounts).sort((a, b) => parseInt(a) - parseInt(b));
    const values = sortedYears.map(y => yearCounts[y]);
    const chartData = { labels: sortedYears, datasets: [{ data: values, backgroundColor: "#36A2EB", borderColor: "#2196F3", borderWidth: 1 }] };

    const ctx = document.getElementById("vintageChart");
    if (!ctx) return null;
    if (this.charts["vintageChart"]) this.charts["vintageChart"].destroy();
    this.charts["vintageChart"] = new Chart(ctx, {
      type: "bar", data: chartData,
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => { const total = ctx.dataset.data.reduce((a, b) => a + b, 0); const pct = total > 0 ? ((ctx.parsed.y / total) * 100).toFixed(1) : "0.0"; return `${ctx.label}: ${this.formatNumber(ctx.parsed.y)} songs (${pct}%)`; } } } },
        scales: { x: { title: { display: true, text: "Year" } }, y: { beginAtZero: true, title: { display: true, text: "Number of Songs" }, ticks: { callback: (v) => new Intl.NumberFormat().format(v) } } }
      }
    });
    return this.charts["vintageChart"];
  }

  createDifficultyChart(data) {
    const labels = [
      "1-10", "11-20", "21-30", "31-40", "41-50",
      "51-60", "61-70", "71-80", "81-90", "91-100"
    ];
    const values = Array.isArray(data.difficulty_histogram) && data.difficulty_histogram.length === 10
      ? data.difficulty_histogram
      : Array(10).fill(0);

    const chartData = {
      labels,
      datasets: [{
        label: "Songs",
        data: values,
        backgroundColor: "#36A2EB",
        borderColor: "#2196F3",
        borderWidth: 1
      }]
    };

    const ctx = document.getElementById("difficultyChart");
    if (!ctx) return null;
    if (this.charts["difficultyChart"]) this.charts["difficultyChart"].destroy();
    this.charts["difficultyChart"] = new Chart(ctx, {
      type: "bar",
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const count = ctx.parsed.y;
                const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
                return `${this.formatNumber(count)} songs (${pct}%)`;
              }
            }
          }
        },
        scales: {
          x: { title: { display: true, text: "Difficulty Range" } },
          y: {
            beginAtZero: true,
            title: { display: true, text: "Number of Songs" },
            ticks: { callback: (v) => new Intl.NumberFormat().format(v) }
          }
        }
      }
    });
    return this.charts["difficultyChart"];
  }

  // Removed createNumbersView; combined layout uses inline containers

  populateSongTypesNumbersInline(data) {
    const order = ["Opening", "Ending", "Insert"];
    this.$songTypesNumbersInline.empty().append(order.map(type => {
      const count = data.songs_by_type[type] || 0;
      return $("<div>")
        .addClass("list-group-item d-flex justify-content-between align-items-center")
        .append($("<span>").text(type))
        .append($("<span>").addClass("badge bg-primary rounded-pill").text(this.formatNumber(count)));
    }));
  }

  populateSongCategoriesNumbersInline(data) {
    const order = ["Standard", "Character", "Chanting", "Instrumental"];
    this.$songCategoriesNumbersInline.empty().append(order.map(category => {
      const count = data.songs_by_category[category] || 0;
      return $("<div>")
        .addClass("list-group-item d-flex justify-content-between align-items-center")
        .append($("<span>").text(category))
        .append($("<span>").addClass("badge bg-success rounded-pill").text(this.formatNumber(count)));
    }));
  }

  populateBroadcastTypesNumbersInline(data) {
    const order = ["Normal", "Dub", "Rebroadcast"];
    this.$broadcastTypesNumbersInline.empty().append(order.map(type => {
      const count = data.songs_by_broadcast[type] || 0;
      return $("<div>")
        .addClass("list-group-item d-flex justify-content-between align-items-center")
        .append($("<span>").text(type))
        .append($("<span>").addClass("badge bg-warning rounded-pill").text(this.formatNumber(count)));
    }));
  }

  populateAnimeTypesNumbersInline(data) {
    const order = ["TV", "Movie", "OVA", "ONA", "Special"];
    this.$animeTypesNumbersInline.empty().append(order.map(type => {
      const count = data.songs_by_anime_type[type] || 0;
      return $("<div>")
        .addClass("list-group-item d-flex justify-content-between align-items-center")
        .append($("<span>").text(type))
        .append($("<span>").addClass("badge bg-info rounded-pill").text(this.formatNumber(count)));
    }));
  }

  toggleSongTypesCard() {
    const $canvas = $("#songTypesChart");
    const showingChart = this.$songTypesNumbersInline.hasClass("d-none");
    if (showingChart) {
      this.populateSongTypesNumbersInline(this.latestStats);
      $canvas.addClass("d-none");
      this.$songTypesNumbersInline.removeClass("d-none");
      this.$btnSongTypesToggle.find("i").removeClass("fa-list-ol").addClass("fa-chart-pie");
    } else {
      $canvas.removeClass("d-none");
      this.$songTypesNumbersInline.addClass("d-none");
      this.$btnSongTypesToggle.find("i").removeClass("fa-chart-pie").addClass("fa-list-ol");
    }
  }

  toggleSongCategoriesCard() {
    const $canvas = $("#songCategoriesChart");
    const showingChart = this.$songCategoriesNumbersInline.hasClass("d-none");
    if (showingChart) {
      this.populateSongCategoriesNumbersInline(this.latestStats);
      $canvas.addClass("d-none");
      this.$songCategoriesNumbersInline.removeClass("d-none");
      this.$btnSongCategoriesToggle.find("i").removeClass("fa-list-ol").addClass("fa-chart-pie");
    } else {
      $canvas.removeClass("d-none");
      this.$songCategoriesNumbersInline.addClass("d-none");
      this.$btnSongCategoriesToggle.find("i").removeClass("fa-chart-pie").addClass("fa-list-ol");
    }
  }

  toggleBroadcastTypesCard() {
    const $canvas = $("#broadcastTypesChart");
    const showingChart = this.$broadcastTypesNumbersInline.hasClass("d-none");
    if (showingChart) {
      this.populateBroadcastTypesNumbersInline(this.latestStats);
      $canvas.addClass("d-none");
      this.$broadcastTypesNumbersInline.removeClass("d-none");
      this.$btnBroadcastTypesToggle.find("i").removeClass("fa-list-ol").addClass("fa-chart-pie");
    } else {
      $canvas.removeClass("d-none");
      this.$broadcastTypesNumbersInline.addClass("d-none");
      this.$btnBroadcastTypesToggle.find("i").removeClass("fa-chart-pie").addClass("fa-list-ol");
    }
  }

  toggleAnimeTypesCard() {
    const $canvas = $("#animeTypesChart");
    const showingChart = this.$animeTypesNumbersInline.hasClass("d-none");
    if (showingChart) {
      this.populateAnimeTypesNumbersInline(this.latestStats);
      $canvas.addClass("d-none");
      this.$animeTypesNumbersInline.removeClass("d-none");
      this.$btnAnimeTypesToggle.find("i").removeClass("fa-list-ol").addClass("fa-chart-pie");
    } else {
      $canvas.removeClass("d-none");
      this.$animeTypesNumbersInline.addClass("d-none");
      this.$btnAnimeTypesToggle.find("i").removeClass("fa-chart-pie").addClass("fa-list-ol");
    }
  }

  updateStatsDisplay(data) {
    this.latestStats = data;
    this.$totalSongs.text(this.formatNumber(data.total_songs));
    this.$totalAnime.text(this.formatNumber(data.total_anime));
    this.$totalArtists.text(this.formatNumber(data.total_artists));
    this.$totalSeasons.text(this.formatNumber(data.total_seasons));

    this.$avgDifficulty.text(
      Number.isFinite(data.average_difficulty) && data.average_difficulty > 0
        ? data.average_difficulty.toFixed(2)
        : "-"
    );

    const secs = data.average_length_seconds;
    if (Number.isFinite(secs) && secs > 0) {
      const mins = Math.floor(secs / 60);
      const rem = Math.round(secs % 60).toString().padStart(2, "0");
      this.$avgSongLength.text(`${mins}:${rem}`);
    } else {
      this.$avgSongLength.text("-");
    }

    this.createSongTypesChart(data);
    this.createSongCategoriesChart(data);
    this.createBroadcastTypesChart(data);
    this.createAnimeTypesChart(data);
    this.createVintageChart(data);
    this.createDifficultyChart(data);
    // Populate Top lists inline
    this.$topArtistsNumbers.empty().append(data.top_artists.map(({ artist, count }) => {
      return $("<div>")
        .addClass("list-group-item d-flex justify-content-between align-items-center")
        .append($("<span>").addClass("text-truncate me-2").text(artist))
        .append($("<span>").addClass("badge bg-primary rounded-pill").text(this.formatNumber(count)));
    }));
    this.$topAnimeNumbers.empty().append(data.top_anime.map(({ anime, count }) => {
      return $("<div>")
        .addClass("list-group-item d-flex justify-content-between align-items-center")
        .append($("<span>").addClass("text-truncate me-2").text(anime))
        .append($("<span>").addClass("badge bg-success rounded-pill").text(this.formatNumber(count)));
    }));
  }

  loadStats() {
    this.$statsLoading.removeClass("d-none");
    this.$statsError.addClass("d-none");
    this.$statsContent.addClass("d-none");

    try {
      const data = statsManager.calculateStats();
      this.hasLoaded = true;
      this.$statsLoading.addClass("d-none");
      this.showContent();
      this.updateStatsDisplay(data);
    } catch (error) {
      this.$statsLoading.addClass("d-none");
      this.$statsError.removeClass("d-none");
      console.error("Statistics calculation failed:", error);
    }
  }

  showContent() {
    this.$statsContent.removeClass("d-none");
  }

  // Removed toggleView; combined layout only
}

const statsModal = new StatsModal();
