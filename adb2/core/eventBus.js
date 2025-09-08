"use strict";

// Event-driven communication system for the application
class EventBus {
  constructor() {
    this.listeners = new Map();
    this.onceListeners = new Map();
  }

  // Register a persistent event listener
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  // Register a one-time event listener
  once(event, callback) {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, []);
    }
    this.onceListeners.get(event).push(callback);

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  // Remove an event listener
  off(event, callback) {
    // Remove from persistent listeners
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }

    // Remove from once listeners
    const onceListeners = this.onceListeners.get(event);
    if (onceListeners) {
      const index = onceListeners.indexOf(callback);
      if (index > -1) {
        onceListeners.splice(index, 1);
      }
    }
  }

  // Emit an event to all listeners
  emit(event, data) {
    // Emit to persistent listeners
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }

    // Emit to once listeners and remove them
    const onceListeners = this.onceListeners.get(event);
    if (onceListeners) {
      onceListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in once event listener for ${event}:`, error);
        }
      });
      this.onceListeners.delete(event);
    }
  }

  // Clear all listeners for an event
  clear(event) {
    this.listeners.delete(event);
    this.onceListeners.delete(event);
  }

  // Clear all listeners
  clearAll() {
    this.listeners.clear();
    this.onceListeners.clear();
  }

  // Get listener count for debugging
  getListenerCount(event) {
    const persistentCount = this.listeners.get(event)?.length || 0;
    const onceCount = this.onceListeners.get(event)?.length || 0;
    return persistentCount + onceCount;
  }

  // Debug: list all registered events
  debug() {
    console.log("EventBus Debug:");
    console.log("Persistent listeners:", Object.fromEntries(this.listeners));
    console.log("Once listeners:", Object.fromEntries(this.onceListeners));
  }
}

const eventBus = new EventBus();
