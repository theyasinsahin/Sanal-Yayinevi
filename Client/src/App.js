import { createBrowserRouter, RouterProvider } from "react-router-dom";
import NavigationBar from "./components/NavigationBar";
import LandingPage from "./pages/Landing";
import FeedPage from "./pages/Feed";
import { FiltersProvider } from "./context/FiltersContext";
import BookDetailPage from "./pages/BookDetailPage";
import BookReader from "./pages/BookReader";
import CreateBookPage from "./pages/CreateBookPage";
import BookDashboard from "./pages/BookDashboard";

const Layout = ({ children }) => (
  <div className="App">
    <NavigationBar />
    {children}
  </div>
);

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout><LandingPage /></Layout>,
  },
  {
    path: "/feed",
    element: <Layout><FeedPage /></Layout>,
  },
  {
    path: "/book-detail",
    element: <Layout><BookDetailPage /></Layout>
  },
  {
    path: "/book-reader",
    element: <Layout><BookReader/></Layout>
  },
  {
    path: "/create-book",
    element: <Layout><CreateBookPage/></Layout>
  },
  {
    path: "/dashboard",
    element: <Layout><BookDashboard/></Layout>
  }
]);

function App() {
  return (
    <FiltersProvider>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </FiltersProvider>
  );
}

export default App;
