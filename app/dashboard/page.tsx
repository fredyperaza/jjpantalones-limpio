'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Package, ShoppingCart, AlertTriangle, DollarSign, Users } from 'lucide-react'

export default function DashboardPage() {
  const [ventasHoy, setVentasHoy] = useState(0)
  const [montoHoy, setMontoHoy] = useState(0)
  const [totalProductos, setTotalProductos] = useState(0)
  const [bajoStock, setBajoStock] = useState(0)
  const [totalClientes, setTotalClientes] = useState(0)
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [userRole, setUserRole] = useState('')
  const router = useRouter()

  useEffect(() => {
    const cargarTodo = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        router.push('/login')
        return
      }
      setUserEmail(sessionData.session.user.email || 'Usuario')

      const { data: usuarioData } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', sessionData.session.user.id)
        .single()
      
      if (usuarioData) {
        setUserRole(usuarioData.rol)
      }

      try {
        const hoy = new Date().toISOString().split('T')[0]
        const { data: ventas } = await supabase
          .from('ventas')
          .select('total')
          .gte('fecha_venta', hoy)

        if (ventas) {
          setVentasHoy(ventas.length)
          let total = 0
          for (let i = 0; i < ventas.length; i++) {
            total = total + (ventas[i].total || 0)
          }
          setMontoHoy(total)
        }

        const { count: productos } = await supabase
          .from('productos')
          .select('*', { count: 'exact', head: true })
        setTotalProductos(productos || 0)

        const { data: todosProductos } = await supabase
          .from('productos')
          .select('stock_actual, stock_minimo')
        
        if (todosProductos) {
          let bajo = 0
          for (let i = 0; i < todosProductos.length; i++) {
            if (todosProductos[i].stock_actual <= todosProductos[i].stock_minimo) {
              bajo++
            }
          }
          setBajoStock(bajo)
        }

        const { count: clientes } = await supabase
          .from('clientes')
          .select('*', { count: 'exact', head: true })
        setTotalClientes(clientes || 0)

      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }

    cargarTodo()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#003366] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-[#003366] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 relative">
               <Image
                  src="/logo.png"
                  alt="JJPantalones"
                  fill
                  className="rounded-full object-cover"
                  sizes="40px"
                 />
            </div>
            <div>
              <h1 className="text-white font-bold text-xl">JJPantalones</h1>
              <p className="text-[#00aaff] text-xs">Pantalones por Mayoreo | El Salvador 🇸🇻</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-white text-sm">Hola, {userEmail}</span>
            <span className="text-white text-xs bg-white/20 px-2 py-1 rounded">
              {userRole === 'admin' ? '👑 Admin' : userRole === 'gerente' ? '⭐ Gerente' : '👤 Vendedor'}
            </span>
            <button
              onClick={handleLogout}
              className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-[#003366] mb-6">Dashboard</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-[#003366]">
            <div className="flex justify-between">
              <div>
                <p className="text-gray-500 text-sm">Ventas Hoy</p>
                <p className="text-3xl font-bold text-[#003366]">{ventasHoy}</p>
              </div>
              <ShoppingCart className="w-8 h-8 text-[#00aaff]" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <div className="flex justify-between">
              <div>
                <p className="text-gray-500 text-sm">Monto Total</p>
                <p className="text-2xl font-bold text-green-600">${montoHoy.toFixed(2)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-[#003366]">
            <div className="flex justify-between">
              <div>
                <p className="text-gray-500 text-sm">Productos</p>
                <p className="text-3xl font-bold text-[#003366]">{totalProductos}</p>
              </div>
              <Package className="w-8 h-8 text-[#00aaff]" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
            <div className="flex justify-between">
              <div>
                <p className="text-gray-500 text-sm">Bajo Stock</p>
                <p className={`text-3xl font-bold ${bajoStock > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {bajoStock}
                </p>
              </div>
              <AlertTriangle className={`w-8 h-8 ${bajoStock > 0 ? 'text-red-500' : 'text-gray-400'}`} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-[#003366]">
            <div className="flex justify-between">
              <div>
                <p className="text-gray-500 text-sm">Clientes</p>
                <p className="text-3xl font-bold text-[#003366]">{totalClientes}</p>
              </div>
              <Users className="w-8 h-8 text-[#00aaff]" />
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <button
            onClick={() => router.push('/productos')}
            className="bg-[#003366] text-white px-4 py-3 rounded-lg hover:bg-[#002244] transition font-semibold"
          >
            📦 Gestionar Productos
          </button>
          <button
            onClick={() => router.push('/ventas/nueva')}
            className="bg-[#00aaff] text-white px-4 py-3 rounded-lg hover:bg-[#0088cc] transition font-semibold"
          >
            🛒 Nueva Venta
          </button>
          <button
            onClick={() => router.push('/clientes')}
            className="border-2 border-[#003366] text-[#003366] px-4 py-3 rounded-lg hover:bg-[#003366] hover:text-white transition font-semibold"
          >
            👥 Administrar Clientes
          </button>
          <button
            onClick={() => router.push('/reportes')}
            className="bg-gray-600 text-white px-4 py-3 rounded-lg hover:bg-gray-700 transition font-semibold"
          >
            📊 Reportes
          </button>
          <button
            onClick={() => router.push('/ventas')}
            className="bg-teal-600 text-white px-4 py-3 rounded-lg hover:bg-teal-700 transition font-semibold"
          >
            📜 Historial de Ventas
          </button>
          {userRole === 'admin' && (
            <button
              onClick={() => router.push('/usuarios')}
              className="bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 transition font-semibold"
            >
              👥 Administrar Usuarios
            </button>
          )}
        </div>

        {bajoStock > 0 && (
          <div className="mt-8 bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
            <p className="text-red-700">
              ⚠️ Atención: Hay <strong>{bajoStock}</strong> producto(s) con stock por debajo del mínimo.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}