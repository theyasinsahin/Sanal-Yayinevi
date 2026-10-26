import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('graphql-ws', () => ({ createClient: () => ({ terminate: jest.fn() }) }));
jest.mock('@react-oauth/google', () => ({ GoogleOAuthProvider: ({ children }) => children }));
jest.mock('./context/AuthContext', () => ({ AuthProvider: ({ children }) => children, useAuth: () => ({ user: null, loading: false }) }));
jest.mock('./context/ToastContext', () => ({ ToastProvider: ({ children }) => children }));
jest.mock('./components/Score/ScoreUpdates', () => () => null);
jest.mock('./components/InstallPrompt', () => () => null);
jest.mock('./components/Navigation/NavigationBar', () => () => null);
jest.mock('./components/Route/PublicContentRoute', () => ({ children }) => children);
jest.mock('./pages/Landing', () => () => <h1>Betik</h1>);
jest.mock('./pages/BookDashboard', () => { throw new Error('The editor must not load with the home page'); });
jest.mock('./pages/Admin/Dashboard', () => { throw new Error('Admin code must not load with the home page'); });

test('the home route renders without loading editor or admin modules', async () => {
  global.fetch = jest.fn(); window.scrollTo = jest.fn();
  const App = require('./App').default;
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Betik' })).toBeInTheDocument();
});
