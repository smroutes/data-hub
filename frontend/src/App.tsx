import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { Header } from "@/components/Header"
import { SearchPage } from "@/components/SearchPage"
import { Footer } from "@/components/Footer"
import { datasets } from "@/datasets"
import { AuthProvider } from "@/lib/AuthContext"
import { ProtectedRoute } from "@/lib/ProtectedRoute"
import { SessionExpiredModal } from "@/components/SessionExpiredModal"
import { Login } from "@/pages/Login"
import { CitizensDashboard } from "@/pages/CitizensDashboard"
import { ApplicationsTablePage } from "@/pages/ApplicationsTablePage"
import { NotFound } from "@/pages/NotFound"

function Search() {
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
          <Route path="/" element={<Navigate to="/as/search" replace />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/as/search"
            element={
              <ProtectedRoute>
                <Search />
              </ProtectedRoute>
            }
          />
          <Route
            path="/as/applications"
            element={
              <ProtectedRoute>
                <ApplicationsTablePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/citizens"
            element={
              <ProtectedRoute>
                <CitizensDashboard />
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
