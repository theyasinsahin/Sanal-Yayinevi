import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import MentionInput, { activeMention } from './MentionInput';
import MentionText from './MentionText';
import { SEARCH_MENTION_USERS } from '../../graphql/queries/mention';

const users = [
  { id: '1', username: 'reader.test', fullName: 'First reader', profilePicture: '' },
  { id: '2', username: 'reader-two', fullName: 'Second reader', profilePicture: '' },
];
const submit = jest.fn();
function Composer({ initial = '' }) {
  const [value, setValue] = useState(initial);
  return <MentionInput as="input" aria-label="İleti" value={value} onChange={event => setValue(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') submit(value); }} />;
}
const suggestions = (query, result = users) => ({ request: { query: SEARCH_MENTION_USERS, variables: { query } }, result: { data: { searchMentionUsers: result } } });
const show = mocks => render(<MockedProvider mocks={mocks}><Composer /></MockedProvider>);
beforeEach(() => submit.mockReset());

test('the cursor token is recognized in unicode text without matching emails or URLs', () => {
  expect(activeMention('Merhaba @çağ', 12)).toEqual({ start: 8, end: 12, query: 'çağ' });
  expect(activeMention('Hello @reader rest', 13)?.query).toBe('reader');
  expect(activeMention('a@reader', 8)).toBeNull();
  expect(activeMention('https://x/@reader', 17)).toBeNull();
});

test('keyboard selection inserts the username without submitting the surrounding form', async () => {
  show([suggestions('rea')]);
  const input = screen.getByRole('textbox', { name: 'İleti' });
  fireEvent.change(input, { target: { value: 'Hello @rea' } });
  expect(await screen.findByRole('option', { name: /@reader.test/ })).toBeInTheDocument();
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(input).toHaveValue('Hello @reader-two ');
  expect(submit).not.toHaveBeenCalled();
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(submit).toHaveBeenCalledWith('Hello @reader-two ');
});

test('mouse selection at the caret preserves the text after the mention', async () => {
  show([suggestions('rea')]);
  const input = screen.getByRole('textbox', { name: 'İleti' });
  fireEvent.change(input, { target: { value: 'Hello @rea, welcome', selectionStart: 10 } });
  const option = await screen.findByRole('option', { name: /@reader.test/ });
  fireEvent.mouseDown(option);
  fireEvent.click(option);
  expect(input).toHaveValue('Hello @reader.test, welcome');
});

test('Escape dismisses suggestions; an empty result remains usable', async () => {
  show([suggestions('missing', [])]);
  const input = screen.getByRole('textbox', { name: 'İleti' });
  fireEvent.change(input, { target: { value: '@missing' } });
  expect(await screen.findByText('Etiketleyebileceğin bir kullanıcı bulunamadı.')).toBeInTheDocument();
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(input).toHaveValue('@missing');
});

test('mention links preserve punctuation and safely render untrusted text', () => {
  render(<MemoryRouter><p><MentionText>{'Merhaba @reader.test. a@reader.test <script>alert(1)</script>'}</MentionText></p></MemoryRouter>);
  expect(screen.getByRole('link', { name: '@reader.test' })).toHaveAttribute('href', '/yazar/reader.test');
  expect(screen.getByText(/a@reader.test <script>/)).toBeInTheDocument();
});

test('rapidly replacing the query only shows results for the current token', async () => {
  show([suggestions('new', [users[1]])]);
  const input = screen.getByRole('textbox', { name: 'İleti' });
  fireEvent.change(input, { target: { value: '@old' } });
  fireEvent.change(input, { target: { value: '@new' } });
  expect(await screen.findByRole('option', { name: /@reader-two/ })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: /@reader.test/ })).not.toBeInTheDocument();
});
