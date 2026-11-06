/** Persistent disclaimer bar shown on all pages */
export function Disclaimer() {
  return (
    <div
      className="text-xs text-center py-3 px-4 leading-relaxed"
      style={{ background: '#FFF8E6', color: '#7A5000', borderTop: '1px solid #F0D080' }}
      role="note"
    >
      <strong>Educational tool only. Not SEBI-registered investment advice.</strong>{' '}
      Markets carry risk — you can lose money. Past patterns don't guarantee future results.{' '}
      Always consult a SEBI-registered adviser before investing.{' '}
      Data is delayed ~15 min during market hours.
    </div>
  )
}

