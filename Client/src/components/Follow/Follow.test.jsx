import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import UserFollowButton from './UserFollowButton';
import FollowRequests from './FollowRequests';
import RemoveFollowerButton from './RemoveFollowerButton';
import { GET_INCOMING_FOLLOW_REQUESTS, REQUEST_FOLLOW, CANCEL_FOLLOW_REQUEST, UNFOLLOW_USER, RESPOND_TO_FOLLOW_REQUEST, REMOVE_FOLLOWER } from '../../graphql/followRequests';

const showToast = jest.fn();
const updated = jest.fn();
function ButtonHarness({ initialStatus = 'NOT_FOLLOWING', nextStatus = 'PENDING' }) {
  const [status, setStatus] = useState(initialStatus);
  return <><span data-testid="status">{status}</span><UserFollowButton targetId="target-1" status={status}
    onUpdate={() => { updated(); setStatus(nextStatus); }} showToast={showToast} /></>;
}
const show = (component, mocks) => render(<MockedProvider mocks={mocks} addTypename={false}><MemoryRouter>{component}</MemoryRouter></MockedProvider>);
const action = (field, status, requestStatus = null) => ({ data: { [field]: { code: 200, message: 'İşlem tamamlandı.', followStatus: status,
  request: requestStatus ? { id: 'request-1', status: requestStatus } : null } } });
const pending = { id: 'request-1', status: 'PENDING', createdAt: '2026-10-25T10:00:00Z', requester: { id: 'sender-1', username: 'deniz', fullName: 'Deniz', profilePicture: '' } };
const inbox = items => ({ data: { getIncomingFollowRequests: { items, total: items.length } } });
beforeEach(() => { showToast.mockClear(); updated.mockClear(); });

test('sending a follow request shows a pending state rather than claiming an immediate follow', async () => {
  const result = jest.fn(() => action('requestFollowUser', 'PENDING', 'PENDING'));
  show(<ButtonHarness />, [{ request: { query: REQUEST_FOLLOW, variables: { targetId: 'target-1' } }, result }]);
  const button = screen.getByRole('button', { name: 'Takip İsteği Gönder' });
  fireEvent.click(button); fireEvent.click(button);
  await screen.findByRole('button', { name: 'İsteği Geri Çek' });
  expect(screen.getByTestId('status')).toHaveTextContent('PENDING');
  expect(result).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'Takibi Bırak' })).not.toBeInTheDocument();
});

test.each([
  ['PENDING', 'İsteği Geri Çek', CANCEL_FOLLOW_REQUEST, 'cancelFollowRequest'],
  ['FOLLOWING', 'Takibi Bırak', UNFOLLOW_USER, 'unfollowUser'],
])('%s invokes its explicit action and resets the button after success', async (status, label, mutation, field) => {
  show(<ButtonHarness initialStatus={status} nextStatus="NOT_FOLLOWING" />, [{
    request: { query: mutation, variables: { targetId: 'target-1' } }, result: action(field, 'NOT_FOLLOWING'),
  }]);
  fireEvent.click(screen.getByRole('button', { name: label }));
  await screen.findByRole('button', { name: 'Takip İsteği Gönder' });
  expect(updated).toHaveBeenCalledTimes(1);
});

test('a failed request preserves the original follow state and allows retry', async () => {
  show(<ButtonHarness />, [{ request: { query: REQUEST_FOLLOW, variables: { targetId: 'target-1' } }, error: new Error('Bağlantı kesildi') }]);
  fireEvent.click(screen.getByRole('button', { name: 'Takip İsteği Gönder' }));
  await waitFor(() => expect(showToast).toHaveBeenCalledWith('Bağlantı kesildi', 'error'));
  expect(updated).not.toHaveBeenCalled();
  expect(screen.getByTestId('status')).toHaveTextContent('NOT_FOLLOWING');
  expect(screen.getByRole('button', { name: 'Takip İsteği Gönder' })).toBeEnabled();
});

