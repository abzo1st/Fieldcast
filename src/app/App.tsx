// Application shell: React Router renders the page that matches the current URL.

import { RouterProvider } from "react-router";
import { router } from "./routes";
import React from "react";

export default function App() {
  // Concrete paths and page components are declared in routes.ts; this only attaches the router.
  return <RouterProvider router={router} />;
}
