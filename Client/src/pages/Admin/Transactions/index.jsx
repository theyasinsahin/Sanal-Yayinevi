import React from 'react';
import { useQuery } from '@apollo/client';
import { Search } from '@mui/icons-material';

// --- BİLEŞENLER ---
import AdminLayout from '../../../components/Admin/AdminLayout';
import { AdminTable } from '../../../components/Admin/AdminTable';
import { Badge } from '../../../components/UI/Badge';
import { Input } from '../../../components/UI/Input';

// --- QUERY ---
import { GET_ALL_TRANSACTIONS } from '../../../graphql/queries/transaction';

const AdminTransactions = () => {
  const { data, loading, error } = useQuery(GET_ALL_TRANSACTIONS, {
    fetchPolicy: 'network-only' // Her girişte güncel veri
  });

  const transactions = data?.getAllTransactions || [];

  // Tarih Formatlayıcı
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit' };
    return new Date(parseInt(dateString)).toLocaleDateString('tr-TR', options);
  };

  console.log('Transactions:', transactions);

  return (
    <AdminLayout title="Finansal İşlemler">
      
      {/* Filtreleme Alanı (Görsel olarak ekledik, fonksiyonu sonra bağlanabilir) */}
      <div className="mb-6 bg-white p-4 rounded-xl border border-gray-200 flex items-center gap-4">
         <div style={{flex: 1}}>
            <Input placeholder="İşlem kodu veya kullanıcı ara..." icon={<Search/>} />
         </div>
         <div className="text-sm text-gray-500 font-medium">
            Toplam İşlem Hacmi: <span className="text-indigo-600 font-bold text-lg ml-2">
                ₺{transactions.reduce((acc, t) => acc + t.amount, 0).toLocaleString()}
            </span>
         </div>
      </div>

      {loading ? <p className="text-center p-10">Yükleniyor...</p> : (
        <AdminTable 
          columns={['Gönderen', 'Kitap', 'Tutar', 'Tarih', 'Durum']}
          data={transactions}
          renderRow={(trx) => (
            <tr key={trx.id} className="hover:bg-gray-50 transition-colors">
              <td>
                <div className="flex items-center gap-3">
                   <img 
                     src={trx.userId?.profilePicture || 'https://via.placeholder.com/40'} 
                     alt="avatar" 
                     className="w-8 h-8 rounded-full object-cover"
                   />
                   <div className="flex flex-col">
                      <span className="font-semibold text-gray-800">{trx.userId?.username || "Silinmiş Kullanıcı"}</span>
                      <span className="text-xs text-gray-500">{trx.userId?.email}</span>
                   </div>
                </div>
              </td>
              <td>
                 {trx.bookId ? (
                    <span className="font-medium text-gray-700">{trx.bookId.title}</span>
                 ) : (
                    <span className="text-gray-400 italic">Kitap Silinmiş</span>
                 )}
              </td>
              <td className="font-bold text-gray-900">
                 ₺{trx.amount}
              </td>
              <td className="text-sm text-gray-500">
                 {formatDate(trx.createdAt)}
              </td>
              <td>
                <Badge variant={trx.status === 'SUCCESS' ? 'success' : 'danger'}>
                  {trx.status === 'SUCCESS' ? 'Başarılı' : 'Hata'}
                </Badge>
              </td>
            </tr>
          )}
        />
      )}
    </AdminLayout>
  );
};

export default AdminTransactions;