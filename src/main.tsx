import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { disableWebPush } from "@/lib/push";

// S33: retire web push — unsubscribe/unregister any leftover browser push so
// reminders come only from the native app.
disableWebPush();

createRoot(document.getElementById("root")!).render(<App />);
