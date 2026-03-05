const axios = require('axios');
const logger = require('../utils/logger');

class WhatsAppService {
  constructor() {
    this.baseURL = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}`;
    this.accessToken = process.env.WHATSAPP_TOKEN;
    this.phoneNumberId = process.env.WHATSAPP_BUSINESS_PHONE_NUMBER_ID;
  }

  /**
   * تحميل الملف من واتساب باستخدام Media ID
   */
  async downloadMedia(mediaId) {
    try {
      logger.info(`Starting media download: ${mediaId}`);

      // 1. الحصول على رابط التحميل
      const mediaUrlResponse = await axios.get(
        `${this.baseURL}/${mediaId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      const mediaUrl = mediaUrlResponse.data.url;
      const mimeType = mediaUrlResponse.data.mime_type;
      const fileExtension = this.getFileExtension(mimeType);

      logger.info(`Media URL retrieved: ${mediaUrl}, Type: ${mimeType}`);

      // 2. تحميل الملف (مع دعم streaming للملفات الكبيرة)
      const fileResponse = await axios({
        method: 'GET',
        url: mediaUrl,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        },
        responseType: 'stream',
        maxContentLength: Infinity,
        timeout: 30000 // 30 ثانية
      });

      return {
        stream: fileResponse.data,
        mimeType,
        fileExtension,
        contentLength: fileResponse.headers['content-length']
      };

    } catch (error) {
      logger.error(`Failed to download media ${mediaId}:`, error);
      throw new Error(`WhatsApp download failed: ${error.message}`);
    }
  }

  /**
   * إرسال إشعار للعميل (اختياري)
   */
  async sendNotification(to, message) {
    try {
      const response = await axios.post(
        `${this.baseURL}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
          type: 'text',
          text: { body: message }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`Notification sent to ${to}`);
      return response.data;

    } catch (error) {
      logger.error(`Failed to send notification to ${to}:`, error);
      // لا نرمي الخطأ هنا حتى لا يؤثر على العملية الأساسية
    }
  }

  /**
   * استخراج امتداد الملف من MIME type
   */
  getFileExtension(mimeType) {
    const extensions = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/3gp': '3gp',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'audio/ogg': 'ogg',
      'audio/opus': 'opus',
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'text/plain': 'txt'
    };

    return extensions[mimeType] || 'bin';
  }

  /**
   * التحقق من صحة الطلب باستخدام App Secret
   */
  verifySignature(signature, body) {
    if (!process.env.WHATSAPP_APP_SECRET) {
      logger.warn('App secret not configured, skipping signature verification');
      return true;
    }

    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', process.env.WHATSAPP_APP_SECRET)
        .update(body)
        .digest('hex');

      return signature === `sha256=${expectedSignature}`;
    } catch (error) {
      logger.error('Signature verification failed:', error);
      return false;
    }
  }
}

module.exports = new WhatsAppService();
