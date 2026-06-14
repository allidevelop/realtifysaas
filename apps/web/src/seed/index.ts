/**
 * Запуск seed через `payload run` (pnpm --filter web seed).
 * Если на вашей версии Node `payload run` несовместим с tsx — используйте
 * route GET /seed?secret=$PAYLOAD_SECRET (та же логика runSeed, рантайм Next).
 */
import config from '@payload-config'
import { getPayload } from 'payload'

import { runSeed } from './seed'

const payload = await getPayload({ config })
await runSeed(payload)
process.exit(0)
