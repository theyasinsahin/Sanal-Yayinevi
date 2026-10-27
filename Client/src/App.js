import PublicContentRoute from './components/Route/PublicContentRoute';
import ScoreUpdates from './components/Score/ScoreUpdates';
import React, { lazy } from 'react';
import PageBoundary from './components/Route/PageBoundary';
import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  createHttpLink,
  split,                        
} from "@apollo/client";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions"; 
import { createClient } from "graphql-ws";                         
import { getMainDefinition } from "@apollo/client/utilities";      
import { createAuthLink } from './utils/authLink';
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from "react-router-dom";

import { AuthProvider, useAuth } from './context/AuthContext';
import { FiltersProvider } from "./context/FiltersContext";
import { ToastProvider } from './context/ToastContext';

import NavigationBar from "./components/Navigation/NavigationBar";
import ScrollToTop from './components/ScrollToTop';
import InstallPrompt from './components/InstallPrompt';

import LandingPage from "./pages/Landing";

import AdminRoute from './components/Route/AdminRoute';

import { GoogleOAuthProvider } from '@react-oauth/google';

import { ReadingPreferencesProvider } from './context/ReadingPreferencesContext';


import { API_URL, WS_URL } from './config/api';

const AuthorsPage = lazy(() => import('./pages/Community').then(module => ({ default: module.AuthorsPage })));
const AboutPage = lazy(() => import('./pages/Community').then(module => ({ default: module.AboutPage })));
const ContactPage = lazy(() => import('./pages/Community').then(module => ({ default: module.ContactPage })));
const LegalPage = lazy(() => import('./pages/Community').then(module => ({ default: module.LegalPage })));
const NewsletterPage = lazy(() => import('./pages/Community').then(module => ({ default: module.NewsletterPage })));
const PrintedBooksPage = lazy(() => import('./pages/PrintedBooks'));
const FeedPage = lazy(() => import('./pages/Feed'));
const BookDetailPage = lazy(() => import('./pages/BookDetail'));
const BookReader = lazy(() => import('./pages/BookReader'));
const CreateBookPage = lazy(() => import('./pages/CreateBookPage'));
const BookDashboard = lazy(() => import('./pages/BookDashboard'));
const UserProfilePage = lazy(() => import('./pages/UserProfilePage'));
const LoginPage = lazy(() => import('./pages/Auth/Login'));
const RegisterPage = lazy(() => import('./pages/Auth/Register'));
const GoogleCallback = lazy(() => import('./pages/Auth/GoogleCallback'));
const DonationPage = lazy(() => import('./pages/DonationPage'));
const PrintApplicationPage = lazy(() => import('./pages/PrintApplication'));
const FundingHistoryPage = lazy(() => import('./pages/FundingHistory'));
const AdminPrintFundingPage = lazy(() => import('./pages/Admin/PrintFunding'));
const PaymentSuccess = lazy(() => import('./pages/PaymentResult/PaymentSuccess'));
const PaymentFailure = lazy(() => import('./pages/PaymentResult/PaymentFailure'));
const ForgotPasswordPage = lazy(() => import('./pages/Auth/ForgotPassword'));
const ResetPasswordPage = lazy(() => import('./pages/Auth/ResetPassword'));
const QuotesPage = lazy(() => import('./pages/QuotesPage'));
const QuoteDetail = lazy(() => import('./pages/QuoteDetail'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const SessionsPage = lazy(() => import('./pages/SessionsPage'));
const SessionDetail = lazy(() => import('./pages/SessionDetail'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const AdminDashboard = lazy(() => import('./pages/Admin/Dashboard'));
const AdminUsers = lazy(() => import('./pages/Admin/Users'));
const AdminBooks = lazy(() => import('./pages/Admin/Books'));
const AdminPrintedBooks = lazy(() => import('./pages/Admin/PrintedBooks'));
const AdminTransactions = lazy(() => import('./pages/Admin/Transactions'));
const AdminData = lazy(() => import('./pages/Admin/Data'));
const AdminSessionAccess = lazy(() => import('./pages/Admin/SessionAccess'));

// --- APOLLO SETUP ---

const httpLink = createHttpLink({
  uri: API_URL,
});

// WebSocket link — sadece subscription operasyonları buradan geçer
const wsClient = createClient({
    url: WS_URL,
    connectionParams: () => ({
      authorization: localStorage.getItem("token")
        ? `Bearer ${localStorage.getItem("token")}`
        : "",
    }),
    shouldRetry: () => !!localStorage.getItem("token"),
    retryAttempts: 5,
  });
const wsLink = new GraphQLWsLink(wsClient);
const reconnectSubscriptions = () => wsClient.terminate();

// Subscription → wsLink, diğerleri → mevcut HTTP zinciri
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === "OperationDefinition" &&
      definition.operation === "subscription"
    );
  },
  wsLink,
  httpLink
);

const client = new ApolloClient({
  link: createAuthLink().concat(splitLink),
  cache: new InMemoryCache({ typePolicies: { AdminRecord: { keyFields: false } } }),
});

// --- LAYOUT ---
const Layout = ({ children }) => (
  <div className="App">
    <NavigationBar />
    {children}
  </div>
);

// --- PROTECTED ROUTE ---
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Yükleniyor...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

// --- KÖK LAYOUT (createBrowserRouter için) ---
// createBrowserRouter (<Routes>/<BrowserRouter> değil, "data router"
// API'si) kullanıldığında, tüm route'larda ortak çalışan bir şey
// (burada: her route değişiminde sayfayı en üste kaydırmak) istiyorsak
// bunu tek tek her sayfaya eklemek yerine, TÜM route'ları saran bir
// "kök route" tanımlayıp içine <ScrollToTop /> + <Outlet /> koyuyoruz.
// <Outlet />, o an eşleşen alt route'un element'ini (LandingPage,
// FeedPage, vb.) aynen eskisi gibi render eder — hiçbir sayfanın kendi
// davranışı değişmiyor, sadece hepsi artık ortak bu sarmalayıcının
// içinden geçiyor.
const RootLayout = () => (
  <>
    <ScrollToTop />
    <ScoreUpdates reconnect={reconnectSubscriptions} />
    <PageBoundary><Outlet /></PageBoundary>
    {/* Mobilde "Ana ekrana ekle" banner'ı — tüm sayfalarda tek yerden */}
    <InstallPrompt />
  </>
);

// --- ROUTER ---
const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: "/", element: <LandingPage /> },
      { path: "/feed", element: <FeedPage /> },
      { path: "/authors", element: <AuthorsPage /> },
      { path: "/printed-books", element: <PrintedBooksPage /> },
      { path: "/about", element: <AboutPage /> },
      { path: "/contact", element: <ContactPage /> },
      { path: "/terms", element: <LegalPage kind="terms" /> },
      { path: "/privacy", element: <LegalPage kind="privacy" /> },
      { path: "/newsletter", element: <NewsletterPage /> },
      { path: "/yazar/:username", element: <PublicContentRoute type="PROFILE"><UserProfilePage /></PublicContentRoute> },
      { path: "/kitap/:slug", element: <PublicContentRoute type="BOOK"><BookDetailPage /></PublicContentRoute> },
      { path: "/kitap/:slug/oku", element: <Layout><PublicContentRoute type="BOOK" reader><BookReader /></PublicContentRoute></Layout> },
      { path: "/kitap/:slug/bolum/:chapterSlug", element: <Layout><PublicContentRoute type="BOOK" reader><BookReader /></PublicContentRoute></Layout> },
      { path: "/oturum/:slug", element: <PublicContentRoute type="SESSION"><SessionDetail /></PublicContentRoute> },
      { path: "/book-detail/:id", element: <PublicContentRoute type="BOOK" legacy><BookDetailPage /></PublicContentRoute> },
      { path: "/book-reader/:bookId", element: <Layout><PublicContentRoute type="BOOK" legacy reader><BookReader /></PublicContentRoute></Layout> },

      { path: "/create-book",
        element: <ProtectedRoute><CreateBookPage /></ProtectedRoute>
      },
      { path: "/dashboard/:bookId",
        element: <ProtectedRoute><BookDashboard /></ProtectedRoute>
      },
      { path: '/print/:bookId', element: <ProtectedRoute><PrintApplicationPage /></ProtectedRoute> },
      { path: '/funding-history', element: <ProtectedRoute><FundingHistoryPage /></ProtectedRoute> },
      { path: "/profile",
        element: <ProtectedRoute><UserProfilePage /></ProtectedRoute>
      },

      { path: "/user/:userId", element: <PublicContentRoute type="PROFILE" legacy><UserProfilePage /></PublicContentRoute> },
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      // Google'ın redirect akışında (ux_mode="redirect") backend
      // /auth/google/callback doğrulamayı bitirince tarayıcıyı buraya
      // ?token=...&user=... ile yönlendirir.
      { path: "/auth/callback", element: <GoogleCallback /> },
      { path: "/sifremi-unuttum", element: <ForgotPasswordPage /> },
      { path: "/forgot-password", element: <Navigate to="/sifremi-unuttum" replace /> },
      { path: "/reset-password/:token", element: <ResetPasswordPage /> },
      { path: "/donate/:bookId", element: <ProtectedRoute><DonationPage /></ProtectedRoute> },
      { path: "/payment/success", element: <ProtectedRoute><PaymentSuccess /></ProtectedRoute> },
      { path: "/payment/failure", element: <PaymentFailure /> },
      { path: "/quotes", element: <QuotesPage /> },
      { path: '/quotes/:quoteId', element: <QuoteDetail /> },
      { path: "/leaderboard", element: <LeaderboardPage /> },

      // Messages — ProtectedRoute ile sar, giriş yapılmamışsa login'e yönlendir
      { path: "/messages",
        element: <ProtectedRoute><MessagesPage /></ProtectedRoute>
      },
      { path: "/messages/:conversationId",
        element: <ProtectedRoute><MessagesPage /></ProtectedRoute>
      },

      { path: "/sessions", element: <SessionsPage /> },
      { path: "/sessions/:sessionId", element: <PublicContentRoute type="SESSION" legacy><SessionDetail /></PublicContentRoute> },

      { path: "/admin",
        element: <AdminRoute><AdminDashboard /></AdminRoute>
      },
      { path: '/admin/genres', element: <AdminRoute><AdminData resource="Genre" /></AdminRoute> },
      { path: '/admin/data', element: <AdminRoute><AdminData /></AdminRoute> },
      { path: '/admin/data/:resource', element: <AdminRoute><AdminData /></AdminRoute> },
      { path: '/admin/schemas', element: <AdminRoute><AdminData schema /></AdminRoute> },
      { path: "/admin/users",
        element: <AdminRoute><AdminUsers /></AdminRoute>
      },
      { path: "/admin/books",
        element: <AdminRoute><AdminBooks /></AdminRoute>
      },
      { path: '/admin/printed-books', element: <AdminRoute><AdminPrintedBooks /></AdminRoute> },
      { path: '/admin/print-funding', element: <AdminRoute><AdminPrintFundingPage /></AdminRoute> },
      { path: '/admin/session-access', element: <AdminRoute><AdminSessionAccess /></AdminRoute> },
      { path: "/admin/transactions",
        element: <AdminRoute><AdminTransactions /></AdminRoute>
      },
      { path: "*", element: <NotFoundPage /> }
    ]
  }
]);

function App() {
  return (
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID || "620840983651-ue12o2dcdbr9o7iv0dkmhj4ed6vstno4.apps.googleusercontent.com"}>
      <ApolloProvider client={client}>
        <AuthProvider>
          <ReadingPreferencesProvider>
            <ToastProvider>
              <FiltersProvider>
                <RouterProvider router={router} future={{ v7_startTransition: true }} />
              </FiltersProvider>
            </ToastProvider>
          </ReadingPreferencesProvider>
        </AuthProvider>
      </ApolloProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
