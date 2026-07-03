import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import CategoriasPage from "./pages/CategoriasPage";
import DashboardPage from "./pages/DashboardPage";
import ObraDetailPage from "./pages/ObraDetailPage";
import ObrasPage from "./pages/ObrasPage";
import SettingsPage from "./pages/SettingsPage";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<ObrasPage />} />
            <Route path="/obras/:id" element={<ObraDetailPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/categorias" element={<CategoriasPage />} />
            <Route path="/configuracoes" element={<SettingsPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
