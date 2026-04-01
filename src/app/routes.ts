// `/` is the landing page, whereas `/dashboard` and `/location/:slug` both render the weather dashboard.

import { createBrowserRouter } from "react-router";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";

export const router = createBrowserRouter([
  {
    // Public marketing page; search sends people to `/location/...` with query params.
    path: "/",
    Component: Landing,
  },
  {
    // Same dashboard as `/location/:slug`, useful if you open `/dashboard` directly.
    path: "/dashboard",
    Component: Dashboard,
  },
  {
    // Slug is for readable URLs; lat/lon and display name still come from `?name=&lat=&lon=`.
    path: "/location/:slug",
    Component: Dashboard,
  },
]);
