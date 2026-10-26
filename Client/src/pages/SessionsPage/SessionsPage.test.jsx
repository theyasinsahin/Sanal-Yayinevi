import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { MockedProvider } from '@apollo/client/testing';
import SessionsPage, { CreateSessionModal } from './index';
import { useAuth } from '../../context/AuthContext';
import { useGetSessions, useCreateSession } from '../../hooks/useSessions';
import { GET_SOCIAL_SHARE } from '../../graphql/socialShare';
import { DEFAULT_SESSION_COVER } from '../../components/Sessions/SessionCover';
jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../hooks/useSessions', () => ({ useGetSessions: jest.fn(), useCreateSession: jest.fn() }));
jest.mock('../../components/Layout/MainLayout', () => ({ MainLayout: ({ children }) => <main>{children}</main> }));
jest.mock('../../components/ImageUpload', () => ({ __esModule: true, default: ({ onUploadSuccess, onLoadingChange }) => <><button onClick={() => onUploadSuccess('https://res.cloudinary.com/dw1sepw7z/image/upload/cover.jpg')}>Fotoğraf seç</button><button onClick={() => onLoadingChange(true)}>Yükleme başlat</button></> }));
const session = { id: 'session-one', publicPath: '/oturum/kitap-fuari', title: 'Kitap Fuarı', description: 'Etkinlik hakkında düşünceler.', coverImageUrl: '', type: 'OPEN', isActive: true, tags: ['fuar'], participantCount: 5, createdAt: '2026-01-01T12:00:00Z', createdBy: { id: 'organizer', username: 'organizer', fullName: 'Organizatör' } };
const Location = () => <output data-testid="location">{useLocation().pathname}</output>;
beforeEach(() => {
  useAuth.mockReturnValue({ user: { id: 'organizer', isPremium: true } });
  useGetSessions.mockReturnValue({ sessions: [session], loading: false, hasMore: false });
  useCreateSession.mockReturnValue({ createSession: jest.fn(), loading: false });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['photo'], { type: 'image/jpeg' }) });
  URL.createObjectURL = jest.fn().mockReturnValue('blob:session'); URL.revokeObjectURL = jest.fn();
});
const show = () => render(<MockedProvider addTypename={false} mocks={[{
  request: { query: GET_SOCIAL_SHARE, variables: { type: 'SESSION', id: session.id } },
  result: { data: { getSocialShare: { type: 'SESSION', id: session.id, title: session.title, description: session.description, path: session.publicPath, imagePath: DEFAULT_SESSION_COVER, webOrigin: 'https://betik.example' } } },
}]}><MemoryRouter initialEntries={['/sessions']}><SessionsPage /><Location /></MemoryRouter></MockedProvider>);

test('legacy cards show a photo above the session information and preserve readable links', () => {
  show(); const card = screen.getByRole('article');
  const image = within(card).getByRole('img', { name: /kapak fotoğrafı/ });
  expect(image).toHaveAttribute('src', DEFAULT_SESSION_COVER);
  const heading = within(card).getByRole('heading', { name: session.title });
  expect(image.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(heading.closest('a')).toHaveAttribute('href', session.publicPath);
  expect(within(card).getByRole('button', { name: 'Oturumu paylaş' }).closest('a')).toBeNull();
});

test('card shares open the existing dialog and include a WhatsApp link without navigating away', async () => {
  show(); fireEvent.click(screen.getByRole('button', { name: 'Oturumu paylaş' }));
  expect(await screen.findByRole('dialog', { name: 'Paylaş' })).toBeInTheDocument();
  const whatsapp = await screen.findByRole('link', { name: 'WhatsApp' });
  expect(new URL(whatsapp.href).searchParams.get('text')).toContain('/share/session/kitap-fuari');
  expect(screen.getByTestId('location')).toHaveTextContent('/sessions');
});

test.each(['PRIVATE', 'FOLLOWERS_ONLY'])('%s cards do not offer public sharing', type => {
  useGetSessions.mockReturnValue({ sessions: [{ ...session, type }], loading: false, hasMore: false });
  show(); expect(screen.queryByRole('button', { name: 'Oturumu paylaş' })).not.toBeInTheDocument();
});

test('creating a session includes the selected uploaded cover', async () => {
  const onCreate = jest.fn().mockResolvedValue({}), onClose = jest.fn();
  render(<CreateSessionModal onCreate={onCreate} onClose={onClose} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Başlık' }), { target: { value: 'Etkinlik' } });
  fireEvent.click(screen.getByRole('button', { name: 'Fotoğraf seç' }));
  fireEvent.click(screen.getByRole('button', { name: 'Oturum Oluştur' }));
  await screen.findByRole('dialog');
  expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ title: 'Etkinlik', type: 'OPEN', coverImageUrl: 'https://res.cloudinary.com/dw1sepw7z/image/upload/cover.jpg' }));
});

test('submission is disabled until the image finishes uploading', () => {
  render(<CreateSessionModal onCreate={jest.fn()} onClose={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Yükleme başlat' }));
  expect(screen.getByRole('button', { name: 'Oturum Oluştur' })).toBeDisabled();
});

test('a create failure keeps the form open and shows the server error', async () => {
  const onClose = jest.fn();
  render(<CreateSessionModal onCreate={jest.fn().mockRejectedValue(new Error('Oturum kaydedilemedi.'))} onClose={onClose} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Başlık' }), { target: { value: 'Etkinlik' } });
  fireEvent.click(screen.getByRole('button', { name: 'Oturum Oluştur' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Oturum kaydedilemedi.');
  expect(onClose).not.toHaveBeenCalled();
});
