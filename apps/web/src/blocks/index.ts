import type { Block } from 'payload'

import { CTA } from './CTA'
import { FeatureGrid } from './FeatureGrid'
import { Hero } from './Hero'
import { Partners } from './Partners'
import { Pricing } from './Pricing'
import { RichTextBlock } from './RichTextBlock'
import { Stats } from './Stats'
import { Team } from './Team'
import { ToolsShowcase } from './ToolsShowcase'

// Все блоки конструктора страниц (ТЗ §8.3).
export const layoutBlocks: Block[] = [
  Hero,
  Stats,
  FeatureGrid,
  ToolsShowcase,
  Pricing,
  RichTextBlock,
  Team,
  Partners,
  CTA,
]
