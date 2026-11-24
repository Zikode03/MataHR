const positive = new Set(['Active', 'Approved', 'Verified', 'Completed', 'Compliant', 'Ready', 'Published', 'Resolved', 'Available', 'Acknowledged']);
const negative = new Set(['Rejected', 'Expired', 'Overdue', 'Missing evidence']);
const pending = new Set(['Pending', 'Pending review', 'In review', 'Submitted', 'Review required', 'Unverified', 'Repair', 'New', 'Awaiting acknowledgement']);

export function Status({value}: {value: string}) {
  const tone = positive.has(value) ? 'positive' : negative.has(value) ? 'negative' : pending.has(value) ? 'pending' : 'neutral';
  return <span className={`status status-${tone}`}><span aria-hidden="true" className="status-dot"/>{value}</span>;
}
