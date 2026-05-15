'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Plus, Edit, Trash2, Search } from 'lucide-react'

interface Cliente {
  id: string
  nombre: string
  tipo_documento: string
  numero_documento: string
  email: string
  telefono: string
  direccion: string
  es_mayorista: boolean
}

interface FormData {
  nombre: string
  tipo_documento: string
  numero_documento: string
  email: string
  telefono: string
  direccion: string
  es_mayorista: boolean
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Cliente | null>(null)
  const router = useRouter()

  const [form, setForm] = useState<FormData>({
    nombre: '',
    tipo_documento: 'DUI',
    numero_documento: '',
    email: '',
    telefono: '',
    direccion: '',
    es_mayorista: false
  })

  const verificarSesion = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      router.push('/login')
    }
  }, [router])

  const cargarClientes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nombre')

      if (error) throw error
      setClientes(data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const iniciar = async () => {
      await verificarSesion()
      await cargarClientes()
    }
    iniciar()
  }, [verificarSesion, cargarClientes])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (editing) {
        const { error } = await supabase
          .from('clientes')
          .update(form)
          .eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('clientes')
          .insert([form])
        if (error) throw error
      }

      setShowModal(false)
      setEditing(null)
      setForm({
        nombre: '',
        tipo_documento: 'DUI',
        numero_documento: '',
        email: '',
        telefono: '',
        direccion: '',
        es_mayorista: false
      })
      await cargarClientes()
    } catch (err) {
      const error = err as Error
      alert(error.message || 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este cliente? Se eliminarán también sus ventas.')) return

    try {
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', id)
      if (error) throw error
      await cargarClientes()
    } catch (err) {
      const error = err as Error
      alert(error.message || 'Error al eliminar')
    }
  }

  const handleEdit = (cliente: Cliente) => {
    setEditing(cliente)
    setForm({
      nombre: cliente.nombre,
      tipo_documento: cliente.tipo_documento,
      numero_documento: cliente.numero_documento || '',
      email: cliente.email || '',
      telefono: cliente.telefono || '',
      direccion: cliente.direccion || '',
      es_mayorista: cliente.es_mayorista
    })
    setShowModal(true)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const clientesFiltrados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    c.numero_documento?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  )

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
              <p className="text-[#00aaff] text-xs">Administración de Clientes</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-white hover:text-[#00aaff] transition">
              📊 Dashboard
            </button>
            <button onClick={() => router.push('/ventas/nueva')} className="text-white hover:text-[#00aaff] transition">
              🛒 Nueva Venta
            </button>
            <button onClick={handleLogout} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition">
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-[#003366]">👥 Clientes</h2>
          <button
            onClick={() => {
              setEditing(null)
              setForm({
                nombre: '',
                tipo_documento: 'DUI',
                numero_documento: '',
                email: '',
                telefono: '',
                direccion: '',
                es_mayorista: false
              })
              setShowModal(true)
            }}
            className="bg-[#003366] text-white px-4 py-2 rounded-lg hover:bg-[#002244] transition flex items-center gap-2"
          >
            <Plus size={18} /> Nuevo Cliente
          </button>
        </div>

        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por nombre, documento o email..."
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Documento</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contacto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center">Cargando...</td>
                  </tr>
                ) : clientesFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No hay clientes registrados</td>
                  </tr>
                ) : (
                  clientesFiltrados.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium">{c.nombre}</p>
                          <p className="text-xs text-gray-500">{c.direccion}</p>
                        </div>
                       </td>
                      <td className="px-6 py-4">
                        {c.tipo_documento}: {c.numero_documento}
                       </td>
                      <td className="px-6 py-4">
                        {c.telefono && <p className="text-sm">{c.telefono}</p>}
                        {c.email && <p className="text-xs text-gray-500">{c.email}</p>}
                       </td>
                      <td className="px-6 py-4">
                        {c.es_mayorista ? (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Mayorista</span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">Mostrador</span>
                        )}
                       </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => handleEdit(c)} className="text-blue-600 hover:text-blue-800">
                            <Edit size={18} />
                          </button>
                          <button onClick={() => handleDelete(c.id)} className="text-red-600 hover:text-red-800">
                            <Trash2 size={18} />
                          </button>
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
          Total: {clientesFiltrados.length} cliente(s)
        </p>
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{editing ? 'Editar' : 'Nuevo'} Cliente</h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Nombre completo *</label>
                <input
                  type="text"
                  required
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003366]"
                  placeholder="Ej: Juan Pérez"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo documento</label>
                  <select
                    value={form.tipo_documento}
                    onChange={(e) => setForm({ ...form, tipo_documento: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="DUI">DUI</option>
                    <option value="NIT">NIT</option>
                    <option value="Pasaporte">Pasaporte</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Número documento</label>
                  <input
                    type="text"
                    value={form.numero_documento}
                    onChange={(e) => setForm({ ...form, numero_documento: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="00000000-0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="70123456"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="cliente@email.com"
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Dirección</label>
                <textarea
                  value={form.direccion}
                  onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003366]"
                  rows={2}
                  placeholder="San Salvador, El Salvador"
                />
              </div>

              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.es_mayorista}
                    onChange={(e) => setForm({ ...form, es_mayorista: e.target.checked })}
                    className="w-4 h-4 text-[#003366]"
                  />
                  <span className="text-sm font-medium">Es cliente mayorista</span>
                </label>
                <p className="text-xs text-gray-500 mt-1">Los mayoristas pueden acceder a precios especiales por cantidad</p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-[#003366] text-white py-2 rounded-lg hover:bg-[#002244] transition"
                >
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-50 transition"
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