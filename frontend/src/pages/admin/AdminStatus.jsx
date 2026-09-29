function AdminStatus({ status }) {
  return <span className={`status-label status-${status.toLowerCase().replaceAll(' ', '-')}`}>{status}</span>
}

export default AdminStatus