import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
async function main() {
  const users = await db.user.findMany({ select: { email: true, role: true, updatedAt: true, lastLoginAt: true, createdAt: true } })
  const rows = users.map(u => ({
    email: u.email, role: u.role,
    updated: u.updatedAt ? new Date(u.updatedAt).toISOString() : 'null',
    lastLogin: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : 'never',
    created: u.createdAt ? new Date(u.createdAt).toISOString() : 'null',
  })).sort((a, b) => a.updated.localeCompare(b.updated))
  for (const r of rows) console.log(`${r.email.padEnd(25)} ${r.role.padEnd(12)} updated=${r.updated} lastLogin=${r.lastLogin}`)
}
main().finally(() => db.$disconnect())
