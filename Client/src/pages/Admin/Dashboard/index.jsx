import React from 'react';
import { useQuery } from '@apollo/client';
import { AttachMoney, PersonAdd } from '@mui/icons-material';

import AdminLayout from '../../../components/Admin/AdminLayout';
import { Typography } from '../../../components/UI/Typography';
import { Badge } from '../../../components/UI/Badge';

import { GET_ALL_USERS } from '../../../graphql/queries/user';
import { GET_BOOKS } from '../../../graphql/queries/book';
import { GET_ALL_TRANSACTIONS } from '../../../graphql/queries/transaction';

import './Dashboard.css';

const AdminDashboard = () => {
  const { data: userData } = useQuery(GET_ALL_USERS);
  const { data: bookData } = useQuery(GET_BOOKS);
  const { data: trxData } = useQuery(GET_ALL_TRANSACTIONS);

  const users = userData?.getAllUsers || [];
  const books = bookData?.getAllBooks || [];
  const transactions = trxData?.getAllTransactions || [];

  // Toplam Gelir
  const totalRevenue = transactions
    .filter(t => t.status === 'SUCCESS')
    .reduce((acc, curr) => acc + curr.amount, 0);

  // Son 5 Aktiviteyi Hazırla
  // Gerçek bir "Activity Log" modelimiz olmadığı için, son işlemleri ve kayıtları birleştirip sıralayacağız.
  
  const recentTransactions = transactions.slice(0, 5).map(t => ({
      type: 'DONATION',
      date: t.createdAt,
      data: t
  }));

  const recentUsers = users.slice(0, 5).map(u => ({
      type: 'USER',
      date: u.createdAt || Date.now(), // createdAt yoksa şimdiki zaman (User şemasına createdAt eklemen önerilir)
      data: u
  }));

  // Hepsini birleştir ve tarihe göre sırala
  const activities = [...recentTransactions, ...recentUsers]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 7); // Ekrana sığacak kadar al

  return (
    <AdminLayout title="Dashboard">
      
      {/* İSTATİSTİK KARTLARI */}
      <div className="stats-grid-admin">
        <div className="admin-stat-card">
           <Typography variant="h6" color="muted">Kullanıcılar</Typography>
           <Typography variant="h3" weight="bold" className="text-indigo-600">
             {users.length}
           </Typography>
        </div>
        <div className="admin-stat-card">
           <Typography variant="h6" color="muted">Kitaplar</Typography>
           <Typography variant="h3" weight="bold" className="text-pink-600">
             {books.length}
           </Typography>
        </div>
        <div className="admin-stat-card">
           <Typography variant="h6" color="muted">Toplam Fon</Typography>
           <Typography variant="h3" weight="bold" className="text-green-600">
             ₺{totalRevenue.toLocaleString()}
           </Typography>
        </div>
      </div>

      {/* SON AKTİVİTELER */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Sol Taraf: Geniş Tablo veya Grafik Yeri (Şimdilik boş bırakıyoruz veya başka veri) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200">
            <Typography variant="h5" weight="bold" className="mb-4">Hızlı Bakış</Typography>
            <p className="text-gray-500">
              Sistemde şu an <strong>{books.filter(b => b.status === 'FUNDING').length}</strong> adet fonlanan kitap bulunuyor.
            </p>
            {/* Buraya ileride bir Chart.js grafiği eklenebilir */}
            <div className="h-40 bg-gray-50 mt-4 rounded flex items-center justify-center text-gray-400">
               Grafik Alanı (Geliştirme Aşamasında)
            </div>
        </div>

        {/* Sağ Taraf: Son Aktiviteler Listesi */}
        <div className="bg-white p-6 rounded-xl border border-gray-200">
           <Typography variant="h5" weight="bold" className="mb-6">Son Hareketler</Typography>
           
           <div className="activity-feed">
              {activities.map((act, index) => (
                 <div key={index} className="activity-item">
                    <div className={`activity-icon ${act.type === 'DONATION' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                       {act.type === 'DONATION' ? <AttachMoney fontSize="small"/> : <PersonAdd fontSize="small"/>}
                    </div>
                    <div className="activity-info">
                       <p className="text-sm font-medium text-gray-800">
                          {act.type === 'DONATION' ? (
                             <>
                               <span className="font-bold">{act.data.userId?.username}</span>, 
                               <span className="font-bold text-green-600"> ₺{act.data.amount}</span> bağış yaptı.
                             </>
                          ) : (
                             <>
                               <span className="font-bold">{act.data.username}</span> aramıza katıldı.
                             </>
                          )}
                       </p>
                       <span className="text-xs text-gray-400">
                          {new Date(parseInt(act.date)).toLocaleDateString()}
                       </span>
                    </div>
                 </div>
              ))}
              
              {activities.length === 0 && <p className="text-gray-400 text-sm">Henüz aktivite yok.</p>}
           </div>
        </div>

      </div>

    </AdminLayout>
  );
};

export default AdminDashboard;