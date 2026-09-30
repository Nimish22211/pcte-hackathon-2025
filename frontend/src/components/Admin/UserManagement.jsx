import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { apiService } from '../../services/apiService'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Users } from 'lucide-react'
import { DEPARTMENTS } from '../../utils/constants'

const ROLE_OPTIONS = [
  { value: 'citizen', label: 'Citizen' },
  { value: 'official', label: 'Official' },
  { value: 'serviceman', label: 'Serviceman' },
  { value: 'admin', label: 'Admin' }
]

const needsDepartment = (role) => role === 'official' || role === 'serviceman'

const selectClass = 'h-9 rounded-md border border-gray-300 bg-white px-2 text-sm'
const errorMessage = (error, fallback) =>
  error.response?.data?.details?.[0]?.msg || error.response?.data?.error || fallback

const EMPTY_FORM = { name: '', email: '', password: '', phone: '', role: 'official', department: 'public_works' }

// One row: change an existing user's role / department, deactivate or re-activate
const UserRow = ({ person, isSelf, onChanged }) => {
  const [role, setRole] = useState(person.role)
  const [department, setDepartment] = useState(person.department || 'public_works')
  const [busy, setBusy] = useState(false)

  const changed = role !== person.role || (needsDepartment(role) && department !== (person.department || ''))

  const run = async (action, successMessage) => {
    setBusy(true)
    try {
      await action()
      toast.success(successMessage)
      await onChanged()
    } catch (error) {
      toast.error(errorMessage(error, 'Action failed'))
    } finally {
      setBusy(false)
    }
  }

  const saveRole = () =>
    run(
      () => apiService.put(`/users/${person.id}/role`, { role, department: needsDepartment(role) ? department : undefined }),
      'Role updated'
    )

  const toggleActive = () =>
    run(
      () => apiService.put(`/users/${person.id}/${person.is_active ? 'deactivate' : 'activate'}`),
      person.is_active ? 'User deactivated' : 'User activated'
    )

  return (
    <tr className="border-t">
      <td className="py-2 pr-3">
        <div className="font-medium">{person.name}</div>
        <div className="text-xs text-gray-500">{person.email}</div>
      </td>
      <td className="py-2 pr-3">
        {isSelf ? (
          <Badge variant="outline">{person.role} (you)</Badge>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select className={selectClass} value={role} onChange={(e) => setRole(e.target.value)} disabled={busy} aria-label="Role">
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {needsDepartment(role) && (
              <select className={selectClass} value={department} onChange={(e) => setDepartment(e.target.value)} disabled={busy} aria-label="Department">
                {DEPARTMENTS.map((dept) => (
                  <option key={dept.value} value={dept.value}>{dept.label}</option>
                ))}
              </select>
            )}
            {changed && (
              <Button size="sm" onClick={saveRole} disabled={busy}>Save</Button>
            )}
          </div>
        )}
      </td>
      <td className="py-2 pr-3">
        <Badge className={person.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600'}>
          {person.is_active ? 'Active' : 'Deactivated'}
        </Badge>
      </td>
      <td className="py-2 text-right">
        {!isSelf && (
          <Button size="sm" variant="outline" onClick={toggleActive} disabled={busy}>
            {person.is_active ? 'Deactivate' : 'Activate'}
          </Button>
        )}
      </td>
    </tr>
  )
}

const UserManagement = () => {
  const { user } = useAuth()
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [roleFilter, setRoleFilter] = useState('all')

  const loadUsers = async () => {
    try {
      const response = await apiService.get('/users')
      setPeople(response.data)
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to load users'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      await apiService.post('/users', {
        ...form,
        department: needsDepartment(form.role) ? form.department : undefined,
        phone: form.phone || undefined
      })
      toast.success(`${form.name} can now sign in as ${form.role}`)
      setForm(EMPTY_FORM)
      await loadUsers()
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to create user'))
    } finally {
      setCreating(false)
    }
  }

  const visible = people.filter((person) => roleFilter === 'all' || person.role === roleFilter)

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          User Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 rounded-lg border p-4 md:grid-cols-3">
          <div className="md:col-span-3 text-sm font-medium">Appoint an official, serviceman or admin</div>
          <div>
            <Label htmlFor="new-name">Name</Label>
            <Input id="new-name" required minLength={2} value={form.name} onChange={(e) => setField('name', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="new-email">Email</Label>
            <Input id="new-email" type="email" required value={form.email} onChange={(e) => setField('email', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="new-password">Temporary password</Label>
            <Input id="new-password" type="password" required minLength={6} value={form.password} onChange={(e) => setField('password', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="new-phone">Phone (optional)</Label>
            <Input id="new-phone" value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="+91..." />
          </div>
          <div>
            <Label htmlFor="new-role">Role</Label>
            <select id="new-role" className={`${selectClass} w-full`} value={form.role} onChange={(e) => setField('role', e.target.value)}>
              {ROLE_OPTIONS.filter((option) => option.value !== 'citizen').map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="new-department">Department</Label>
            <select
              id="new-department"
              className={`${selectClass} w-full`}
              value={form.department}
              onChange={(e) => setField('department', e.target.value)}
              disabled={!needsDepartment(form.role)}
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept.value} value={dept.value}>{dept.label}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <Button type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create account'}</Button>
          </div>
        </form>

        <div>
          <div className="mb-3 flex items-center gap-2">
            <Label htmlFor="role-filter">Show</Label>
            <select id="role-filter" className={selectClass} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="all">Everyone ({people.length})</option>
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}s</option>
              ))}
            </select>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Loading users...</p>
          ) : (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-gray-500">
                    <th className="pb-2 pr-3">User</th>
                    <th className="pb-2 pr-3">Role / Department</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((person) => (
                    <UserRow key={person.id} person={person} isSelf={person.id === user?.id} onChanged={loadUsers} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default UserManagement
