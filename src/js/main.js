'use strict';

/**
 * Entry point for the Neural Tree Architect.
 */
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Global State
  window.app = new TreeManager();
  app.load();

  // Initialize UI
  UI.init();
  
  console.log("Neural Tree Architect v0.9.0 Initialized");
});
