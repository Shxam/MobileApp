// ===================================================
// IPL Dhaba Backend — Server Entry Point
// ===================================================

import app from './app';

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`🚀 IPL Dhaba Enterprise Backend Server running on http://localhost:${PORT}`);
  console.log(`⚡ API Health check available at http://localhost:${PORT}/api/v1/health`);
});

// Graceful Shutdown Handlers
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: Closing HTTP server...');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: Closing HTTP server...');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});
