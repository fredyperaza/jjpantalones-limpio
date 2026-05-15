'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Plus, Edit, Trash2, Search } from 'lucide-react'

interface Usuario {
  id: string
  nombre_usuario: string
  email: string
  nombre_completo: string
  rol: string
  activo: boolean
}

interface FormData {
  nombre_usuario: string
  email: string
  nombre_completo: string
  password: string
  rol: string
}

interface UpdateData {
  nombre_usuario: string
  email: string
  nombre_completo: string
  rol: string
  password_hash?: string
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Usuario | null>(null)
  const [autorizado, setAutorizado] = useState(false)
  const router = useRouter()

  const [form, setForm] = useState<FormData>({
    nombre_usuario: '',
    email: '',
    nombre_completo: '',
    password: '',
    rol: 'vendedor'
  })

  // ============================================
  // VERIFICAR ROL (solo admin)
  // ============================================

  const verificarRol = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return false
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', session.user.id)
      .single()

    if (usuario?.rol !== 'admin') {
      router.push('/dashboard')
      return false
    }

    return true
  }, [router])

  const verificarSesion = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
    }
  }, [router])

  const cargarUsuarios = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .order('nombre_usuario')

      if (error) throw error
      setUsuarios(data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // ============================================
  // USEEFFECT CON VERIFICACIÓN DE ROL
  // ============================================

  useEffect(() => {
    const iniciar = async () => {
      const tieneAcceso = await verificarRol()
      if (!tieneAcceso) return
      
      await verificarSesion()
      await cargarUsuarios()
      setAutorizado(true)
    }
    iniciar()
  }, [verificarRol, verificarSesion, cargarUsuarios])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (editing) {
        const updateData: UpdateData = {
          nombre_usuario: form.nombre_usuario,
          email: form.email,
          nombre_completo: form.nombre_completo,
          rol: form.rol
        }
        
        if (form.password) {
          updateData.password_hash = form.password
        }

        const { error } = await supabase
          .from('usuarios')
          .update(updateData)
          .eq('id', editing.id)
        if (error) throw error
      } else {
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: form.email,
          password: form.password,
          email_confirm: true,
          user_metadata: { nombre_completo: form.nombre_completo, rol: form.rol }
        })
        
        if (authError) throw authError
        
        if (authData.user) {
          const { error: insertError } = await supabase
            .from('usuarios')
            .insert({
              id: authData.user.id,
              nombre_usuario: form.nombre_usuario,
              email: form.email,
              nombre_completo: form.nombre_completo,
              rol: form.rol,
              activo: true
            })
          if (insertError) throw insertError
        }
      }

      setShowModal(false)
      setEditing(null)
      setForm({
        nombre_usuario: '',
        email: '',
        nombre_completo: '',
        password: '',
        rol: 'vendedor'
      })
      await cargarUsuarios()
    } catch (err) {
      const error = err as Error
      alert(error.message || 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.')) return

    try {
      const { error: authError } = await supabase.auth.admin.deleteUser(id)
      if (authError) throw authError

      const { error } = await supabase
        .from('usuarios')
        .delete()
        .eq('id', id)
      if (error) throw error

      await cargarUsuarios()
    } catch (err) {
      const error = err as Error
      alert(error.message || 'Error al eliminar')
    }
  }

  const handleEdit = (usuario: Usuario) => {
    setEditing(usuario)
    setForm({
      nombre_usuario: usuario.nombre_usuario,
      email: usuario.email,
      nombre_completo: usuario.nombre_completo || '',
      password: '',
      rol: usuario.rol
    })
    setShowModal(true)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const getRolBadge = (rol: string) => {
    switch (rol) {
      case 'admin':
        return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">👑 Admin</span>
      case 'gerente':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">⭐ Gerente</span>
      default:
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">👤 Vendedor</span>
    }
  }

  const usuariosFiltrados = usuarios.filter(u =>
    u.nombre_usuario.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.nombre_completo?.toLowerCase().includes(search.toLowerCase())
  )

  if (!autorizado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#003366] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Verificando permisos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-[#003366] shadow-lg sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
              <span className="text-[#003366] font-bold text-xl">JJ</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-xl">JJPantalones</h1>
              <p className="text-[#00aaff] text-xs">Administración de Usuarios</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-white hover:text-[#00aaff] transition">
              📊 Dashboard
            </button>
            <button onClick={() => router.push('/ventas/nueva')} className="text-white hover:text-[#00aaff] transition">
              🛒 Nueva Venta
            </button>
            <button onClick={() => router.push('/clientes')} className="text-white hover:text-[#00aaff] transition">
              👥 Clientes
            </button>
            <button onClick={() => router.push('/ventas')} className="text-white hover:text-[#00aaff] transition">
              📜 Historial
            </button>
            <button onClick={handleLogout} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition">
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-[#003366]">👥 Usuarios del Sistema</h2>
          <button
            onClick={() => {
              setEditing(null)
              setForm({
                nombre_usuario: '',
                email: '',
                nombre_completo: '',
                password: '',
                rol: 'vendedor'
              })
              setShowModal(true)
            }}
            className="bg-[#003366] text-white px-4 py-2 rounded-lg hover:bg-[#002244] transition flex items-center gap-2"
          >
            <Plus size={18} /> Nuevo Usuario
          </button>
        </div>

        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por nombre, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003366]"
          />
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre Completo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center">Cargando...</td>
                  </tr>
                ) : usuariosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No hay usuarios registrados</td>
                  </tr>
                ) : (
                  usuariosFiltrados.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">{u.nombre_usuario}</td>
                      <td className="px-6 py-4">{u.email}</td>
                      <td className="px-6 py-4">{u.nombre_completo || '-'}</td>
                      <td className="px-6 py-4">{getRolBadge(u.rol)}</td>
                      <td className="px-6 py-4">
                        {u.activo ? (
                          <span className="text-green-600">✅ Activo</span>
                        ) : (
                          <span className="text-red-600">❌ Inactivo</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(u)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Editar"
                          >
                            <Edit size={18} />
                          </button>
                          {u.rol !== 'admin' && (
                            <button
                              onClick={() => handleDelete(u.id)}
                              className="text-red-600 hover:text-red-800"
                              title="Eliminar"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-4 text-sm text-gray-500">
          Total: {usuariosFiltrados.length} usuario(s)
        </p>
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">{editing ? 'Editar' : 'Nuevo'} Usuario</h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Nombre de usuario *</label>
                <input
                  type="text"
                  required
                  value={form.nombre_usuario}
                  onChange={(e) => setForm({ ...form, nombre_usuario: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Nombre completo</label>
                <input
                  type="text"
                  value={form.nombre_completo}
                  onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              {!editing && (
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Contraseña *</label>
                  <input
                    type="password"
                    required={!editing}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              )}
              {editing && (
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Nueva contraseña (opcional)</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Dejar vacío para no cambiar"
                  />
                </div>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Rol</label>
                <select
                  value={form.rol}
                  onChange={(e) => setForm({ ...form, rol: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="vendedor">👤 Vendedor</option>
                  <option value="gerente">⭐ Gerente</option>
                  <option value="admin">👑 Administrador</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-[#003366] text-white py-2 rounded-lg hover:bg-[#002244]"
                >
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}