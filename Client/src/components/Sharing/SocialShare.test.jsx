import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import SocialShareDialog from './SocialShareDialog';
import SocialShareButton from './SocialShareButton';
import { GET_SOCIAL_SHARE } from '../../graphql/socialShare';

const item = { type: 'QUOTE', id: 'quote-id', title: 'Kitaptan bir alıntı', description: 'Paylaşılacak satırlar.', path: '/quotes/quote-id', imagePath: '/social-share/quote.jpg', webOrigin: 'https://betik.example' };
const mock = () => ({ request: { query: GET_SOCIAL_SHARE, variables: { type: 'QUOTE', id: 'quote-id' } }, result: { data: { getSocialShare: item } } });
const show = (props = {}, mocks = [mock()]) => render(<MockedProvider mocks={mocks} addTypename={false}><SocialShareDialog target={{ type: 'QUOTE', id: 'quote-id' }} onClose={jest.fn()} {...props} /></MockedProvider>);
beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['photo'], { type: 'image/jpeg' }) });
  URL.createObjectURL = jest.fn().mockReturnValue('blob:photo'); URL.revokeObjectURL = jest.fn();
  Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: jest.fn().mockResolvedValue() } });
});
afterEach(() => jest.restoreAllMocks());

test('WhatsApp includes the link, the photo downloads, and captions can be copied without native sharing', async () => {
  show();
  const whatsapp = await screen.findByRole('link', { name: 'WhatsApp' });
  expect(new URL(whatsapp.href).searchParams.get('text')).toContain('/share/quote/quote-id');
  expect(await screen.findByRole('link', { name: 'Görseli indir' })).toHaveAttribute('download', 'betik-quote-quote-id.jpg');
  expect(screen.queryByRole('button', { name: 'Diğer uygulamalar' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Metin ve bağlantıyı kopyala' }));
  expect(await screen.findByText('Paylaşım metni ve bağlantı kopyalandı.')).toBeInTheDocument();
  expect(navigator.clipboard.writeText.mock.calls[0][0]).toContain('/share/quote/quote-id');
});

test('native image sharing uses the prepared static file and includes the resource link in the caption', async () => {
  Object.defineProperty(navigator, 'share', { configurable: true, value: jest.fn().mockResolvedValue() });
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: jest.fn().mockReturnValue(true) });
  show();
  fireEvent.click(await screen.findByRole('button', { name: 'Görsel ve bağlantıyı paylaş' }));
  expect(navigator.share).toHaveBeenCalledWith(expect.objectContaining({ files: [expect.any(File)], text: expect.stringContaining('/share/quote/quote-id') }));
  expect(await screen.findByText('Cihazın paylaşım menüsüne aktarıldı.')).toBeInTheDocument();
});

test('cancelling the native share sheet is not shown as an error or completed publication', async () => {
  Object.defineProperty(navigator, 'share', { configurable: true, value: jest.fn().mockRejectedValue(Object.assign(new Error('cancelled'), { name: 'AbortError' })) });
  show();
  fireEvent.click(await screen.findByRole('button', { name: 'Diğer uygulamalar' }));
  await waitFor(() => expect(navigator.share).toHaveBeenCalled());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByText('Cihazın paylaşım menüsüne aktarıldı.')).not.toBeInTheDocument();
});

test('private content cannot be exported but existing Betik messaging remains available', async () => {
  const send = jest.fn(), close = jest.fn();
  show({ onSendInBetik: send, onClose: close }, [{ request: mock().request, error: new Error('Bu içerik herkese açık değil.') }]);
  expect(await screen.findByRole('alert')).toHaveTextContent('herkese açık değil');
  expect(screen.queryByRole('link', { name: 'WhatsApp' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Betik’te mesajla gönder' }));
  expect(send).toHaveBeenCalled(); expect(close).toHaveBeenCalled();
});

test('sharing a chapter waits for save completion and keeps the dialog closed on save failure', async () => {
  const beforeOpen = jest.fn().mockRejectedValue(new Error('offline'));
  render(<MockedProvider><SocialShareButton type="CHAPTER" id="chapter" label="Bölümü paylaş" beforeOpen={beforeOpen} /></MockedProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Bölümü paylaş' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('kaydedilemedi');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('the dialog supports Escape and restores focus to its opener', async () => {
  render(<MockedProvider mocks={[mock()]} addTypename={false}><SocialShareButton type="QUOTE" id="quote-id" /></MockedProvider>);
  const opener = screen.getByRole('button', { name: 'Paylaş' });
  opener.focus(); fireEvent.click(opener);
  const dialog = await screen.findByRole('dialog');
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
});
