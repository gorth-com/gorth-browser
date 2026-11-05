import { StrictMode } from "react";
import { ConfirmationProvider } from "@/providers/confirmation";
import { QueryProvider } from "@/providers/query";
import { createRoot } from "react-dom/client";
import { PortalProvider } from "@/providers/portal";
import { MenuPortal } from "@/providers/menu";
import { TooltipProvider } from "@/providers/tooltip";
import { ToasterProvider } from "@/providers/toaster";
import Application from "@/app";
import { AuthProvider } from "@/providers/auth";
import "@/styles/globals.css";
import "@/lib/http/renderer";
const root = document.getElementById("root");
if (!root) throw new Error("The #root element was not found in index.html.");
createRoot(root).render(
  <StrictMode>
    <QueryProvider>
      <PortalProvider>
        <TooltipProvider>
          <ToasterProvider>
            <ConfirmationProvider>
              <AuthProvider>
                <Application />
                <MenuPortal />
              </AuthProvider>
            </ConfirmationProvider>
          </ToasterProvider>
        </TooltipProvider>
      </PortalProvider>
    </QueryProvider>
  </StrictMode>,
);
