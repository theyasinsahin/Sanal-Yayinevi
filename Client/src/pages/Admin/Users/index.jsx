import React from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { Delete, VerifiedUser } from '@mui/icons-material';

import AdminLayout from '../../../components/Admin/AdminLayout';
import { AdminTable } from '../../../components/Admin/AdminTable';
import { Button } from '../../../components/UI/Button';
import { Badge } from '../../../components/UI/Badge';

import { GET_ALL_USERS } from '../../../graphql/queries/user';
// import { DELETE_USER_MUTATION } from ... (Backend'de olması lazım)

const AdminUsers = () => {
  const { data, loading, error, refetch } = useQuery(GET_ALL_USERS, {
    fetchPolicy: 'network-only'
  });

  const users = data?.getAllUsers || [];

  const handleDeleteUser = (id) => {
    if(window.confirm("Kullanıcıyı silmek istediğinize emin misiniz?")) {
        console.log("Silinecek ID:", id);
        // await deleteUserMutation({ variables: { id } });
        // refetch();
    }
  };

  return (
    <AdminLayout title="Kullanıcı Yönetimi">
      {loading ? <p>Yükleniyor...</p> : (
        <AdminTable 
          columns={['Avatar', 'Kullanıcı Adı', 'Email', 'Rol', 'İşlemler']}
          data={users}
          renderRow={(user) => (
            <tr key={user.id}>
              <td>
                <img 
                  src={user.profilePicture || 'https://via.placeholder.com/40'} 
                  alt="avatar" 
                  style={{width:40, height:40, borderRadius:'50%', objectFit:'cover'}}
                />
              </td>
              <td style={{fontWeight:600}}>{user.username}</td>
              <td>{user.email}</td>
              <td>
                <Badge variant={user.role === 'ADMIN' ? 'primary' : 'neutral'}>
                  {user.role || 'USER'}
                </Badge>
              </td>
              <td>
                <div style={{display:'flex', gap: 10}}>
                  <Button size="small" variant="danger" onClick={() => handleDeleteUser(user.id)}>
                    <Delete fontSize="small"/>
                  </Button>
                  {/* Rol Değiştirme Butonu Eklenebilir */}
                </div>
              </td>
            </tr>
          )}
        />
      )}
    </AdminLayout>
  );
};

export default AdminUsers;