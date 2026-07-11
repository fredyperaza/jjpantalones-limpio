'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Plus, Edit, Trash2, Search, RefreshCw, RotateCcw } from 'lucide-react'

interface Producto {
  id: string
  nombre: string
  talla: string
  color: string
  genero: string
  marca: string
  codigo_barras: string
  precio_costo: number
  precio_venta: number
  stock_actual: number
  stock_minimo: number
  activo: boolean
}

interface FormData {
  nombre: string
  talla: string
  color: string
  genero: string
  marca: string
  codigo_barras: string
  precio_costo: number
  precio_venta: number
  stock_actual: number
  stock_minimo: number
}

const formVacio: FormData = {
  nombre: '',
  talla: '',
  color: '',
  genero: 'unisex',
  marca: '',
  codigo_barras: '',
  precio_costo: 0,
  precio_venta: 0,
  stock_actual: 0,
  stock_minimo: 5
}

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Producto | null>(null)
  const [autorizado, setAutorizado] = useState(false)
  const router = useRouter()

  const [form, setForm] = useState<FormData>(formVacio)

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

    if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'gerente')) {
      router.push('/dashboard')
      return false
    }

    return true
  }, [router])

  const verificarSesion = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      router.push('/login')
    }
  }, [router])

  // ✅ Se quitaron todos los console.log de depuración que estaban aquí
  const cargarProductos = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .order('nombre')

      if (error) throw error
      setProductos(data || [])
    } catch (error) {
      console.error('Error al cargar productos:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const iniciar = async () => {
      const tieneAcceso = await verificarRol()
      if (!tieneAcceso) return

      await verificarSesion()
      await cargarProductos()
      setAutorizado(true)
    }
    iniciar()
  }, [verificarRol, verificarSesion, cargarProductos])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const datosProducto = {
        nombre: form.nombre,
        talla: form.talla || 'UNI',
        color: form.color || 'Sin color',
        genero: form.genero,
        marca: form.marca || 'Sin marca',
        codigo_barras: form.codigo_barras || null,
        precio_costo: form.precio_costo,
        precio_venta: form.precio_venta,
        stock_actual: form.stock_actual,
        stock_minimo: form.stock_minimo
        // ✅ 'activo' ya no se fuerza a true aquí; al editar un producto
        // desactivado, esto ya no lo reactivaba sin que el usuario lo pidiera.
      }

      if (editing) {
        const { error } = await supabase
          .from('productos')
          .update(datosProducto)
          .eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('productos')
          .insert([{ ...datosProducto, activo: true }])
        if (error) throw error
      }

      setShowModal(false)
      setEditing(null)
      setForm(formVacio)
      await cargarProductos()
    } catch (err) {
      const error = err as Error
      alert(error.message || 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  // ✅ Antes: borrado físico (delete) sin revisar error, lo que rompía el
  // historial de ventas antiguas (el producto vendido dejaba de existir)
  // y podía fallar en silencio si había ventas asociadas.
  // Ahora: desactivación (soft delete) - el producto deja de aparecer
  // en Nueva Venta, pero el historial sigue mostrando su nombre correctamente.
  const handleDesactivar = async (producto: Producto) => {
    if (!confirm(`¿Desactivar "${producto.nombre}"? Ya no aparecerá disponible para vender, pero se conserva en el historial.`)) return

    try {
      const { data, error } = await supabase
        .from('productos')
        .update({ activo: false })
        .eq('id', producto.id)
        .select()

      if (error) throw error

      if (!data || data.length === 0) {
        alert('No se pudo desactivar el producto: la base de datos no permitió el cambio (posiblemente por permisos).')
        return
      }

      await cargarProductos()
    } catch (err) {
      const error = err as Error
      alert(error.message || 'Error al desactivar el producto')
    }
  }

  const handleReactivar = async (producto: Producto) => {
    try {
      const { data, error } = await supabase
        .from('productos')
        .update({ activo: true })
        .eq('id', producto.id)
        .select()

      if (error) throw error

      if (!data || data.length === 0) {
        alert('No se pudo reactivar el producto: la base de datos no permitió el cambio.')
        return
      }

      await cargarProductos()
    } catch (err) {
      const error = err as Error
      alert(error.message || 'Error al reactivar el producto')
    }
  }

  const handleEdit = (producto: Producto) => {
    setEditing(producto)
    setForm({
      nombre: producto.nombre,
      talla: producto.talla,
      color: producto.color || '',
      genero: producto.genero,
      marca: producto.marca || '',
      codigo_barras: producto.codigo_barras || '',
      precio_costo: producto.precio_costo,
      precio_venta: producto.precio_venta,
      stock_actual: producto.stock_actual,
      stock_minimo: producto.stock_minimo
    })
    setShowModal(true)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const productosFiltrados = productos
    .filter(p => mostrarInactivos ? true : p.activo)
    .filter(p =>
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.marca?.toLowerCase().includes(search.toLowerCase()) ||
      p.codigo_barras?.toLowerCase().includes(search.toLowerCase())
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
      <header className="bg-[#003366] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
              <span className="text-[#003366] font-bold text-xl">JJ</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-xl">JJPantalones</h1>
              <p className="text-[#00aaff] text-xs">Pantalones por Mayoreo</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-white hover:text-[#00aaff] transition">
              📊 Dashboard
            </button>
            <button onClick={handleLogout} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition">
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-[#003366]">📦 Productos</h2>
          <div className="flex gap-2">
            <button onClick={cargarProductos} className="bg-gray-500 text-white px-3 py-2 rounded-lg hover:bg-gray-600 transition flex items-center gap-2">
              <RefreshCw size={16} /> Actualizar
            </button>
            <button
              onClick={() => {
                setEditing(null)
                setForm(formVacio)
                setShowModal(true)
              }}
              className="bg-[#003366] text-white px-4 py-2 rounded-lg hover:bg-[#002244] transition flex items-center gap-2"
            >
              <Plus size={18} /> Nuevo Producto
            </button>
          </div>
        </div>

        <div className="mb-6 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por nombre, marca o código de barras..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003366]"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
            <input
              type="checkbox"
              checked={mostrarInactivos}
              onChange={(e) => setMostrarInactivos(e.target.checked)}
              className="w-4 h-4"
            />
            Mostrar desactivados
          </label>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Talla/Color</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Precio</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center">
                      <div className="flex justify-center">
                        <div className="w-6 h-6 border-2 border-[#003366] border-t-transparent rounded-full animate-spin"></div>
                      </div>
                      <p className="mt-2 text-gray-500">Cargando productos...</p>
                    </td>
                  </tr>
                ) : productosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      {search ? 'No se encontraron productos' : 'No hay productos registrados'}
                    </td>
                  </tr>
                ) : (
                  productosFiltrados.map((p) => (
                    <tr key={p.id} className={`hover:bg-gray-50 ${!p.activo ? 'opacity-50' : ''}`}>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium">{p.nombre}</p>
                          <p className="text-sm text-gray-500">{p.marca}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm">{p.codigo_barras || '-'}</td>
                      <td className="px-6 py-4">
                        {p.talla} / {p.color}
                      </td>
                      <td className="px-6 py-4">
                        <span className={p.stock_actual <= p.stock_minimo ? 'text-red-600 font-bold' : ''}>
                          {p.stock_actual}
                        </span>
                      </td>
                      <td className="px-6 py-4">${p.precio_venta}</td>
                      <td className="px-6 py-4">
                        {p.activo ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Activo</span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded-full">Desactivado</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => handleEdit(p)} className="text-blue-600 hover:text-blue-800" title="Editar">
                            <Edit size={18} />
                          </button>
                          {p.activo ? (
                            <button onClick={() => handleDesactivar(p)} className="text-red-600 hover:text-red-800" title="Desactivar">
                              <Trash2 size={18} />
                            </button>
                          ) : (
                            <button onClick={() => handleReactivar(p)} className="text-green-600 hover:text-green-800" title="Reactivar">
                              <RotateCcw size={18} />
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

        {!loading && (
          <p className="mt-4 text-sm text-gray-500">
            Total: {productosFiltrados.length} producto(s)
          </p>
        )}
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => {
                setShowModal(false)
                setEditing(null)
                setForm(formVacio)
              }}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
              title="Cerrar"
            >
              ×
            </button>

            <h3 className="text-xl font-bold mb-4">{editing ? 'Editar' : 'Nuevo'} Producto</h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Nombre *</label>
                <input
                  type="text"
                  required
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Talla</label>
                  <input
                    type="text"
                    value={form.talla}
                    onChange={(e) => setForm({ ...form, talla: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Color</label>
                  <input
                    type="text"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Género</label>
                  <select
                    value={form.genero}
                    onChange={(e) => setForm({ ...form, genero: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="hombre">👨 Hombre</option>
                    <option value="mujer">👩 Mujer</option>
                    <option value="unisex">👫 Unisex</option>
                    <option value="niños">👦 Niños</option>
                    <option value="niñas">👧 Niñas</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Marca</label>
                  <input
                    type="text"
                    value={form.marca}
                    onChange={(e) => setForm({ ...form, marca: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Código de barras</label>
                  <input
                    type="text"
                    value={form.codigo_barras}
                    onChange={(e) => setForm({ ...form, codigo_barras: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Código de barras del producto"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Precio Costo</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.precio_costo}
                    onChange={(e) => setForm({ ...form, precio_costo: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Precio Venta</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.precio_venta}
                    onChange={(e) => setForm({ ...form, precio_venta: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Stock Actual</label>
                  <input
                    type="number"
                    value={form.stock_actual}
                    onChange={(e) => setForm({ ...form, stock_actual: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Stock Mínimo</label>
                  <input
                    type="number"
                    value={form.stock_minimo}
                    onChange={(e) => setForm({ ...form, stock_minimo: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Alerta cuando baje de aquí"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={loading} className="flex-1 bg-[#003366] text-white py-2 rounded-lg hover:bg-[#002244]">
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-50">
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