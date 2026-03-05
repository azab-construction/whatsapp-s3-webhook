const logger = require('../utils/logger');
const transcriptionService = require('./transcriptionService');
const whatsappService = require('./whatsappService');

class RetryService {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.maxRetries = 3;
  }

  /**
   * إضافة مهمة تحويل فاشلة لقائمة إعادة المحاولة
   */
  addToRetryQueue(task) {
    task.retryCount = task.retryCount || 0;
    task.nextRetry = Date.now() + (this.getBackoffTime(task.retryCount));
    
    this.queue.push(task);
    logger.info(`📋 إضافة مهمة لقائمة إعادة المحاولة: ${task.mediaId}, المحاولة ${task.retryCount + 1}`);
    
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * معالجة قائمة إعادة المحاولة
   */
  async processQueue() {
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const readyTasks = this.queue.filter(task => task.nextRetry <= now);

      if (readyTasks.length === 0) {
        // لا توجد مهام جاهزة، ننتظر أقرب مهمة
        const nextTaskTime = Math.min(...this.queue.map(t => t.nextRetry));
        await this.sleep(nextTaskTime - now);
        continue;
      }

      // إزالة المهام الجاهزة من القائمة
      this.queue = this.queue.filter(task => task.nextRetry > now);

      // معالجة كل مهمة جاهزة
      for (const task of readyTasks) {
        try {
          logger.info(`🔄 إعادة محاولة تحويل الصوت: ${task.mediaId}`);

          // محاولة تحويل الصوت مجدداً
          const transcription = await transcriptionService.transcribeAudio(
            task.audioStream,
            task.options
          );

          // إرسال النتيجة للعميل
          await whatsappService.sendNotification(
            task.options.from,
            `📝 **النص المستخرج من رسالتك الصوتية (محاولة ناجحة):**\n\n${transcription.text}`
          );

          logger.info(`✅ نجحت إعادة المحاولة: ${task.mediaId}`);

        } catch (error) {
          task.retryCount++;

          if (task.retryCount < this.maxRetries) {
            // إعادة الجدولة للمحاولة التالية
            task.nextRetry = Date.now() + this.getBackoffTime(task.retryCount);
            this.queue.push(task);
            
            logger.warn(`⏳ إعادة جدولة: ${task.mediaId}, محاولة ${task.retryCount + 1}`);
          } else {
            // فشل نهائي
            logger.error(`❌ فشل نهائي لتحويل الصوت: ${task.mediaId}`);
            
            // إبلاغ العميل
            await whatsappService.sendNotification(
              task.options.from,
              "❌ عذراً، فشل تحويل رسالتك الصوتية بعد عدة محاولات. الرجاء إرسال نص مكتوب."
            );
          }
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * حساب وقت الانتظار التصاعدي
   */
  getBackoffTime(retryCount) {
    const baseDelay = 60000; // دقيقة واحدة
    return baseDelay * Math.pow(2, retryCount);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new RetryService();
