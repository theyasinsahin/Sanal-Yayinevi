import { createApiConfig } from './api';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../pages/Auth/Login';
import RegisterPage from '../pages/Auth/Register';

jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ login: jest.fn(), user: null }) }));
jest.mock('../components/Layout/MainLayout', () => ({ MainLayout: ({ children }) => <main>{children}</main> }));
jest.mock('@mui/icons-material', () => Object.fromEntries(
  ['Email', 'Lock', 'Login', 'Person', 'HowToReg', 'AlternateEmail', 'VpnKey', 'CheckCircle', 'Cancel'].map(name => [name, () => null]),
));
jest.mock('@react-oauth/google', () => ({ GoogleLogin: ({ login_uri }) => <button data-testid="google-login" data-login-uri={login_uri}>Google</button> }));

test('development authentication and GraphQL stay on the local server', () => {
  expect(createApiConfig()).toEqual({
    API_URL: 'http://localhost:5000',
    WS_URL: 'ws://localhost:5000/graphql',
    GOOGLE_LOGIN_URI: 'http://localhost:5000/auth/google/callback',
  });
});

test('deployed authentication follows the configured API host, including APIs with a path', () => {
  expect(createApiConfig('https://api.example.test/graphql')).toEqual({
    API_URL: 'https://api.example.test/graphql',
    WS_URL: 'wss://api.example.test/graphql',
    GOOGLE_LOGIN_URI: 'https://api.example.test/auth/google/callback',
  });
});

test('an explicitly configured WebSocket endpoint is preserved', () => {
  expect(createApiConfig('http://localhost:5001/', 'ws://localhost:5002/events')).toMatchObject({
    WS_URL: 'ws://localhost:5002/events',
    GOOGLE_LOGIN_URI: 'http://localhost:5001/auth/google/callback',
  });
});

test.each([['login', LoginPage], ['registration', RegisterPage]])('%s sends Google credentials to the configured API, rather than a fixed live host', (_, Page) => {
  render(<MockedProvider><MemoryRouter><Page /></MemoryRouter></MockedProvider>);
  const expected = createApiConfig(process.env.REACT_APP_API_URL || undefined).GOOGLE_LOGIN_URI;
  expect(screen.getByTestId('google-login')).toHaveAttribute('data-login-uri', expected);
});
