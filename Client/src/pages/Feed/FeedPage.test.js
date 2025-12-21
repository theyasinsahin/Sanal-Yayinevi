import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import FeedPage from './index'; // FeedPage import
import { GET_BOOKS } from '../../graphql/queries/book';
import { GET_ALL_USERS } from '../../graphql/queries/user';
import { FiltersProvider } from '../../context/FiltersContext'; // Context Provider lazım

// SAHTE VERİLER (MOCKS)
const mocks = [
  {
    request: { query: GET_BOOKS },
    result: {
      data: {
        getAllBooks: [
          {
            id: '1',
            title: 'Test Kitabı 1',
            authorId: 'u1',
            tags: [],
            stats: { views: 0, likes: 0 },
            genre: 'Roman',
            createdAt: new Date().toISOString()
          }
        ]
      }
    }
  },
  {
    request: { query: GET_ALL_USERS },
    result: {
      data: {
        getAllUsers: [
          { id: 'u1', _id: 'u1', username: 'testuser', fullName: 'Test User' }
        ]
      }
    }
  }
];

test('FeedPage yükleniyor yazısını ve ardından kitapları gösteriyor mu?', async () => {
  render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <FiltersProvider>
         <FeedPage />
      </FiltersProvider>
    </MockedProvider>
  );

  // 1. Başlangıçta "Yükleniyor..." görmeliyiz
  expect(screen.getByText(/Yükleniyor.../i)).toBeInTheDocument();

  // 2. Veri gelince "Test Kitabı 1" ekranda olmalı
  // waitFor asenkron işlemi bekler
  await waitFor(() => {
    expect(screen.getByText('Test Kitabı 1')).toBeInTheDocument();
  });
});