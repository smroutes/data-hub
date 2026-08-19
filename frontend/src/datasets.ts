export interface SelectOption {
  value: string
  label: string
}

export interface SearchField {
  param: string
  label: string
  type: "text" | "select"
  placeholder?: string
  options?: SelectOption[]
}

export interface Dataset {
  id: string
  title: string
  description: string
  available: boolean
  fields: SearchField[]
}

// Add more entries here as new datasets/report sources come online.
export const datasets: Dataset[] = [
  {
    id: "annapurna",
    title: "Annapurna Scheme",
    description: "Constituency report search",
    available: true,
    fields: [
      {
        param: "q",
        label: "Search",
        type: "text",
        placeholder: "Search by Application Number, Phone Number, Name",
      },
    ],
  },
  {
    id: "bangla-awas-yojana",
    title: "Bangla Awas Yojana",
    description: "Housing scheme report search",
    available: false,
    fields: [
      {
        param: "q",
        label: "Search",
        type: "text",
        placeholder: "Search by Application Number, Phone Number, Name",
      },
    ],
  },
  {
    id: "booth-president",
    title: "Booth President Data",
    description: "Gourbazar & Gogla booth president search",
    available: true,
    fields: [
      {
        param: "gp",
        label: "GP",
        type: "select",
        options: [
          { value: "GOURBAZAR", label: "Gourbazar" },
          { value: "GOGLA", label: "Gogla" },
        ],
      },
      {
        param: "booth_no",
        label: "Booth No",
        type: "text",
        placeholder: "e.g. 177",
      },
    ],
  },
]
