import React from 'react';
import { useQuery } from '@apollo/client';
import AdminLayout from '../../../components/Admin/AdminLayout';
import { Typography } from '../../../components/UI/Typography';
// --- GraphQL Queries ---
// Bu queryleri henüz yazmadıysan backend'e eklemen gerekecek.
// Şimdilik existing querylerden length alarak yapabiliriz.
import { GET_ALL_USERS } from '../../../graphql/queries/user';
import { GET_BOOKS } from '../../../graphql/queries/book';

import './Dashboard.css';

const AdminDashboard = () => {
  const { data: userData } = useQuery(GET_ALL_USERS);
  const { data: bookData } = useQuery(GET_BOOKS);

  const userCount = userData?.getAllUsers?.length || 0;
  const bookCount = bookData?.getAllBooks?.length || 0;
  // Transaction ve Comment sayıları için de benzer query'ler gerekecek

  return (
    <AdminLayout title="Dashboard">
      
      <div className="stats-grid-admin">
        <div className="admin-stat-card">
           <Typography variant="h6" color="muted">Kullanıcılar</Typography>
           <Typography variant="h3" weight="bold">{userCount}</Typography>
        </div>
        <div className="admin-stat-card">
           <Typography variant="h6" color="muted">Kitaplar</Typography>
           <Typography variant="h3" weight="bold">{bookCount}</Typography>
        </div>
        <div className="admin-stat-card">
           <Typography variant="h6" color="muted">Toplam Bağış</Typography>
           <Typography variant="h3" weight="bold">₺ 0</Typography> {/* Backend'den gelmeli */}
        </div>
      </div>

      <div className="mt-8">
        <Typography variant="h5" weight="bold" className="mb-4">Son Aktiviteler</Typography>
        <div className="bg-white p-6 rounded-xl border border-gray-200 text-center text-gray-500">
           Yakında buraya son işlemler listesi gelecek...
        </div>
      </div>

    </AdminLayout>
  );
};

export default AdminDashboard;