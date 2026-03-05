import React, { useState, useEffect } from 'react';
import { getDashboardStats, getRecentFiles, getActivityData } from '../services/api';
import StatsCards from '../components/Dashboard/StatsCards';
import RecentFiles from '../components/Dashboard/RecentFiles';
import ActivityChart from '../components/Dashboard/ActivityChart';
import Layout from '../components/Layout/DashboardLayout';
import { toast } from 'react-hot-toast';

const Dashboard = () => {
  const [stats, setStats] = useState({});
  const [recentFiles, setRecentFiles] = useState([]);
  const [activityData, setActivityData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, filesData, activityData] = await Promise.all([
        getDashboardStats(),
        getRecentFiles(10),
        getActivityData(7)
      ]);
      
      setStats(statsData);
      setRecentFiles(filesData);
      setActivityData(activityData);
    } catch (error) {
      toast.error('فشل تحميل بيانات لوحة التحكم');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-500 border-t-transparent"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* الترحيب */}
        <div>
          <h1 className="text-3xl font-bold mb-2">مرحباً بك في لوحة التحكم</h1>
          <p className="text-gray-600">
            نظرة عامة على نشاط webhook واتساب
          </p>
        </div>

        {/* إحصائيات سريعة */}
        <StatsCards stats={stats} />

        {/* الرسم البياني للنشاط */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">النشاط اليومي</h2>
          <ActivityChart data={activityData} />
        </div>

        {/* الملفات الحديثة */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">آخر الملفات المرفوعة</h2>
            <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
              عرض الكل
            </button>
          </div>
          <RecentFiles files={recentFiles} />
        </div>

        {/* معلومات سريعة عن webhook */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card bg-primary-50 border-primary-200">
            <h3 className="font-bold mb-2">حالة webhook</h3>
            <div className="flex items-center space-x-2 space-x-reverse">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm">نشط ويستقبل الطلبات</span>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              آخر طلب: منذ دقيقتين
            </p>
          </div>

          <div className="card bg-green-50 border-green-200">
            <h3 className="font-bold mb-2">اتصال S3</h3>
            <div className="flex items-center space-x-2 space-x-reverse">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm">bucket-name</span>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              المساحة المستخدمة: 2.3 GB
            </p>
          </div>

          <div className="card bg-purple-50 border-purple-200">
            <h3 className="font-bold mb-2">خدمة التحويل الصوتي</h3>
            <div className="flex items-center space-x-2 space-x-reverse">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm">OpenAI Whisper</span>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              متوسط الدقة: 94%
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
