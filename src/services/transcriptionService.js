const { OpenAI } = require('openai');
const AWS = require('aws-sdk');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { PassThrough } = require('stream');
const logger = require('../utils/logger');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

class TranscriptionService {
  constructor() {
    this.openai = process.env.OPENAI_API_KEY 
      ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      : null;
    
    this.s3 = new AWS.S3();
    this.bucket = process.env.AWS_S3_BUCKET_NAME;
    
    // دعم اللغات
    this.supportedLanguages = {
      'ar': 'arabic',
      'en': 'english',
      'fr': 'french',
      'es': 'spanish'
    };
  }

  /**
   * تحويل الملف الصوتي إلى نص
   */
  async transcribeAudio(audioStream, options) {
    const {
      mediaId,
      from,
      mimeType,
      language = 'ar' // العربية افتراضياً
    } = options;

    try {
      logger.info(`بدء تحويل الصوت إلى نص: ${mediaId}, اللغة: ${language}`);

      // 1. تحويل الصوت إلى التنسيق المناسب إذا لزم الأمر
      const processedAudio = await this.prepareAudioForTranscription(audioStream, mimeType);

      // 2. اختيار خدمة التحويل حسب المتاح
      let transcription;

      if (this.openai) {
        transcription = await this.transcribeWithWhisper(processedAudio, language);
      } else {
        // استخدام AWS Transcribe كبديل
        transcription = await this.transcribeWithAWS(processedAudio, mediaId, language);
      }

      // 3. حفظ النص المستخرج في S3
      const transcriptResult = await this.saveTranscriptionToS3({
        text: transcription.text,
        confidence: transcription.confidence,
        language,
        mediaId,
        from,
        duration: transcription.duration,
        words: transcription.words // تفصيل الكلمات مع التوقيت
      });

      logger.info(`✅ اكتمل تحويل الصوت: ${mediaId}`);
      
      return {
        text: transcription.text,
        s3Location: transcriptResult.location,
        confidence: transcription.confidence,
        duration: transcription.duration
      };

    } catch (error) {
      logger.error(`فشل تحويل الصوت ${mediaId}:`, error);
      throw error;
    }
  }

