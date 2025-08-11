import { FurApp } from './src/FurApp.js';

// Initialize the fur application
const app = new FurApp(document.body);

// Handle page unload
window.addEventListener('beforeunload', () => {
  app.dispose();
});

// Expose for quick debugging
window.app = app;