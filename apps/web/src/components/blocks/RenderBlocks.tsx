import { Fragment } from 'react'

import type { Page } from '@/payload-types'

import { CTABlock } from './CTABlock'
import { FeatureGridBlock } from './FeatureGridBlock'
import { HeroBlock } from './HeroBlock'
import { PartnersBlock } from './PartnersBlock'
import { PricingBlock } from './PricingBlock'
import { RichTextBlock } from './RichTextBlock'
import { StatsBlock } from './StatsBlock'
import { TeamBlock } from './TeamBlock'
import { ToolsBlock } from './ToolsBlock'

type Block = Page['layout'][number]

// Диспетчер блоков конструктора страниц (ТЗ §8.3).
// Async-блоки (Tools/Pricing/Team/Partners) рендерятся как server components.
function renderBlock(block: Block) {
  switch (block.blockType) {
    case 'hero':
      return <HeroBlock {...block} />
    case 'stats':
      return <StatsBlock {...block} />
    case 'featureGrid':
      return <FeatureGridBlock {...block} />
    case 'toolsShowcase':
      return <ToolsBlock {...block} />
    case 'pricing':
      return <PricingBlock {...block} />
    case 'richText':
      return <RichTextBlock {...block} />
    case 'team':
      return <TeamBlock {...block} />
    case 'partners':
      return <PartnersBlock {...block} />
    case 'cta':
      return <CTABlock {...block} />
    default:
      return null
  }
}

export function RenderBlocks({ blocks }: { blocks: Page['layout'] }) {
  if (!blocks || blocks.length === 0) return null
  return (
    <>
      {blocks.map((block, i) => (
        <Fragment key={block.id ?? i}>{renderBlock(block)}</Fragment>
      ))}
    </>
  )
}
