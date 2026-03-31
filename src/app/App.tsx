import { RouterProvider } from "react-router";
import { router } from "./routes";
import React from "react";

export default function App() {
  return <RouterProvider router={router} />;
}
