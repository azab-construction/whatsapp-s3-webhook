const whatsappService = require('../services/whatsappService');
const s3Service = require('../services/s3Service');
const logger = require('../utils/logger');

class WebhookController {
  /**
   * التحقق من webhook (GET request من واتساب)
   */
  verifyWebhook(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    logger.info('Webhook verification request received');

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      logger.info('Webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      logger.error('Webhook verification failed');
      res.sendStatus(403);
    }
  }

  /**
   * معالجة طلبات webhook الرئيسية
   */
  async handleWebhook(req, res) {
    const startTime = Date.now();
    
    try {
      // التحقق من التوقيع (اختياري)
      const signature = req.headers['x-hub-signature-256'];
      if (signature && !whatsappService.verifySignature(signature, req.rawBody)) {
        logger.error('Invalid signature');
        return res.sendStatus(403);
      }

      const { entry } = req.body;

      if (!entry || !Array.isArray(entry)) {
        logger.warn('Invalid webhook payload');
        return res.sendStatus(400);
      }

      // معالجة كل الإدخالات
      const processingPromises = [];

      for (const webhookEntry of entry) {
        const changes = webhookEntry.changes || [];

        for (const change of changes) {
          if (change.field === 'messages') {
            const value = change.value;
            const messages = value.messages || [];

            for (const message of messages) {
              // تجاهل الرسائل النصية العادية
              if (['image', 'video', 'document', 'audio'].includes(message.type)) {
                processingPromises.push(
                  this.processMediaMessage(message, value)
                );
              }
            }
          }
        }
      }

      // انتظار اكتمال جميع المعالجات (مع timeout)
      if (processingPromises.length > 0) {
        await Promise.allSettled(processingPromises);
      }

      const duration = Date.now() - startTime;
      logger.info(`Webhook processed in ${duration}ms`);

      // نرد بـ 200 فوراً حتى لا ينتظر واتساب
      res.sendStatus(200);

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Webhook error after ${duration}ms:`, error);
      
      // حتى في حالة الخطأ، نرد بـ 200 لمنع إعادة الإرسال
      res.sendStatus(200);
    }
  }

  /**
   * معالجة رسالة وسائط محددة
   */
  async processMediaMessage(message, webhookValue) {
    const messageId = message.id;
    const from = message.from;
    const timestamp = message.timestamp;
    const messageType = message.type;
    const mediaInfo = message[messageType];

    try {
      logger.info(`Processing ${messageType} from ${from}, ID: ${messageId}`);

      // 1. التحقق من وجود ملف مكرر
      const duplicate = await s3Service.checkDuplicate(mediaInfo.id, from);
      if (duplicate) {
        logger.info(`Duplicate file detected: ${duplicate}`);
        
        // تسجيل المكرر ولكن نكمل العملية
        logger.info(`Duplicate file: ${mediaInfo.id} already exists at ${duplicate}`);
        
        // يمكن إرسال إشعار بالملف المكرر إذا أردت
        // await whatsappService.sendNotification(from, 'تم استلام هذا الملف مسبقاً');
        
        return { status: 'duplicate', key: duplicate };
      }

      // 2. تحميل الملف من واتساب
      const mediaData = await whatsappService.downloadMedia(mediaInfo.id);

      // 3. رفع الملف إلى S3
      const s3Result = await s3Service.uploadFile(mediaData.stream, {
        from,
        mediaId: mediaInfo.id,
        timestamp,
        mimeType: mediaInfo.mime_type,
        fileExtension: mediaData.fileExtension,
        messageId
      });

      // 4. تسجيل العملية
      logger.info({
        message: 'File processed successfully',
        from,
        messageId,
        mediaId: mediaInfo.id,
        s3Location: s3Result.location,
        mimeType: mediaInfo.mime_type,
        size: mediaData.contentLength
      });

      // 5. إرسال إشعار للعميل (اختياري)
      // await whatsappService.sendNotification(
      //   from,
      //   `✅ تم استلام ملفك بنجاح: ${mediaInfo.mime_type}`
      // );

      return { status: 'success', s3Result };

    } catch (error) {
      logger.error(`Failed to process message ${messageId}:`, error);
      
      // محاولة إشعار العميل بالخطأ
      try {
        await whatsappService.sendNotification(
          from,
          '❌ عذراً، حدث خطأ أثناء معالجة ملفك. الرجاء المحاولة مرة أخرى.'
        );
      } catch (notifyError) {
        // تجاهل خطأ الإشعار
      }

      throw error;
    }
  }
}

module.exports = new WebhookController();
