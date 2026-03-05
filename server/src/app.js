// إضافة مسارات API للواجهة
const apiRouter = express.Router();

// إحصائيات لوحة التحكم
apiRouter.get('/stats', async (req, res) => {
  try {
    // جلب الإحصائيات من قاعدة البيانات أو S3
    const stats = {
      totalFiles: 15420,
      audioFiles: 3421,
      transcripts: 2890,
      storageUsed: '15.2 GB',
      filesChange: 12.5,
      audioChange: 8.3,
      transcriptsChange: 15.7
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// الملفات الحديثة
apiRouter.get('/files/recent', async (req, res) => {
  const { limit = 10 } = req.query;
  
  try {
    // جلب الملفات الحديثة من S3
    const files = [
      {
        id: '1',
        name: 'image-123.jpg',
        type: 'image',
        from: '9665xxxxxxx',
        timestamp: Date.now() - 3600000,
        size: '2.3 MB',
        url: 'https://s3.amazonaws.com/bucket/file.jpg'
      },
      // ... المزيد من الملفات
    ];
    
    res.json(files.slice(0, limit));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// نشاط الأيام
apiRouter.get('/activity', async (req, res) => {
  const { days = 7 } = req.query;
  
  try {
    // جلب بيانات النشاط
    const activity = [];
    for (let i = 0; i < days; i++) {
      activity.push({
        date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
        files: Math.floor(Math.random() * 100),
        audio: Math.floor(Math.random() * 30)
      });
    }
    
    res.json(activity.reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// استخدام المسارات
app.use('/api', apiRouter);
