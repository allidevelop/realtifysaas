import type { CollectionConfig } from 'payload'

// Users — auth-коллекция (ТЗ §8.2). Роли/организации расширяются на этапе 5.
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  fields: [
    // email/password добавляются авто (auth: true).
  ],
}
