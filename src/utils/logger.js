const fs = require('fs');
const path = require('path');

// إنشاء مجلد logs إذا لم يكن موجوداً
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// تنسيق الوقت
const getTimestamp = () => {
  return new Date().toISOString();
};

// كتابة log إلى ملف
const writeToFile = (level, message) => {
  const date = new Date().toISOString().split('T')[0];
  const logFile = path.join(logsDir, `${date}.log`);
  
  const logEntry = `[${getTimestamp()}] [${level}] ${typeof message === 'string' ? message : JSON.stringify(message)}\n`;
  
  fs.appendFile(logFile, logEntry, (err) => {
    if (err) console.error('Failed to write to log file:', err);
  });
};

const logger = {
  info: (message) => {
    console.log(`\x1b[32m[INFO]\x1b[0m ${getTimestamp()} -`, message);
    writeToFile('INFO', message);
  },
  
  error: (message, error) => {
    console.error(`\x1b[31m[ERROR]\x1b[0m ${getTimestamp()} -`, message);
    if (error) {
      console.error(error);
      writeToFile('ERROR', { message, error: error.message, stack: error.stack });
    } else {
      writeToFile('ERROR', message);
    }
  },
  
  warn: (message) => {
    console.warn(`\x1b[33m[WARN]\x1b[0m ${getTimestamp()} -`, message);
    writeToFile('WARN', message);
  },
  
  debug: (message) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`\x1b[34m[DEBUG]\x1b[0m ${getTimestamp()} -`, message);
    }
    writeToFile('DEBUG', message);
  }
};

module.exports = logger;
