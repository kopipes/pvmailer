import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'

interface Props {
  params: Promise<{ token: string }>
  searchParams: Promise<{ r?: string; already?: string }>
}

export default async function RsvpConfirmedPage({ params, searchParams }: Props) {
  const { token } = await params
  const { r, already } = await searchParams

  const db = getDb()
  const recipient = db
    .prepare(`SELECT r.*, c.name as campaign_name 
              FROM recipients r 
              JOIN campaigns c ON r.campaign_id = c.id
              WHERE r.rsvp_token = ?`)
    .get(token) as { email: string; name: string | null; campaign_name: string; rsvp_response: string } | undefined

  if (!recipient) return notFound()

  const response = r ?? recipient.rsvp_response
  const isYes = response === 'yes'
  const alreadyResponded = already === '1'

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>RSVP Confirmation</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #F3F4F6;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
          }
          .card {
            background: white;
            border-radius: 16px;
            padding: 48px 40px;
            max-width: 440px;
            width: 100%;
            text-align: center;
            box-shadow: 0 4px 24px rgba(0,0,0,0.07);
          }
          .icon {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            font-size: 28px;
          }
          .icon-yes { background: #DCFCE7; }
          .icon-no { background: #FEE2E2; }
          h1 { font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 10px; }
          p { font-size: 15px; color: #6B7280; line-height: 1.6; }
          .badge {
            display: inline-block;
            margin-top: 20px;
            padding: 6px 16px;
            border-radius: 100px;
            font-size: 13px;
            font-weight: 600;
          }
          .badge-yes { background: #DCFCE7; color: #15803D; }
          .badge-no { background: #FEE2E2; color: #DC2626; }
          .already { font-size: 13px; color: #9CA3AF; margin-top: 16px; }
          .campaign { font-size: 13px; color: #9CA3AF; margin-top: 24px; border-top: 1px solid #F3F4F6; padding-top: 16px; }
        `}</style>
      </head>
      <body>
        <div className="card">
          <div className={`icon ${isYes ? 'icon-yes' : 'icon-no'}`}>
            {isYes ? '✓' : '✗'}
          </div>
          <h1>
            {alreadyResponded
              ? 'Already responded'
              : 'Thank you for your response!'}
          </h1>
          <p>
            {alreadyResponded
              ? 'You have already submitted your response for this event.'
              : isYes
                ? 'We look forward to seeing you at the event. See you there!'
                : 'We appreciate you letting us know. Hope to see you at a future event!'}
          </p>
          <div className={`badge ${isYes ? 'badge-yes' : 'badge-no'}`}>
            {isYes ? '✓ Attending' : '✗ Not attending'}
          </div>
          {recipient.name && (
            <p style={{ marginTop: '12px', fontSize: '14px', color: '#374151' }}>
              {recipient.name}
            </p>
          )}
          <p className="campaign">{recipient.campaign_name}</p>
        </div>
      </body>
    </html>
  )
}
