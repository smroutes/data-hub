import { useState } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { Header } from "@/components/Header"
import { SearchPage } from "@/components/SearchPage"
import { Footer } from "@/components/Footer"
import { datasets } from "@/datasets"
import { CitizensAuthProvider } from "@/lib/CitizensAuthContext"
import { CitizensProtectedRoute } from "@/lib/CitizensProtectedRoute"
import { CitizensLogin } from "@/pages/CitizensLogin"
import { CitizensDashboard } from "@/pages/CitizensDashboard"

function Search() {
  const [selectedId, setSelectedId] = useState(datasets[0].id)
  const selected = datasets.find((d) => d.id === selectedId) ?? datasets[0]

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Header datasets={datasets} selected={selected} onSelect={setSelectedId} />
      <div className="flex-1">
        <SearchPage key={selected.id} dataset={selected} />
      </div>
      <Footer />
    </div>
  )
}

// Only /login and /citizens talk to the citizen-records stack -- keep that
// context (and its network call on mount) out of the /search route.
function CitizensSection({ children }: { children: React.ReactNode }) {
  return <CitizensAuthProvider>{children}</CitizensAuthProvider>
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/search" replace />} />
        <Route path="/search" element={<Search />} />
        <Route
          path="/login"
          element={
            <CitizensSection>
              <CitizensLogin />
            </CitizensSection>
          }
        />
        <Route
          path="/citizens"
          element={
            <CitizensSection>
              <CitizensProtectedRoute>
                <CitizensDashboard />
              </CitizensProtectedRoute>
            </CitizensSection>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
