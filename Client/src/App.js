import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  createHttpLink
} from "@apollo/client";

import { setContext } from "@apollo/client/link/context";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import NavigationBar from "./components/NavigationBar";

import LandingPage from "./pages/Landing";
import FeedPage from "./pages/Feed";
import BookDetailPage from "./pages/BookDetailPage";
import BookReader from "./pages/BookReader";
import CreateBookPage from "./pages/CreateBookPage";
import BookDashboard from "./pages/BookDashboard";
import MePage from "./pages/MePage";
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

const router = createBrowserRouter([
  { path: "/", element: <Layout><LandingPage /></Layout> },
  { path: "/feed", element: <Layout><FeedPage /></Layout> },
  { path: "/book-detail/:id", element: <Layout><BookDetailPage /></Layout> },
  { path: "/book-reader", element: <Layout><BookReader /></Layout> },
  { path: "/create-book", element: <Layout><CreateBookPage /></Layout> },
  { path: "/dashboard", element: <Layout><BookDashboard /></Layout> },
  { path: "/profile", element: <Layout><MePage /></Layout> },
  { path: "/candemir", element: <Layout><UserProfilePage /></Layout> },
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> }
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
