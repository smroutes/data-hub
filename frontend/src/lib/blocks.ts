// CD Block dropdown for the New Application form. Pandabeswar is pinned to
// the top (most of this office's applications come from there), followed
// by the rest of Paschim Bardhaman -- the only district this office covers.
export interface BlockGroup {
  label: string
  blocks: string[]
}

export const BLOCK_GROUPS: BlockGroup[] = [
  { label: "Pandabeswar", blocks: ["Pandabeswar"] },
  {
    label: "Paschim Bardhaman (other blocks)",
    blocks: [
      "Andal",
      "Faridpur-Durgapur",
      "Kanksa",
      "Salanpur",
      "Barabani",
      "Jamuria",
      "Raniganj",
    ],
  },
]
