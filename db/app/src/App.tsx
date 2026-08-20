import { BrowserRouter, Routes, Route } from "react-router-dom"
import { AuthProvider } from "@/lib/AuthContext"
import { ProtectedRoute } from "@/lib/ProtectedRoute"
import { Login } from "@/pages/Login"
import { Dashboard } from "@/pages/Dashboard"

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
