import React, { useState, useEffect } from 'react';
import { getTranscript, retryTranscription } from '../../services/api';
import { formatDuration } from '../../utils/formatters';
import { toast } from 'react-hot-toast';
import {
  PlayIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';

const TranscriptViewer = ({ mediaId, onClose }) => {
  const [transcript, setTranscript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    loadTranscript();
  }, [mediaId]);

  const loadTranscript = async () => {
    try {
      setLoading(true);
      const data = await getTranscript(mediaId);
      setTranscript(data);
    } catch (error) {
      toast.error('فشل تحميل النص');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    try {
      setRetrying(true);
      await retryTranscription(mediaId);
      toast.success('جاري إعادة تحويل الصوت...');
      setTimeout(loadTranscript, 5000);
    } catch (error) {
      toast.error('فشل إعادة المحاولة');
    } finally {
      setRetrying(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(transcript.text);
    toast.success('تم نسخ النص');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!transcript) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">لا يوجد نص مستخرج لهذا الملف</p>
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="btn-primary inline-flex items-center"
        >
          <ArrowPathIcon className={`w-5 h-5 ml-2 ${retrying ? 'animate-spin' : ''}`} />
          {retrying ? 'جاري المحاولة...' : 'محاولة تحويل الصوت'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* رأس النص */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold mb-1">النص المستخرج</h3>
          <div className="flex items-center space-x-4 space-x-reverse text-sm text-gray-500">
            <span>الدقة: {(transcript.confidence * 100).toFixed(1)}%</span>
            <span>•</span>
            <span>المدة: {formatDuration(transcript.duration_seconds)}</span>
            <span>•</span>
            <span>اللغة: {transcript.language === 'ar' ? 'العربية' : 'الإنجليزية'}</span>
          </div>
        </div>

        <div className="flex items-center space-x-2 space-x-reverse">
          <button
            onClick={copyToClipboard}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            title="نسخ النص"
          >
            <DocumentDuplicateIcon className="w-5 h-5" />
          </button>
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            title="إعادة التحويل"
          >
            <ArrowPathIcon className={`w-5 h-5 ${retrying ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* النص الرئيسي */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <p className="text-lg leading-relaxed">{transcript.text}</p>
      </div>

      {/* تفاصيل الكلمات مع التوقيت */}
      {transcript.words && transcript.words.length > 0 && (
        <div>
          <h4 className="font-medium mb-3">تفاصيل الكلمات</h4>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 max-h-60 overflow-y-auto">
            <div className="space-y-2">
              {transcript.words.map((word, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{word.word}</span>
                  <div className="flex items-center space-x-4 space-x-reverse text-gray-500">
                    <span>{formatDuration(word.start_time)} - {formatDuration(word.end_time)}</span>
                    <span className={`px-2 py-1 rounded ${
                      word.confidence > 0.9 ? 'bg-green-100 text-green-700' :
                      word.confidence > 0.7 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {(word.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* مشغل الصوت */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-center space-x-4 space-x-reverse">
          <button className="p-3 bg-primary-600 text-white rounded-full hover:bg-primary-700">
            <PlayIcon className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="h-2 bg-gray-200 rounded-full">
              <div className="w-0 h-full bg-primary-600 rounded-full"></div>
            </div>
          </div>
          <span className="text-sm text-gray-500">
            0:00 / {formatDuration(transcript.duration_seconds)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TranscriptViewer;
