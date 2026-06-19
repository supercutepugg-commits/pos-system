import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { MapPin, Phone } from 'lucide-react'

export default async function MerchantsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: merchants } = await supabase
    .from('merchants')
    .select('*, sales:profiles!merchants_sales_id_fkey(name)')
    .order('created_at', { ascending: false })

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">가맹점 ({merchants?.length ?? 0})</h1>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {merchants?.map(m => (
          <Link
            key={m.id}
            href={`/merchants/${m.id}`}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold text-gray-900">{m.business_name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{m.owner_name}</p>
              </div>
              {m.pos_model && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{m.pos_model}</span>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Phone size={11} />{m.phone}</span>
              <span className="flex items-center gap-1 truncate"><MapPin size={11} />{m.address}</span>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
              <span>영업: {(m.sales as any)?.name ?? '-'}</span>
              <span>{format(new Date(m.created_at), 'M/d', { locale: ko })}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
