const AWS = require('aws-sdk');
const { PassThrough } = require('stream');
const logger = require('../utils/logger');

class S3Service {
  constructor() {
    AWS.config.update({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
    });

    this.s3 = new AWS.S3();
    this.bucket = process.env.AWS_S3_BUCKET_NAME;
  }

  /**
   * رفع ملف إلى S3
   */
  async uploadFile(stream, options) {
    const {
      from,
      mediaId,
      timestamp,
      mimeType,
      fileExtension,
      messageId
    } = options;

    // إنشاء مسار الملف: whatsapp/{phone}/{year}/{month}/{day}/{media-id}-{timestamp}.ext
    const date = new Date(parseInt(timestamp) * 1000);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');

    const fileName = `${mediaId}-${timestamp}`;
    const key = `whatsapp/${from}/${year}/${month}/${day}/${fileName}.${fileExtension}`;

    // تحضير Metadata
    const metadata = {
      from: from,
      message_id: messageId,
      timestamp: timestamp,
      mime_type: mimeType,
      uploaded_at: new Date().toISOString()
    };

    // استخدام PassThrough لتدفق البيانات مع إمكانية قراءة متعددة إذا لزم الأمر
    const passThrough = new PassThrough();
    stream.pipe(passThrough);

    const params = {
      Bucket: this.bucket,
      Key: key,
      Body: passThrough,
      ContentType: mimeType,
      Metadata: metadata,
      ACL: 'private' // أو 'public-read' حسب الحاجة
    };

    try {
      logger.info(`Uploading to S3: ${key}`);

      const result = await this.s3.upload(params).promise();
      
      logger.info(`Successfully uploaded to S3: ${result.Location}`);
      
      return {
        key: result.Key,
        location: result.Location,
        bucket: result.Bucket,
        metadata
      };

    } catch (error) {
      logger.error('S3 upload failed:', error);
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  /**
   * التحقق من وجود ملف مكرر
   */
  async checkDuplicate(mediaId, from) {
    try {
      // البحث عن ملف بنفس mediaId
      const params = {
        Bucket: this.bucket,
        Prefix: `whatsapp/${from}/`,
        MaxKeys: 1000
      };

      const data = await this.s3.listObjectsV2(params).promise();
      
      const duplicate = data.Contents.find(item => 
        item.Key.includes(mediaId)
      );

      if (duplicate) {
        logger.info(`Duplicate found: ${duplicate.Key}`);
        return duplicate.Key;
      }

      return null;

    } catch (error) {
      logger.error('Duplicate check failed:', error);
      return null; // لا نمنع العملية في حالة فشل التحقق
    }
  }
}

module.exports = new S3Service();
