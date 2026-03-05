const logger = require('./logger');

class Validator {
  /**
   * التحقق من صحة إعدادات البيئة
   */
  validateEnvironment() {
    const required = [
      'WHATSAPP_TOKEN',
      'WHATSAPP_VERIFY_TOKEN',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'AWS_REGION',
      'AWS_S3_BUCKET_NAME'
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      logger.error(`Missing required environment variables: ${missing.join(', ')}`);
      return false;
    }

    return true;
  }

  /**
   * التحقق من صحة طلب webhook
   */
  validateWebhookPayload(body) {
    if (!body || !body.entry || !Array.isArray(body.entry)) {
      return false;
    }

    // التحقق من وجود عنصر واحد على الأقل صالح
    for (const entry of body.entry) {
      if (entry.changes && Array.isArray(entry.changes)) {
        for (const change of entry.changes) {
          if (change.value && change.value.messages) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * التحقق من نوع الملف المدعوم
   */
  isSupportedMediaType(type) {
    const supported = ['image', 'video', 'document', 'audio'];
    return supported.includes(type);
  }

  /**
   * التحقق من حجم الملف (اختياري)
   */
  isValidFileSize(contentLength, maxSizeMB = 100) {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return contentLength <= maxSizeBytes;
  }
}

module.exports = new Validator();
