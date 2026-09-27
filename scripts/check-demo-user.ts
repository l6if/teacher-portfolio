import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const u = await prisma.user.findUnique({ where: { email: 'demo@madrasati.sa' } })
  if (!u) { console.log('DEMO USER NOT FOUND'); return }
  console.log(JSON.stringify({
    email: u.email, role: u.role, status: u.status, isDemo: u.isDemo,
    hasPasswordHash: typeof u.passwordHash === 'string' && u.passwordHash.length > 0,
    hashFormat: u.passwordHash ? u.passwordHash.split(':')[0] + ':' + u.passwordHash.split(':')[1] + ' (len=' + u.passwordHash.length + ')' : null,
    school: u.school ?? null, createdAt: u.createdAt, updatedAt: u.updatedAt
  }, null, 2))
}
main().finally(() => prisma.$disconnect())
