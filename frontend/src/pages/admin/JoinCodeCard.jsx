// Shows the admin's join code and QR code. Print it or put it at the front
// desk: people type the code, or scan the QR code to open QueueSmart with it.
import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { getMyPlace } from '../../api'

function JoinCodeCard() {
  const [myPlace, setMyPlace] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getMyPlace().then(setMyPlace).catch((err) => setError(err.message))
  }, [])

  if (error) return <section className="admin-section join-code-card"><p className="error">{error}</p></section>
  if (!myPlace) return null

  return (
    <section className="admin-section join-code-card" aria-label="Join code">
      <QRCodeSVG value={myPlace.joinLink} size={128} />
      <div>
        <h2>Join code</h2>
        <p className="join-code">{myPlace.place.id}</p>
        <p className="admin-muted">
          People add {myPlace.place.name} by entering this code on “Join a queue”, or by scanning the QR code.
        </p>
        <button className="admin-text-action" type="button" onClick={() => window.print()}>Print</button>
      </div>
    </section>
  )
}

export default JoinCodeCard
