import { useState } from "react"
import { Header } from "@/components/Header"
import { SearchPage } from "@/components/SearchPage"
import { Footer } from "@/components/Footer"
import { datasets } from "@/datasets"

function App() {
  const [selectedId, setSelectedId] = useState(datasets[0].id)
  const selected = datasets.find((d) => d.id === selectedId) ?? datasets[0]

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Header datasets={datasets} selected={selected} onSelect={setSelectedId} />
      <div className="flex-1">
        <SearchPage dataset={selected} />
      </div>
      <Footer />
    </div>
  )
}

export default App
