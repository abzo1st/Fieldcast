// Client entry: mounts the app on #root and loads global styles.

import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

// `root` is the mount point defined in index.html.
createRoot(document.getElementById("root")!).render(<App />);
  