import { useState } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { Header } from "@/components/Header"
import { SearchPage } from "@/components/SearchPage"
import { Footer } from "@/components/Footer"
import { datasets } from "@/datasets"
import { AuthProvider } from "@/lib/AuthContext"
import { ProtectedRoute } from "@/lib/ProtectedRoute"
import { Login } from "@/pages/Login"
import { CitizensDashboard } from "@/pages/CitizensDashboard"
import { NewApplication } from "@/pages/NewApplication"
import { ApplicationDetail } from "@/pages/ApplicationDetail"

function Search() {
  const [selectedId, setSelectedId] = useState(datasets[0].id)
  const selected = datasets.find((d) => d.id === selectedId) ?? datasets[0]

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Header />
      <div className="flex-1">
        <SearchPage
          key={selected.id}
          dataset={selected}
          datasets={datasets}
          onSelectDataset={setSelectedId}
        />
      </div>
      <Footer />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/search" replace />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <Search />
              </ProtectedRoute>
            }
          />
          <Route
            path="/applications/new"
            element={
              <ProtectedRoute>
                <NewApplication />
              </ProtectedRoute>
            }
          />
          <Route
            path="/applications/:id"
            element={
              <ProtectedRoute>
                <ApplicationDetail />
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
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
