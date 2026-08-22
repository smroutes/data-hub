import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Header } from "@/components/Header"
import { SearchPage } from "@/components/SearchPage"
import { Footer } from "@/components/Footer"
import { datasets } from "@/datasets"
import { AuthProvider } from "@/lib/AuthContext"
import { ProtectedRoute } from "@/lib/ProtectedRoute"
import { useDocumentTitle } from "@/lib/useDocumentTitle"
import { SessionExpiredModal } from "@/components/SessionExpiredModal"
import { Login } from "@/pages/Login"
import { Home } from "@/pages/Home"
import { CitizensDashboard } from "@/pages/CitizensDashboard"
import { ApplicationsTablePage } from "@/pages/ApplicationsTablePage"
import { AdminPage } from "@/pages/AdminPage"
import { NotFound } from "@/pages/NotFound"

function Search() {
  useDocumentTitle("Search")
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Header />
      <div className="flex-1">
        <SearchPage dataset={datasets[0]} />
      </div>
      <Footer />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SessionExpiredModal />
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route
            path="/as/search"
            element={
              <ProtectedRoute page="search">
                <Search />
              </ProtectedRoute>
            }
          />
          <Route
            path="/as/applications"
            element={
              <ProtectedRoute page="applications">
                <ApplicationsTablePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/citizens"
            element={
              <ProtectedRoute page="citizens">
                <CitizensDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
