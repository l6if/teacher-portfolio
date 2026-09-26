'use client'

import { useScope } from '@/hooks/use-data'
import { ProfileSection } from './section-parts/profile'
import { PageHeader } from '@/components/shared/page-header'

/** عرض مباشر للبيانات المهنية (يستخدمه المدير ضمن وضع القراءة) */
export function ProfileView() {
  const { readonly } = useScope()
  return (
    <div>
      <PageHeader
        crumbs={[{ label: 'البيانات المهنية' }]}
        title="البيانات المهنية"
        description="هوية المعلم المهنية — المؤهل والتخصص والخبرة والمهام."
        icon="UserRound"
      />
      <ProfileSection readonly={readonly} />
    </div>
  )
}
