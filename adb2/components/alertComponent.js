class AlertComponent {
  constructor() {
    this.$alertHost = $("#alertHost");
    this.wireEvents();
  }

  // Wire up UI event listeners
  wireEvents() {
    // Alert events
    eventBus.on("ui:show-alert", (data) => this.showAlert(data.message, data.type));
    eventBus.on("search:submit", () => this.hideAlert());
  }

  // Shows a Bootstrap alert message with the specified type
  showAlert(msg, type = "info") {
    const $alert = $(`
      <div class="alert alert-${type} alert-dismissible" role="alert">
        ${escapeHtml(String(msg))}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `);
    this.$alertHost.empty().append($alert);
  }

  hideAlert() {
    this.$alertHost.empty();
  }
}

const alertComponent = new AlertComponent();
