import { LicenseInfo } from "@mui/x-date-pickers-pro";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { FormProvider } from "./context/FormContext";
import { MatomoContextProvider } from "./context/MatomoContext";
import "./index.css";
import AppTheme from "./theme/AppTheme";
import { SnackbarProvider } from "notistack";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);
LicenseInfo.setLicenseKey(
  "63cdcff003c86a961f1b47b5703dd5e0Tz0wLEU9MjUzNDA0ODY0MDAwMDAwLFM9cHJlbWl1bSxMTT1zdWJzY3JpcHRpb24sS1Y9Mg=="
);

root.render(
  <MatomoContextProvider>
    <SnackbarProvider autoHideDuration={2000} preventDuplicate>
      <BrowserRouter>
        <FormProvider>
          <AppTheme>
            <App />
          </AppTheme>
        </FormProvider>
      </BrowserRouter>
    </SnackbarProvider>
  </MatomoContextProvider>
);
