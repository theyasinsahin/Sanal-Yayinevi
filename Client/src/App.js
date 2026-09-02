import React from 'react';
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
import { onError } from "@apollo/client/link/error";
import { setContext } from "@apollo/client/link/context";
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from "react-router-dom";

import { AuthProvider, useAuth } from './context/AuthContext';
import { FiltersProvider } from "./context/FiltersContext";
import { ToastProvider } from './context/ToastContext';

import ScrollToTop from './components/ScrollToTop';

import NavigationBar from "./components/Navigation/NavigationBar";

import LandingPage from "./pages/Landing";
import FeedPage from "./pages/Feed";
import BookDetailPage from "./pages/BookDetail";
import BookReader from "./pages/BookReader";
import CreateBookPage from "./pages/CreateBookPage";
import BookDashboard from "./pages/BookDashboard";
import UserProfilePage from "./pages/UserProfilePage";
import LoginPage from "./pages/Auth/Login";
import RegisterPage from "./pages/Auth/Register";
import GoogleCallback from "./pages/Auth/GoogleCallback";
import DonationPage from "./pages/DonationPage";
import PaymentSuccess from "./pages/PaymentResult/PaymentSuccess";
import PaymentFailure from "./pages/PaymentResult/PaymentFailure";
import ForgotPasswordPage from './pages/Auth/ForgotPassword';
import ResetPasswordPage from './pages/Auth/ResetPassword';
import QuotesPage from './pages/QuotesPage';
import LeaderboardPage from './pages/LeaderboardPage';
import MessagesPage from './pages/MessagesPage';
import SessionsPage  from './pages/SessionsPage';
import SessionDetail from './pages/SessionDetail';
import NotFoundPage from './pages/NotFoundPage';

import AdminDashboard from './pages/Admin/Dashboard';
import AdminUsers from './pages/Admin/Users';
import AdminBooks from './pages/Admin/Books';
import AdminRoute from './components/Route/AdminRoute';
import AdminTransactions from './pages/Admin/Transactions';

import { GoogleOAuthProvider } from '@react-oauth/google';
import { ME_QUERY } from './graphql/queries/user';

import { ThemeProvider } from './context/ThemeContext';


// --- APOLLO SETUP ---
// Backend adresi artık koda sabit yazılmıyor; .env dosyasından okunuyor.
// REACT_APP_API_URL tanımlı değilse (örn. .env dosyası unutulduysa)
// geliştirme ortamında localhost'a düşer, böylece eski davranış bozulmaz.
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const WS_URL  = process.env.REACT_APP_WS_URL  || "ws://localhost:5000/graphql";

const httpLink = createHttpLink({
  uri: API_URL,
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem("token");
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    },
  };
});

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, extensions }) => {
      if (
        message.includes("jwt expired") ||
        (extensions && extensions.code === "UNAUTHENTICATED")
      ) {
        console.log("Oturum süresi doldu, çıkış yapılıyor...");
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
      }
    });
  }
});

// WebSocket link — sadece subscription operasyonları buradan geçer
const wsLink = new GraphQLWsLink(
  createClient({
    url: WS_URL,
    connectionParams: () => ({
      authorization: localStorage.getItem("token")
        ? `Bearer ${localStorage.getItem("token")}`
        : "",
    }),
    shouldRetry: () => !!localStorage.getItem("token"),
    retryAttempts: 5,
  })
);

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
  errorLink.concat(authLink).concat(httpLink)
);

const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
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

// --- ROOT LAYOUT ---
// RouterProvider'ın render ettiği tüm route'ların ortak atası.
// ScrollToTop burada, Router context'inin İÇİNDE render edilir,
// bu yüzden useLocation() güvenle çalışır. Outlet, aşağıdaki
// children route'larının render edileceği yeri belirtir.
const RootLayout = () => (
  <>
    <ScrollToTop />
    <Outlet />
  </>
);

// --- ROUTER ---
const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: "/", element: <LandingPage /> },
      { path: "/feed", element: <FeedPage /> },
      { path: "/book-detail/:id", element: <Layout><BookDetailPage /></Layout> },
      { path: "/book-reader/:bookId", element: <Layout><BookReader /></Layout> },

      { path: "/create-book",
        element: <ProtectedRoute><CreateBookPage /></ProtectedRoute>
      },
      { path: "/dashboard/:bookId",
        element: <ProtectedRoute><BookDashboard /></ProtectedRoute>
      },
      { path: "/profile",
        element: <ProtectedRoute><UserProfilePage /></ProtectedRoute>
      },

      { path: "/user/:userId", element: <UserProfilePage /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      // Google'ın redirect akışında (ux_mode="redirect") backend
      // /auth/google/callback doğrulamayı bitirince tarayıcıyı buraya
      // ?token=...&user=... ile yönlendirir.
      { path: "/auth/callback", element: <GoogleCallback /> },
      { path: "/sifremi-unuttum", element: <ForgotPasswordPage /> },
      { path: "/reset-password/:token", element: <ResetPasswordPage /> },
      { path: "/donate/:bookId", element: <DonationPage /> },
      { path: "/payment/success", element: <PaymentSuccess /> },
      { path: "/payment/failure", element: <PaymentFailure /> },
      { path: "/quotes", element: <QuotesPage /> },
      { path: "/leaderboard", element: <LeaderboardPage /> },

      // Messages — ProtectedRoute ile sar, giriş yapılmamışsa login'e yönlendir
      { path: "/messages",
        element: <ProtectedRoute><MessagesPage /></ProtectedRoute>
      },
      { path: "/messages/:conversationId",
        element: <ProtectedRoute><MessagesPage /></ProtectedRoute>
      },

      { path: "/sessions", element: <SessionsPage /> },
      { path: "/sessions/:sessionId", element: <SessionDetail /> },

      { path: "/admin",
        element: <AdminRoute><AdminDashboard /></AdminRoute>
      },
      { path: "/admin/users",
        element: <AdminRoute><AdminUsers /></AdminRoute>
      },
      { path: "/admin/books",
        element: <AdminRoute><AdminBooks /></AdminRoute>
      },
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
          <ThemeProvider>
            <ToastProvider>
              <FiltersProvider>
                <RouterProvider router={router} future={{ v7_startTransition: true }} />
              </FiltersProvider>
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
      </ApolloProvider>
    </GoogleOAuthProvider>
  );
}

export default App;