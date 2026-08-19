export interface Dataset {
  id: string
  title: string
  description: string
  searchableBy: string[]
  available: boolean
}

// Add more entries here as new datasets/report sources come online.
export const datasets: Dataset[] = [
  {
    id: "annapurna",
    title: "Annapurna Scheme",
    description: "Constituency report search",
    searchableBy: ["Application Number", "Phone Number", "Name"],
    available: true,
  },
  {
    id: "bangla-awas-yojana",
    title: "Bangla Awas Yojana",
    description: "Housing scheme report search",
    searchableBy: ["Application Number", "Phone Number", "Name"],
    available: false,
  },
]
