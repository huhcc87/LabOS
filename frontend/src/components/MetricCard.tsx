export default function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-card">
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
    </div>
  )
}
