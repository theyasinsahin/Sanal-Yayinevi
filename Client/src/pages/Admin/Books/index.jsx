import React from 'react';
import { useQuery } from '@apollo/client';
import { Delete, Visibility } from '@mui/icons-material';
import { Link } from 'react-router-dom';

import AdminLayout from '../../../components/Admin/AdminLayout';
import { AdminTable } from '../../../components/Admin/AdminTable';
import { Button } from '../../../components/UI/Button';
import { Badge } from '../../../components/UI/Badge';

import { GET_BOOKS } from '../../../graphql/queries/book';
import { DELETE_BOOK_MUTATION } from '../../../graphql/mutations/book';
import { useMutation } from '@apollo/client';

const AdminBooks = () => {
  const { data, loading, refetch } = useQuery(GET_BOOKS, { fetchPolicy: 'network-only' });
  const [deleteBook] = useMutation(DELETE_BOOK_MUTATION);

  const books = data?.getAllBooks || [];

  const handleDelete = async (id) => {
    if(window.confirm("Kitabı kalıcı olarak silmek istediğinize emin misiniz?")) {
       await deleteBook({ variables: { id } });
       refetch();
    }
  };

  return (
    <AdminLayout title="Kitap Yönetimi">
      {loading ? <p>Yükleniyor...</p> : (
        <AdminTable 
          columns={['Kapak', 'Başlık', 'Yazar', 'Kategori', 'İşlemler']}
          data={books}
          renderRow={(book) => (
            <tr key={book.id}>
              <td>
                <img 
                  src={book.imageUrl} 
                  alt="cover" 
                  style={{width:40, height:60, borderRadius:4, objectFit:'cover'}}
                />
              </td>
              <td style={{fontWeight:600}}>{book.title}</td>
              {/* book.author populate edilmemiş olabilir, kontrol et */}
              <td>{typeof book.authorId === 'object' ? book.authorId.username : "ID: " + book.authorId.substring(0,6)}...</td>
              <td><Badge variant="neutral">{book.genre}</Badge></td>
              <td>
                <div style={{display:'flex', gap: 10}}>
                  <Link to={`/book-detail/${book.id}`} target="_blank">
                    <Button size="small" variant="outline"><Visibility fontSize="small"/></Button>
                  </Link>
                  <Button size="small" variant="danger" onClick={() => handleDelete(book.id)}>
                    <Delete fontSize="small"/>
                  </Button>
                </div>
              </td>
            </tr>
          )}
        />
      )}
    </AdminLayout>
  );
};

export default AdminBooks;