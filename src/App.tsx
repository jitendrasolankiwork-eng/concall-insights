import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Dashboard from "./pages/Dashboard";
import CompanyDetail from "./pages/CompanyDetail";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import ForgotPassword from "./pages/ForgotPassword";
import MarketTicker from "./components/MarketTicker";
import { AuthProvider } from "./lib/auth";

const queryClient = new QueryClient();

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <MarketTicker />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/company/:ticker" element={<CompanyDetail />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
