import type { ComponentType } from 'react'

export type PocEntry = {
  id: string
  label: string
  description?: string
  component: ComponentType
}
