import { createBrowserRouter, RouterProvider } from "react-router-dom";
import NavigationBar from "./components/NavigationBar";
import LandingPage from "./components/Landing";
import FeedPage from "./components/Feed";
import { FiltersProvider } from "./context/FiltersContext";
import BookDetailPage from "./components/BookDetailPage";
import BookReader from "./components/BookReader";
import CreateBookPage from "./components/CreateBookPage";

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