  /**
   * تحويل الصوت باستخدام OpenAI Whisper
   */
  async transcribeWithWhisper(audioBuffer, language) {
    try {
      // إنشاء ملف مؤقت للرفع
      const tempFile = path.join('/tmp', `audio-${Date.now()}.mp3`);
      fs.writeFileSync(tempFile, audioBuffer);

      // رفع الملف إلى Whisper API
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFile),
        model: 'whisper-1',
        language: language,
        response_format: 'verbose_json', // للحصول على تفاصيل أكثر
        temperature: 0.2
      });

      // تنظيف الملف المؤقت
      fs.unlinkSync(tempFile);

      return {
        text: transcription.text,
        confidence: 0.95, // Whisper لا يعطي ثقة، نستخدم قيمة افتراضية
        duration: transcription.duration,
        words: transcription.words || []
      };

    } catch (error) {
      logger.error('Whisper transcription failed:', error);
      throw error;
    }
  }

  /**
   * تحويل الصوت باستخدام AWS Transcribe
   */
  async transcribeWithAWS(audioBuffer, mediaId, language) {
    const transcribe = new AWS.TranscribeService();
    
    // رفع الملف الصوتي مؤقتاً إلى S3 للمعالجة
    const audioKey = `temp/audio/${mediaId}-${Date.now()}.mp3`;
    
    await this.s3.putObject({
      Bucket: this.bucket,
      Key: audioKey,
      Body: audioBuffer,
      ContentType: 'audio/mpeg'
    }).promise();

    const jobName = `transcribe-${mediaId}-${Date.now()}`;
    
    // بدء مهمة التحويل
    await transcribe.startTranscriptionJob({
      TranscriptionJobName: jobName,
      LanguageCode: this.mapLanguageCode(language),
      MediaFormat: 'mp3',
      Media: {
        MediaFileUri: `s3://${this.bucket}/${audioKey}`
      },
      OutputBucketName: this.bucket,
      OutputKey: `transcripts/${mediaId}/`,
      Settings: {
        ShowSpeakerLabels: true,
        MaxSpeakerLabels: 2,
        ShowAlternatives: true,
        MaxAlternatives: 3
      }
    }).promise();

    // انتظار اكتمال المهمة (مع polling)
    let jobCompleted = false;
    let attempts = 0;
    const maxAttempts = 30; // 5 دقائق كحد أقصى

    while (!jobCompleted && attempts < maxAttempts) {
      await this.sleep(10000); // انتظار 10 ثواني
  
      const job = await transcribe.getTranscriptionJob({
        TranscriptionJobName: jobName
      }).promise();

      if (job.TranscriptionJob.TranscriptionJobStatus === 'COMPLETED') {
        jobCompleted = true;
        
        // تحميل النتيجة
        const transcriptUrl = job.TranscriptionJob.Transcript.TranscriptFileUri;
        const response = await axios.get(transcriptUrl);
        
        // تنظيف الملفات المؤقتة
        await this.s3.deleteObject({
          Bucket: this.bucket,
          Key: audioKey
        }).promise();

        return {
          text: response.data.results.transcripts[0].transcript,
          confidence: response.data.results.items.reduce((acc, item) => 
            acc + (item.alternatives[0].confidence || 0), 0) / response.data.results.items.length,
          duration: response.data.results.audio_segments?.duration || 0,
          words: response.data.results.items.map(item => ({
            word: item.alternatives[0].content,
            start_time: item.start_time,
            end_time: item.end_time,
            confidence: item.alternatives[0].confidence
          }))
        };
      }
      
      attempts++;
    }

    throw new Error('Timeout waiting for transcription job');

  } catch (error) {
    logger.error('AWS Transcribe failed:', error);
    throw error;
  }

  /**
   * تجهيز الصوت للتحويل (تحويل التنسيق، ضبط الجودة)
   */
  async prepareAudioForTranscription(audioStream, mimeType) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      const passThrough = new PassThrough();
      
      audioStream.pipe(passThrough);
      
      passThrough.on('data', chunk => chunks.push(chunk));
      passThrough.on('end', async () => {
        const audioBuffer = Buffer.concat(chunks);
        
        // إذا كان التنسيق غير مدعوم، نحوله
        if (!mimeType.includes('mp3') && !mimeType.includes('mpeg')) {
          try {
            const convertedBuffer = await this.convertAudioFormat(audioBuffer);
            resolve(convertedBuffer);
          } catch (error) {
            logger.warn('فشل تحويل الصوت، استخدام التنسيق الأصلي');
            resolve(audioBuffer);
          }
        } else {
          resolve(audioBuffer);
        }
      });
      
      passThrough.on('error', reject);
    });
  }

  /**
   * تحويل تنسيق الصوت إلى MP3
   */
  convertAudioFormat(inputBuffer) {
    return new Promise((resolve, reject) => {
      const inputFile = path.join('/tmp', `input-${Date.now()}.ogg`);
      const outputFile = path.join('/tmp', `output-${Date.now()}.mp3`);
      
      fs.writeFileSync(inputFile, inputBuffer);

      ffmpeg(inputFile)
        .toFormat('mp3')
        .audioBitrate(128)
        .on('end', () => {
          const convertedBuffer = fs.readFileSync(outputFile);
          
          // تنظيف
          fs.unlinkSync(inputFile);
          fs.unlinkSync(outputFile);
          
          resolve(convertedBuffer);
        })
        .on('error', (err) => {
          // تنظيف في حالة الخطأ
          if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
          if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
          
          reject(err);
        })
        .save(outputFile);
    });
  }

  /**
   * حفظ النص المستخرج في S3
   */
  async saveTranscriptionToS3(data) {
    const {
      text,
      confidence,
      language,
      mediaId,
      from,
      duration,
      words
    } = data;

    const date = new Date();
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');

    const key = `whatsapp/${from}/${year}/${month}/${day}/transcripts/${mediaId}-transcript.json`;

    const transcriptData = {
      media_id: mediaId,
      from: from,
      transcribed_at: date.toISOString(),
      language: language,
      confidence: confidence,
      duration_seconds: duration,
      text: text,
      words: words || [],
      metadata: {
        service: this.openai ? 'whisper' : 'aws-transcribe',
        version: '1.0'
      }
    };

    const result = await this.s3.upload({
      Bucket: this.bucket,
      Key: key,
      Body: JSON.stringify(transcriptData, null, 2),
      ContentType: 'application/json',
      Metadata: {
        from: from,
        media_id: mediaId,
        language: language,
        confidence: String(confidence)
      }
    }).promise();

    logger.info(`📝 حفظ النص المستخرج: ${key}`);
    
    return result;
  }

  /**
   * الحصول على النص المستخرج لملف صوتي
   */
  async getTranscription(mediaId, from) {
    try {
      const date = new Date();
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');

      const key = `whatsapp/${from}/${year}/${month}/${day}/transcripts/${mediaId}-transcript.json`;

      const data = await this.s3.getObject({
        Bucket: this.bucket,
        Key: key
      }).promise();

      return JSON.parse(data.Body.toString());

    } catch (error) {
      if (error.code === 'NoSuchKey') {
        return null; // لا يوجد نص بعد
      }
      logger.error('فشل استرجاع النص:', error);
      throw error;
    }
  }

  /**
   * تحويل رمز اللغة إلى صيغة AWS
   */
  mapLanguageCode(language) {
    const mapping = {
      'ar': 'ar-SA',
      'en': 'en-US',
      'fr': 'fr-FR',
      'es': 'es-ES'
    };
    return mapping[language] || 'en-US';
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * التحقق من دعم اللغة
   */
  isLanguageSupported(language) {
    return !!this.supportedLanguages[language];
  }
}

module.exports = new TranscriptionService();
