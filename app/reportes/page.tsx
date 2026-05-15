'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { TrendingUp, Package, DollarSign, Users, Download } from 'lucide-react'

interface ResumenVentas {
  total_ventas: number
  total_ingresos: number
  total_ganancias: number
  ticket_promedio: number
}

interface ProductoTop {
  nombre: string
  total_vendido: number
  total_ingresos: number
}

interface ClienteTop {
  nombre: string
  total_compras: number
  total_gastado: number
}

interface VentaData {
  total: number
  subtotal: number
}

interface DetalleData {
  cantidad: number
  precio_unitario: number
  producto: { nombre: string } | null
}

interface VentaClienteData {
  total: number
  cliente: { nombre: string } | null
}

export default function ReportesPage() {
  const [periodo, setPeriodo] = useState('mes')
  const [resumen, setResumen] = useState<ResumenVentas>({
    total_ventas: 0,
    total_ingresos: 0,
    total_ganancias: 0,
    ticket_promedio: 0
  })
  const [productosTop, setProductosTop] = useState<ProductoTop[]>([])
  const [clientesTop, setClientesTop] = useState<ClienteTop[]>([])
  const [loading, setLoading] = useState(true)
  const [autorizado, setAutorizado] = useState(false)
  const router = useRouter()

  // ============================================
  // VERIFICAR ROL (solo admin y gerente)
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

  const cargarReportes = useCallback(async () => {
    setLoading(true)
    try {
      // Calcular fecha según período
      const hoy = new Date()
      let fechaInicio = new Date()
      
      if (periodo === 'dia') {
        fechaInicio = new Date(hoy.setHours(0, 0, 0, 0))
      } else if (periodo === 'semana') {
        fechaInicio = new Date(hoy.setDate(hoy.getDate() - 7))
      } else if (periodo === 'mes') {
        fechaInicio = new Date(hoy.setMonth(hoy.getMonth() - 1))
      } else if (periodo === 'anio') {
        fechaInicio = new Date(hoy.setFullYear(hoy.getFullYear() - 1))
      }

      const fechaInicioStr = fechaInicio.toISOString()

      // 1. Resumen de ventas
      const { data: ventas } = await supabase
        .from('ventas')
        .select('total, subtotal')
        .eq('estado', 'completada')
        .gte('fecha_venta', fechaInicioStr)

      const ventasData = ventas as VentaData[] | null
      const totalVentas = ventasData?.length || 0
      const totalIngresos = ventasData?.reduce((sum, v) => sum + (v.total || 0), 0) || 0
      
      // Calcular ganancia (estimada con 40% de margen)
      const totalGanancias = totalIngresos * 0.4
      const ticketPromedio = totalVentas > 0 ? totalIngresos / totalVentas : 0

      setResumen({
        total_ventas: totalVentas,
        total_ingresos: totalIngresos,
        total_ganancias: totalGanancias,
        ticket_promedio: ticketPromedio
      })

      // 2. Productos más vendidos
      const { data: detalles } = await supabase
        .from('detalle_ventas')
        .select(`
          cantidad,
          precio_unitario,
          producto:productos (nombre)
        `)
        .gte('created_at', fechaInicioStr)

      const detallesData = detalles as DetalleData[] | null
      const productosMap = new Map<string, { cantidad: number, ingresos: number }>()
      
      detallesData?.forEach((d) => {
        const nombre = d.producto?.nombre || 'Producto no disponible'
        const existe = productosMap.get(nombre)
        if (existe) {
          existe.cantidad += d.cantidad
          existe.ingresos += d.cantidad * d.precio_unitario
        } else {
          productosMap.set(nombre, {
            cantidad: d.cantidad,
            ingresos: d.cantidad * d.precio_unitario
          })
        }
      })

      const productosArray: ProductoTop[] = Array.from(productosMap.entries()).map(([nombre, datos]) => ({
        nombre,
        total_vendido: datos.cantidad,
        total_ingresos: datos.ingresos
      }))
      productosArray.sort((a, b) => b.total_vendido - a.total_vendido)
      setProductosTop(productosArray.slice(0, 5))

      // 3. Clientes que más compran
      const { data: clientesData } = await supabase
        .from('ventas')
        .select(`
          total,
          cliente:clientes (nombre)
        `)
        .eq('estado', 'completada')
        .gte('fecha_venta', fechaInicioStr)
        .not('id_cliente', 'is', null)

      const clientesDataArray = clientesData as VentaClienteData[] | null
      const clientesMap = new Map<string, { compras: number, gastado: number }>()
      
      clientesDataArray?.forEach((v) => {
        const nombre = v.cliente?.nombre || 'Cliente Mostrador'
        const existe = clientesMap.get(nombre)
        if (existe) {
          existe.compras += 1
          existe.gastado += v.total
        } else {
          clientesMap.set(nombre, {
            compras: 1,
            gastado: v.total
          })
        }
      })

      const clientesArray: ClienteTop[] = Array.from(clientesMap.entries()).map(([nombre, datos]) => ({
        nombre,
        total_compras: datos.compras,
        total_gastado: datos.gastado
      }))
      clientesArray.sort((a, b) => b.total_gastado - a.total_gastado)
      setClientesTop(clientesArray.slice(0, 5))

    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [periodo])

  // ============================================
  // USEEFFECT CON VERIFICACIÓN DE ROL
  // ============================================

  useEffect(() => {
    const iniciar = async () => {
      const tieneAcceso = await verificarRol()
      if (!tieneAcceso) return
      
      await verificarSesion()
      await cargarReportes()
      setAutorizado(true)
    }
    iniciar()
  }, [verificarRol, verificarSesion, cargarReportes])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const exportarExcel = () => {
    const datos = productosTop.map(p => ({
      Producto: p.nombre,
      'Cantidad Vendida': p.total_vendido,
      'Ingresos': `$${p.total_ingresos.toFixed(2)}`
    }))
    
    const csv = ['Producto,Cantidad Vendida,Ingresos']
    datos.forEach(d => {
      csv.push(`${d.Producto},${d['Cantidad Vendida']},${d['Ingresos']}`)
    })
    
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte_${periodo}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

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
              <p className="text-[#00aaff] text-xs">Reportes y Estadísticas</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-white hover:text-[#00aaff] transition">
              📊 Dashboard
            </button>
            <button onClick={() => router.push('/ventas/nueva')} className="text-white hover:text-[#00aaff] transition">
              🛒 Nueva Venta
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
          <h2 className="text-2xl font-bold text-[#003366]">📊 Reportes y Estadísticas</h2>
          <div className="flex gap-3">
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003366]"
            >
              <option value="dia">Último día</option>
              <option value="semana">Última semana</option>
              <option value="mes">Último mes</option>
              <option value="anio">Último año</option>
            </select>
            <button
              onClick={exportarExcel}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2"
            >
              <Download size={18} /> Exportar
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">Cargando reportes...</div>
        ) : (
          <>
            {/* Tarjetas de resumen */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-[#003366]">
                <div className="flex justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">Total Ventas</p>
                    <p className="text-3xl font-bold text-[#003366]">{resumen.total_ventas}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-[#00aaff]" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
                <div className="flex justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">Ingresos Totales</p>
                    <p className="text-2xl font-bold text-green-600">${resumen.total_ingresos.toFixed(2)}</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-green-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
                <div className="flex justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">Ganancias Estimadas</p>
                    <p className="text-2xl font-bold text-yellow-600">${resumen.total_ganancias.toFixed(2)}</p>
                  </div>
                  <Package className="w-8 h-8 text-yellow-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
                <div className="flex justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">Ticket Promedio</p>
                    <p className="text-2xl font-bold text-purple-600">${resumen.ticket_promedio.toFixed(2)}</p>
                  </div>
                  <Users className="w-8 h-8 text-purple-500" />
                </div>
              </div>
            </div>

            {/* Productos más vendidos */}
            <div className="bg-white rounded-lg shadow mb-8">
              <div className="px-6 py-4 border-b">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Package size={20} /> Productos más vendidos
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ingresos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {productosTop.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-8 text-center text-gray-500">No hay datos disponibles</td>
                      </tr>
                    ) : (
                      productosTop.map((p, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-6 py-4 font-medium">{p.nombre}</td>
                          <td className="px-6 py-4 text-center">{p.total_vendido} unidades</td>
                          <td className="px-6 py-4 text-right font-bold text-green-600">${p.total_ingresos.toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Clientes que más compran */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Users size={20} /> Clientes que más compran
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Compras</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Gastado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {clientesTop.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-8 text-center text-gray-500">No hay datos disponibles</td>
                      </tr>
                    ) : (
                      clientesTop.map((c, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-6 py-4 font-medium">{c.nombre}</td>
                          <td className="px-6 py-4 text-center">{c.total_compras} compras</td>
                          <td className="px-6 py-4 text-right font-bold text-[#003366]">${c.total_gastado.toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}