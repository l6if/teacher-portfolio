'use client'

import { useScope, useSession } from '@/hooks/use-data'
import { ProfileSection } from './section-parts/profile'
import { PageHeader } from '@/components/shared/page-header'
import { getGenderedLabels } from '@/lib/gender'

/** عرض مباشر للبيانات المهنية (يستخدمه المدير ضمن وضع القراءة) */
export function ProfileView() {
  const { readonly } = useScope()
  const { data: session } = useSession()
  const labels = getGenderedLabels(session?.user?.gender)
  return (
    <div>
      <PageHeader
        crumbs={[{ label: 'البيانات المهنية' }]}
        title="البيانات المهنية"
        description={`هوية ${labels.theTeacher} المهنية — المؤهل والتخصص والخبرة والمهام.`}
        icon="UserRound"
      />
      <ProfileSection readonly={readonly} />
    </div>
  )
}
