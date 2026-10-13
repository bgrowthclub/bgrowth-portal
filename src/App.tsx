import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthContext";
import { ThemeProvider } from "@/hooks/useTheme";
import { router } from "@/app/routes";
import { initAnalytics, trackPageView } from "@/lib/analytics";

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

export default function App() {
  useEffect(() => {
    initAnalytics(GA_MEASUREMENT_ID);
    const trackCurrentRoute = () => {
      trackPageView(router.state.location.pathname, GA_MEASUREMENT_ID);
    };
    trackCurrentRoute();
    return router.subscribe(trackCurrentRoute);
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  );
}
