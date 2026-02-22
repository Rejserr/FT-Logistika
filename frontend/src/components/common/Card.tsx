import type { CSSProperties, ReactNode } from 'react'
import './Card.css'

interface CardProps {
  children: ReactNode
  className?: string
  title?: string
  actions?: ReactNode
  style?: CSSProperties
}

export default function Card({ children, className = '', title, actions, style }: CardProps) {
  return (
    <div className={`card ${className}`} style={style}>
      {(title || actions) && (
        <div className="card-header">
          {title && <h3 className="card-title">{title}</h3>}
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      <div className="card-body">{children}</div>
    </div>
  )
}
