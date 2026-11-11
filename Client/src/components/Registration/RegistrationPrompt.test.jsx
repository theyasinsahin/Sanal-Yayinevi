import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RegistrationPrompt from './RegistrationPrompt';
import { readRegistrationIntent, requestRegistration } from '../../utils/registrationIntent';

beforeEach(() => sessionStorage.clear());
const show = () => render(<MemoryRouter><button>Okumaya devam et</button><RegistrationPrompt /></MemoryRouter>);
const open = () => act(() => requestRegistration({ action: 'read', returnTo: '/book-reader/book?chapter=second' }));
test('dismissal restores focus and opens no further prompt until the next user action', () => {
  show(); const previous = screen.getByRole('button'); previous.focus(); open();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Ücretsiz hesap oluştur' })).toHaveFocus();
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(previous).toHaveFocus();
  expect(document.body.style.overflow).toBe('');
  expect(readRegistrationIntent()).toBeNull();
  open(); open(); expect(screen.getAllByRole('dialog')).toHaveLength(1);
});
test('focus stays in the dialog and registration persists the intended chapter', () => {
  show(); open();
  const links = screen.getAllByRole('link');
  links[0].focus(); fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
  expect(screen.getByRole('button', { name: 'Şimdilik geri dön' })).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Tab' }); expect(links[0]).toHaveFocus();
  expect(links[0]).toHaveAttribute('href', '/register?returnTo=%2Fbook-reader%2Fbook%3Fchapter%3Dsecond');
  fireEvent.click(links[0]);
  expect(readRegistrationIntent()).toMatchObject({ action: 'read', returnTo: '/book-reader/book?chapter=second', ready: false });
});