test.each([true, false])('the inbox sends the selected approval decision (%s) and removes handled requests', async accept => {
  const response = jest.fn(() => action('respondToFollowRequest', accept ? 'FOLLOWING' : 'NOT_FOLLOWING', accept ? 'ACCEPTED' : 'REJECTED'));
  show(<FollowRequests />, [
    { request: { query: GET_INCOMING_FOLLOW_REQUESTS, variables: { limit: 20, offset: 0 } }, result: inbox([pending]) },
    { request: { query: RESPOND_TO_FOLLOW_REQUEST, variables: { requestId: pending.id, accept } }, result: response },
    { request: { query: GET_INCOMING_FOLLOW_REQUESTS, variables: { limit: 20, offset: 0 } }, result: inbox([]) },
  ]);
  const button = await screen.findByRole('button', { name: accept ? 'deniz için kabul et' : 'deniz için reddet' });
  fireEvent.click(button);
  await screen.findByText('Onay bekleyen takip isteği yok.');
  expect(response).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'deniz için kabul et' })).not.toBeInTheDocument();
});

test('a concurrent cancellation is reported without showing an acceptance or leaving stale controls', async () => {
  show(<FollowRequests />, [
    { request: { query: GET_INCOMING_FOLLOW_REQUESTS, variables: { limit: 20, offset: 0 } }, result: inbox([pending]) },
    { request: { query: RESPOND_TO_FOLLOW_REQUEST, variables: { requestId: pending.id, accept: true } }, error: new Error('Bu takip isteği artık onay beklemiyor.') },
    { request: { query: GET_INCOMING_FOLLOW_REQUESTS, variables: { limit: 20, offset: 0 } }, result: inbox([]) },
  ]);
  fireEvent.click(await screen.findByRole('button', { name: 'deniz için kabul et' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('artık onay beklemiyor');
  await screen.findByText('Onay bekleyen takip isteği yok.');
});

test('pending requests beyond the initial page remain accessible', async () => {
  const items = Array.from({ length: 20 }, (_, index) => ({ ...pending, id: `request-${index}` }));
  const last = { ...pending, id: 'request-last', requester: { ...pending.requester, username: 'sonistek' } };
  show(<FollowRequests />, [
    { request: { query: GET_INCOMING_FOLLOW_REQUESTS, variables: { limit: 20, offset: 0 } }, result: { data: { getIncomingFollowRequests: { items, total: 21 } } } },
    { request: { query: GET_INCOMING_FOLLOW_REQUESTS, variables: { limit: 20, offset: 20 } }, result: { data: { getIncomingFollowRequests: { items: [last], total: 21 } } } },
  ]);
  fireEvent.click(await screen.findByRole('button', { name: 'Diğer İstekler' }));
  await screen.findByRole('button', { name: 'sonistek için kabul et' });
  expect(screen.queryByRole('button', { name: 'Diğer İstekler' })).not.toBeInTheDocument();
});

test('removing a follower refreshes the list once without opening the clicked profile', async () => {
  const navigateToProfile = jest.fn();
  const result = jest.fn(() => action('removeFollower', 'NOT_FOLLOWING'));
  show(<div onClick={navigateToProfile}><RemoveFollowerButton followerId="follower-1" username="deniz"
    onUpdate={updated} showToast={showToast} /></div>, [{
    request: { query: REMOVE_FOLLOWER, variables: { followerId: 'follower-1' } }, result,
  }]);
  const button = screen.getByRole('button', { name: 'deniz takipçisini çıkar' });
  fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(updated).toHaveBeenCalledTimes(1));
  expect(result).toHaveBeenCalledTimes(1);
  expect(navigateToProfile).not.toHaveBeenCalled();
  expect(showToast).toHaveBeenCalledWith('İşlem tamamlandı.', 'success');
});

test('failed follower removal leaves the list unchanged and enables retry', async () => {
  show(<RemoveFollowerButton followerId="follower-1" username="deniz" onUpdate={updated} showToast={showToast} />, [{
    request: { query: REMOVE_FOLLOWER, variables: { followerId: 'follower-1' } }, error: new Error('Bağlantı kesildi'),
  }]);
  fireEvent.click(screen.getByRole('button', { name: 'deniz takipçisini çıkar' }));
  await waitFor(() => expect(showToast).toHaveBeenCalledWith('Bağlantı kesildi', 'error'));
  expect(updated).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'deniz takipçisini çıkar' })).toBeEnabled();
});
