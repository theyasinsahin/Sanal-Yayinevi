import { createBrowserRouter, RouterProvider } from "react-router-dom";
import NavigationBar from "./components/NavigationBar";
import LandingPage from "./components/Landing";
import FeedPage from "./components/Feed";
import { FiltersProvider } from "./context/FiltersContext";

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
]);

function App() {
  return (
    <FiltersProvider>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </FiltersProvider>
  );
}

export default App;
