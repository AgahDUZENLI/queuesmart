// Mock QR scanner: a pretend camera view showing the demo places' QR codes.
// Clicking one "scans" it. A real camera scanner can replace this later.
// Calls onScan with the join code, e.g. "123456".
import { QRCodeSVG } from 'qrcode.react'
import Button from './Button'

// The demo places from backend/src/demo.js
const demoPlaces = [
  { code: 123456, name: 'Student Services Center' },
  { code: 234567, name: 'Main Street Tire Shop' },
  { code: 345678, name: 'Eastside Health Clinic' },
]

// A place's QR code holds a link like http://localhost:5173/?code=123456
function joinLink(code) {
  return `${window.location.origin}/?code=${code}`
}

// Reads the join code back out of a scanned link
function codeFromQr(text) {
  return new URL(text).searchParams.get('code')
}

function QrScanner({ onScan, onClose }) {
  return (
    <div className="qr-scanner">
      <p>Camera (demo): pick the QR code you’re pointing at.</p>
      <div className="qr-camera">
        {demoPlaces.map((place) => (
          <button key={place.code} type="button" onClick={() => onScan(codeFromQr(joinLink(place.code)))}>
            <QRCodeSVG value={joinLink(place.code)} size={96} />
            <span>{place.name}</span>
          </button>
        ))}
      </div>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
    </div>
  )
}

export default QrScanner
