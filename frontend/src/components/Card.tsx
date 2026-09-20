import { ReactNode } from 'react'

export default function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card">
      <div className="card-header">
        <h3>{title}</h3>
      </div>
      <div className="card-body">{children}</div>
    </section>
  )
}
