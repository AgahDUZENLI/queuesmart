// One number in the row of admin metrics, e.g. "People waiting  12"
function Metric({ label, value }) {
  return <div className="admin-metric"><span>{label}</span><strong>{value}</strong></div>
}

export default Metric
