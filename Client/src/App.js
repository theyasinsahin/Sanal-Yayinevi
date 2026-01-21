import React from 'react';
import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  createHttpLink
} from "@apollo/client";

import { onError } from "@apollo/client/link/error";

import { setContext } from "@apollo/client/link/context";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";

// IMPORT: Context
import { AuthProvider, useAuth } from './context/AuthContext';
import { FiltersProvider } from "./context/FiltersContext";

import NavigationBar from "./components/Navigation/NavigationBar";

import LandingPage from "./pages/Landing";
import FeedPage from "./pages/Feed";
import BookDetailPage from "./pages/BookDetail";
import BookReader from "./pages/BookReader";
import CreateBookPage from "./pages/CreateBookPage";
import BookDashboard from "./pages/BookDashboard";
import MyProfilePage from "./pages/MyProfilePage";
import UserProfilePage from "./pages/UserProfilePage";
import LoginPage from "./pages/Auth/Login";
import RegisterPage from "./pages/Auth/Register";
import DonationPage from "./pages/DonationPage";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentFailure from "./pages/PaymentFailure";

// --- APOLLO SETUP (Burası Aynı Kalıyor) ---
const httpLink = createHttpLink({
  uri: "http://localhost:5000",
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem("token");
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "", // 'Bearer ' eklemek standarttır
    },
  };
});

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, extensions }) => {
      // Eğer hata "Unauthenticated" veya "jwt expired" içeriyorsa
      if (message.includes("jwt expired") || (extensions && extensions.code === 'UNAUTHENTICATED')) {
        console.log("Oturum süresi doldu, çıkış yapılıyor...");
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
        // İsteğe bağlı: Sayfayı yenile veya login'e at
        // window.location.href = "/login"; 
      }
    });
  }
});

const client = new ApolloClient({
  link: errorLink.concat(authLink).concat(httpLink),
  cache: new InMemoryCache(),
});

// --- LAYOUT ---
const Layout = ({ children }) => (
  <div className="App">
    <NavigationBar />
    {children}
  </div>
);

// --- PROTECTED ROUTE (GÜNCELLENDİ) ---
// Artık localStorage'a değil, AuthContext'e bakıyor.
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Yükleniyor...</div>; // Veya bir Spinner bileşeni
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// --- ROUTER TANIMI ---
// ProtectedRoute'u element içinde kullanmaya devam ediyoruz.
// Router yapısı Provider'ın içinde render edildiği sürece sorun yok.
const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/feed", element: <FeedPage /> },
  { path: "/book-detail/:id", element: <Layout><BookDetailPage /></Layout> },
  { path: "/book-reader/:bookId", element: <Layout><BookReader /></Layout> },
  
  { path: "/create-book", 
    element: (
      <ProtectedRoute>
        <CreateBookPage />
      </ProtectedRoute> 
    )
  },

  { path: "/dashboard/:bookId", 
    element: (
      <ProtectedRoute>
        <BookDashboard />
      </ProtectedRoute>
    )
  },

  { path: "/profile", 
    element: (
      <ProtectedRoute>
        <MyProfilePage />
      </ProtectedRoute>
    )
  },

  { path: "/user/:userId", element: <UserProfilePage /> },

  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },

  { path: "/donate/:bookId", element: <DonationPage /> },
  { path: "/payment/success", element: <PaymentSuccess /> },
  { path: "/payment/failure", element: <PaymentFailure /> },
]);

function App() {
  return (
    <ApolloProvider client={client}>
      {/* AuthProvider EN DIŞTA (Apollo'nun içinde) OLMALI */}
      <AuthProvider>
        <FiltersProvider>
          <RouterProvider router={router} future={{ v7_startTransition: true }} />
        </FiltersProvider>
      </AuthProvider>
    </ApolloProvider>
  );
}

export default App;