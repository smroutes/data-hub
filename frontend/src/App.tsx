import { useState } from "react"
import { Header } from "@/components/Header"
import { SearchPage } from "@/components/SearchPage"
import { datasets } from "@/datasets"

function App() {
  const [selectedId, setSelectedId] = useState(datasets[0].id)
  const selected = datasets.find((d) => d.id === selectedId) ?? datasets[0]

  return (
    <div className="min-h-svh bg-background">
      <Header datasets={datasets} selected={selected} onSelect={setSelectedId} />
      <SearchPage dataset={selected} />
    </div>
  )
}

export default App
