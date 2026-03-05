class Helpers {
  /**
   * تأخير التنفيذ (لإعادة المحاولة)
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * إعادة المحاولة مع تأخير تصاعدي
   */
  async retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (i === maxRetries - 1) break;
        
        const delay = initialDelay * Math.pow(2, i);
        console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * تنسيق الحجم بطريقة مقروءة
   */
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * إنشاء معرف فريد
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * تنظيف رقم الهاتف
   */
  sanitizePhoneNumber(phone) {
    return phone.replace(/\D/g, '');
  }
}

module.exports = new Helpers();
