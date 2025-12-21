import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  createHttpLink
} from "@apollo/client";

import { setContext } from "@apollo/client/link/context";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";

import NavigationBar from "./components/NavigationBar";

import LandingPage from "./pages/Landing";
import FeedPage from "./pages/Feed";
import BookDetailPage from "./pages/BookDetailPage";
import BookReader from "./pages/BookReader";
import CreateBookPage from "./pages/CreateBookPage";
import BookDashboard from "./pages/BookDashboard";
import MyProfilePage from "./pages/MyProfilePage";
import UserProfilePage from "./pages/UserProfilePage";
import LoginPage from "./pages/Auth/Login";
import RegisterPage from "./pages/Auth/Register";

import { FiltersProvider } from "./context/FiltersContext";


const httpLink = createHttpLink({
  uri: "http://localhost:5000",
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem("token");
  return {
    headers: {
      ...headers,
      authorization: token ? `${token}` : "",
    },
  };
});

const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});

const Layout = ({ children }) => (
  <div className="App">
    <NavigationBar />
    {children}
  </div>
);

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const router = createBrowserRouter([
  { path: "/", element: <Layout><LandingPage /></Layout> },
  { path: "/feed", element: <Layout><FeedPage /></Layout> },
  { path: "/book-detail/:id", element: <Layout><BookDetailPage /></Layout> },
  { path: "/book-reader/:bookId", element: <Layout><BookReader /></Layout> },
  
  { path: "/create-book", 
    element:  <ProtectedRoute>
                <Layout><CreateBookPage /></Layout>
              </ProtectedRoute> 
              },

  { path: "/dashboard/:bookId", 
    element: <ProtectedRoute>
      <Layout><BookDashboard /></Layout> 
      </ProtectedRoute>
      },

  { path: "/profile", 
    element: <ProtectedRoute>
    <Layout><MyProfilePage /></Layout> 
    </ProtectedRoute>
    },

  { path: "/user/:userId", element: <Layout><UserProfilePage /></Layout> },
  { path: "/login", element: <Layout><LoginPage /></Layout> },
  { path: "/register", element: <Layout><RegisterPage /></Layout> }
]);

function App() {
  return (
    <ApolloProvider client={client}>
      <FiltersProvider>
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
      </FiltersProvider>
    </ApolloProvider>
  );
}

export default App;
