import app from './app';

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server successfully booted on port ${PORT}`);
  console.log(`🌐 Health check available at: http://localhost:${PORT}/health`);
  console.log(`🔧 API Endpoints prefixed with: http://localhost:${PORT}/api`);
});

process.on('SIGTERM', () => {
  console.log('📥 SIGTERM received. Shutting down server gracefully...');
  server.close(() => {
    console.log('🛑 Server closed.');
    process.exit(0);
  });
});
