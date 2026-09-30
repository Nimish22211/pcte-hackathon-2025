import { useState } from 'react'
import { Button } from '../ui/button'

// Dropdown + button used to choose an official (admin) or a serviceman (official)
const AssignSelect = ({ options, onAssign, placeholder, buttonLabel = 'Assign', emptyMessage, disabled = false }) => {
  const [selected, setSelected] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (options.length === 0) {
    return <p className="text-xs text-amber-700">{emptyMessage}</p>
  }

  const handleAssign = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      const result = await onAssign(selected)
      if (result?.success) setSelected('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={disabled || submitting}
        className="h-8 flex-1 min-w-0 rounded-md border border-gray-300 bg-white px-2 text-xs"
        aria-label={placeholder}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}{option.department ? ` (${option.department.replace('_', ' ')})` : ''}
          </option>
        ))}
      </select>
      <Button size="sm" className="text-xs" onClick={handleAssign} disabled={!selected || disabled || submitting}>
        {submitting ? '...' : buttonLabel}
      </Button>
    </div>
  )
}

export default AssignSelect
