import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ token: string }>
  searchParams: Promise<{ r?: string }>
}

// /rsvp/[token] — redirect to API handler which records and redirects to confirmed
export default async function RsvpPage({ params, searchParams }: Props) {
  const { token } = await params
  const { r } = await searchParams

  if (!r || !['yes', 'no'].includes(r)) {
    redirect('/')
  }

  redirect(`/api/rsvp/${token}?r=${r}`)
}
