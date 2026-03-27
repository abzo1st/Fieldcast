import { createBrowserRouter } from "react-router";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Landing,
  },
  {
    path: "/dashboard",
    Component: Dashboard,
  },
  {
    path: "/location/:slug",
    Component: Dashboard,
  },
]);
