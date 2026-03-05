const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const webhookController = require('./controllers/webhookController');
const logger = require('./utils/logger');

const app = express();

// Middleware الأساسية
app.use(helmet());
app.use(compression());
app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// تسجيل جميع الطلبات
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url} - ${req.ip}`);
  next();
});

// Route للتحقق من webhook (GET - يستخدمه واتساب للتحقق)
app.get('/webhook', webhookController.verifyWebhook);

// Route الرئيسي لاستقبال الملفات
app.post('/webhook', webhookController.handleWebhook);

// Route للتحقق من صحة الخدمة
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// معالجة الأخطاء
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 للمسارات غير الموجودة
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

module.exports = app;
