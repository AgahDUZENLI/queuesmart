// The server sends times as ISO strings (UTC). Format them here, in the viewer's own time zone.
export function clockTime(iso) {
  return iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''
}
