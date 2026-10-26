import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ImageUpload, { cropImage } from './index';
jest.mock('@mui/icons-material', () => ({ AddPhotoAlternate: () => null }));
let draw;
const NativeImage = global.Image;
beforeEach(() => {
  global.Image = class { constructor() { this.naturalWidth = 2400; this.naturalHeight = 1600; } set src(value) { Promise.resolve().then(() => this.onload()); } };
  draw = jest.fn();
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: draw });
  jest.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['jpg'], { type: 'image/jpeg' })));
  URL.createObjectURL = jest.fn().mockReturnValue('blob:image'); URL.revokeObjectURL = jest.fn();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ secure_url: 'https://res.cloudinary.com/c/image/upload/new.jpg' }) });
});
afterEach(() => { global.Image = NativeImage; jest.restoreAllMocks(); });

test('the default book crop remains 2:3 while session covers use 16:9 at 1600 pixels', async () => {
  const file = new File(['image'], 'cover.jpg', { type: 'image/jpeg' });
  await cropImage(file); expect(draw.mock.calls[0].slice(-2)).toEqual([1067, 1600]);
  await cropImage(file, 16 / 9, 1600); expect(draw.mock.calls[1].slice(-2)).toEqual([1600, 900]);
});

test('a successful upload returns the provider URL and clears the busy state', async () => {
  const success = jest.fn(), busy = jest.fn();
  render(<ImageUpload label="Kapak yükle" onUploadSuccess={success} onLoadingChange={busy} aspectRatio={16 / 9} />);
  fireEvent.change(screen.getByLabelText('Kapak yükle'), { target: { files: [new File(['image'], 'cover.jpg', { type: 'image/jpeg' })] } });
  await waitFor(() => expect(success).toHaveBeenCalledWith('https://res.cloudinary.com/c/image/upload/new.jpg'));
  expect(busy).toHaveBeenLastCalledWith(false);
  expect(fetch.mock.calls[0][1].body.get('file').type).toBe('image/jpeg');
});

test('invalid session image types are rejected before contacting the upload provider', () => {
  const error = jest.fn(), success = jest.fn();
  render(<ImageUpload label="Kapak yükle" onUploadSuccess={success} onError={error} allowedTypes={['image/jpeg']} maxFileSize={8 * 1024 * 1024} />);
  fireEvent.change(screen.getByLabelText('Kapak yükle'), { target: { files: [new File(['svg'], 'image.svg', { type: 'image/svg+xml' })] } });
  expect(fetch).not.toHaveBeenCalled(); expect(success).not.toHaveBeenCalled(); expect(error).toHaveBeenCalledWith(expect.stringContaining('8 MB'));
});

test('a failed provider response keeps the existing cover and never reports a successful upload', async () => {
  fetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'upload rejected' }) });
  const error = jest.fn(), success = jest.fn();
  render(<ImageUpload label="Kapak yükle" currentImage="/old.jpg" onUploadSuccess={success} onError={error} />);
  fireEvent.change(screen.getByLabelText('Kapak yükle'), { target: { files: [new File(['image'], 'cover.jpg', { type: 'image/jpeg' })] } });
  await waitFor(() => expect(error).toHaveBeenCalled());
  expect(success).not.toHaveBeenCalled(); expect(screen.getByRole('img')).toHaveAttribute('src', '/old.jpg');
});

test('multiple uploaders use separate input labels', () => {
  render(<><ImageUpload label="Kitap kapağı" onUploadSuccess={jest.fn()} /><ImageUpload label="Oturum kapağı" onUploadSuccess={jest.fn()} /></>);
  expect(screen.getByLabelText('Kitap kapağı').id).not.toBe(screen.getByLabelText('Oturum kapağı').id);
});
