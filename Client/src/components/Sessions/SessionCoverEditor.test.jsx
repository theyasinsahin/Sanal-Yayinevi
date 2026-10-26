import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useQuery } from '@apollo/client';
import { MockedProvider } from '@apollo/client/testing';
import SessionCoverEditor from './SessionCoverEditor';
import SessionCover, { DEFAULT_SESSION_COVER } from './SessionCover';
import { GET_SESSION, UPDATE_SESSION_COVER } from '../../graphql/queries/session';
jest.mock('../ImageUpload', () => ({ __esModule: true, default: ({ onUploadSuccess }) => <button onClick={() => onUploadSuccess('https://res.cloudinary.com/c/image/upload/new.jpg')}>Fotoğraf seç</button> }));
const session = { __typename: 'Session', id: 'session', publicPath: '/oturum/etkinlik', title: 'Etkinlik', description: '', coverImageUrl: DEFAULT_SESSION_COVER, type: 'OPEN', isActive: true, tags: [], participantCount: 0, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', createdBy: { __typename: 'User', id: 'owner', username: 'owner', fullName: 'Organizatör', profilePicture: '' } };
function View({ close }) {
  const { data } = useQuery(GET_SESSION, { variables: { sessionId: 'session' } });
  return data ? <><SessionCover src={data.getSession.coverImageUrl} title={data.getSession.title} /><SessionCoverEditor session={data.getSession} onClose={close} /></> : null;
}

test('saving an uploaded cover updates the same Session in Apollo cache and closes the editor', async () => {
  const close = jest.fn(), url = 'https://res.cloudinary.com/c/image/upload/new.jpg';
  render(<MockedProvider mocks={[
    { request: { query: GET_SESSION, variables: { sessionId: 'session' } }, result: { data: { getSession: session } } },
    { request: { query: UPDATE_SESSION_COVER, variables: { sessionId: 'session', coverImageUrl: url } }, result: { data: { updateSessionCover: { ...session, coverImageUrl: url } } } },
  ]}><View close={close} /></MockedProvider>);
  fireEvent.click(await screen.findByRole('button', { name: 'Fotoğraf seç' }));
  fireEvent.click(screen.getByRole('button', { name: 'Kapağı kaydet' }));
  await waitFor(() => expect(close).toHaveBeenCalled());
  expect(screen.getByRole('img')).toHaveAttribute('src', url);
});

test('a failed cover update keeps the editor open and the old image visible', async () => {
  const close = jest.fn();
  render(<MockedProvider mocks={[
    { request: { query: UPDATE_SESSION_COVER, variables: { sessionId: 'session', coverImageUrl: '' } }, error: new Error('Kaydetme başarısız.') },
  ]}><SessionCoverEditor session={session} onClose={close} /></MockedProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Kapağı kaydet' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Kaydetme başarısız.');
  expect(close).not.toHaveBeenCalled();
});
