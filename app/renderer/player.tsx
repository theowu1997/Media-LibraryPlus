import React from "react";
import { createRoot } from "react-dom/client";
import PlayerWindow from "./src/components/PlayerWindow";

const root = createRoot(document.getElementById("root")!);
root.render(<PlayerWindow />);
