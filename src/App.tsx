import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Dashboard from "./pages/Dashboard";
import CompanyDetail from "./pages/CompanyDetail";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import MarketTicker from "./components/MarketTicker";

const queryClient = new QueryClient();

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <ScrollToTop />
      <MarketTicker />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/company/:ticker" element={<CompanyDetail />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
