// CD Block dropdown for the New Application form -- this office only
// covers Pandabeswar and Faridpur-Durgapur.
export interface BlockGroup {
  label: string
  blocks: string[]
}

export const BLOCK_GROUPS: BlockGroup[] = [
  { label: "Pandabeswar", blocks: ["Pandabeswar"] },
  { label: "Faridpur-Durgapur", blocks: ["Faridpur-Durgapur"] },
]
