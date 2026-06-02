'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { TrendingUp, Package, DollarSign, Users, Download, FileText, FileSpreadsheet } from 'lucide-react'

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

interface ProductoExport {
  Producto: string
  'Cantidad Vendida': number
  'Ingresos': string
  'Precio Promedio': string
}

interface ClienteExport {
  Cliente: string
  Compras: number
  'Total Gastado': string
  'Ticket Promedio': string
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

      const { data: ventas } = await supabase
        .from('ventas')
        .select('total, subtotal')
        .eq('estado', 'completada')
        .gte('fecha_venta', fechaInicioStr)

      const ventasData = ventas as VentaData[] | null
      const totalVentas = ventasData?.length || 0
      const totalIngresos = ventasData?.reduce((sum, v) => sum + (v.total || 0), 0) || 0
      const totalGanancias = totalIngresos * 0.4
      const ticketPromedio = totalVentas > 0 ? totalIngresos / totalVentas : 0

      setResumen({
        total_ventas: totalVentas,
        total_ingresos: totalIngresos,
        total_ganancias: totalGanancias,
        ticket_promedio: ticketPromedio
      })

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

  // ============================================
  // EXPORTACIÓN A PDF
  // ============================================
  const exportarPDF = async () => {
    const { default: jsPDF } = await import('jspdf')
    const fechaArchivo = new Date().toISOString().split('T')[0]
    const periodoTexto =
      periodo === 'dia' ? 'Último día' :
      periodo === 'semana' ? 'Última semana' :
      periodo === 'mes' ? 'Último mes' : 'Último año'

    const doc = new jsPDF()

    const azul: [number, number, number] = [0, 51, 102]
    const verde: [number, number, number] = [22, 163, 74]
    const amarillo: [number, number, number] = [202, 138, 4]
    const morado: [number, number, number] = [126, 34, 206]
    const gris: [number, number, number] = [107, 114, 128]
    const blanco: [number, number, number] = [255, 255, 255]
    const grisClaro: [number, number, number] = [245, 245, 245]

    // ── Encabezado ──────────────────────────────
    doc.setFillColor(...azul)
    doc.rect(0, 0, 210, 30, 'F')

    doc.setTextColor(...blanco)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('JJPantalones', 14, 13)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Reporte de Ventas', 14, 22)
    doc.text(`Periodo: ${periodoTexto}`, 120, 13)
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-SV')}`, 120, 22)

    let y = 42

    // ── Resumen General ──────────────────────────
    doc.setTextColor(...azul)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Resumen General', 14, y)
    y += 4

    const tarjetas = [
      { label: 'Total Ventas',      valor: `${resumen.total_ventas}`,                  color: azul },
      { label: 'Ingresos Totales',  valor: `$${resumen.total_ingresos.toFixed(2)}`,    color: verde },
      { label: 'Ganancias Est.',    valor: `$${resumen.total_ganancias.toFixed(2)}`,   color: amarillo },
      { label: 'Ticket Promedio',   valor: `$${resumen.ticket_promedio.toFixed(2)}`,   color: morado },
    ]

    tarjetas.forEach((t, i) => {
      const x = 14 + i * 46
      doc.setFillColor(...t.color)
      doc.roundedRect(x, y, 43, 22, 2, 2, 'F')
      doc.setTextColor(...blanco)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text(t.label, x + 3, y + 8)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(t.valor, x + 3, y + 17)
    })
    y += 32

    // ── Tabla Productos ──────────────────────────
    doc.setTextColor(...azul)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Productos mas vendidos', 14, y)
    y += 5

    // Cabecera tabla
    doc.setFillColor(...azul)
    doc.rect(14, y, 182, 9, 'F')
    doc.setTextColor(...blanco)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('#',   17,  y + 6)
    doc.text('Producto',  26,  y + 6)
    doc.text('Cantidad', 125,  y + 6)
    doc.text('Ingresos',  162, y + 6)
    y += 9

    if (productosTop.length === 0) {
      doc.setFillColor(...grisClaro)
      doc.rect(14, y, 182, 9, 'F')
      doc.setTextColor(...gris)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'italic')
      doc.text('Sin datos disponibles', 17, y + 6)
      y += 9
    } else {
      productosTop.forEach((p, i) => {
        if (i % 2 === 0) {
          doc.setFillColor(...grisClaro)
          doc.rect(14, y, 182, 9, 'F')
        }
        doc.setTextColor(30, 30, 30)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.text(`${i + 1}`, 17, y + 6)
        doc.text(p.nombre.substring(0, 48), 26, y + 6)
        doc.text(`${p.total_vendido} uds`, 125, y + 6)
        doc.setTextColor(...verde)
        doc.setFont('helvetica', 'bold')
        doc.text(`$${p.total_ingresos.toFixed(2)}`, 162, y + 6)
        y += 9
      })
    }
    y += 10

    // ── Tabla Clientes ───────────────────────────
    doc.setTextColor(...azul)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Clientes que mas compran', 14, y)
    y += 5

    // Cabecera tabla
    doc.setFillColor(...azul)
    doc.rect(14, y, 182, 9, 'F')
    doc.setTextColor(...blanco)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('#',   17,  y + 6)
    doc.text('Cliente',   26,  y + 6)
    doc.text('Compras',  125,  y + 6)
    doc.text('Total Gastado', 155, y + 6)
    y += 9

    if (clientesTop.length === 0) {
      doc.setFillColor(...grisClaro)
      doc.rect(14, y, 182, 9, 'F')
      doc.setTextColor(...gris)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'italic')
      doc.text('Sin datos disponibles', 17, y + 6)
      y += 9
    } else {
      clientesTop.forEach((c, i) => {
        if (i % 2 === 0) {
          doc.setFillColor(...grisClaro)
          doc.rect(14, y, 182, 9, 'F')
        }
        doc.setTextColor(30, 30, 30)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.text(`${i + 1}`, 17, y + 6)
        doc.text(c.nombre.substring(0, 48), 26, y + 6)
        doc.text(`${c.total_compras}`, 125, y + 6)
        doc.setTextColor(...azul)
        doc.setFont('helvetica', 'bold')
        doc.text(`$${c.total_gastado.toFixed(2)}`, 155, y + 6)
        y += 9
      })
    }

    // ── Pie de página ────────────────────────────
    const pageHeight = doc.internal.pageSize.height
    doc.setFillColor(...azul)
    doc.rect(0, pageHeight - 14, 210, 14, 'F')
    doc.setTextColor(...blanco)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(
      'Sistema JJPantalones | Pantalones por Mayoreo | El Salvador',
      14,
      pageHeight - 5
    )

    doc.save(`reporte_${periodo}_${fechaArchivo}.pdf`)
  }

  // ============================================
  // EXPORTACIÓN A EXCEL (CSV)
  // ============================================
  const exportarExcel = () => {
    const fechaArchivo = new Date().toISOString().split('T')[0]
    const periodoTexto =
      periodo === 'dia' ? 'Ultimo dia' :
      periodo === 'semana' ? 'Ultima semana' :
      periodo === 'mes' ? 'Ultimo mes' : 'Ultimo año'

    const productosExport: ProductoExport[] = productosTop.map((p) => ({
      Producto: p.nombre,
      'Cantidad Vendida': p.total_vendido,
      'Ingresos': `$${p.total_ingresos.toFixed(2)}`,
      'Precio Promedio': p.total_vendido > 0 ? `$${(p.total_ingresos / p.total_vendido).toFixed(2)}` : '$0.00'
    }))

    const clientesExport: ClienteExport[] = clientesTop.map((c) => ({
      Cliente: c.nombre,
      Compras: c.total_compras,
      'Total Gastado': `$${c.total_gastado.toFixed(2)}`,
      'Ticket Promedio': c.total_compras > 0 ? `$${(c.total_gastado / c.total_compras).toFixed(2)}` : '$0.00'
    }))

    let csvContent = ''
    csvContent += '========================================\n'
    csvContent += 'JJPANTALONES - REPORTE DE VENTAS\n'
    csvContent += '========================================\n'
    csvContent += `Fecha de exportacion,${new Date().toLocaleString('es-SV')}\n`
    csvContent += `Periodo,${periodoTexto}\n\n`

    csvContent += '=== RESUMEN GENERAL ===\n'
    csvContent += `Total Ventas,${resumen.total_ventas}\n`
    csvContent += `Ingresos Totales,$${resumen.total_ingresos.toFixed(2)}\n`
    csvContent += `Ganancias Estimadas,$${resumen.total_ganancias.toFixed(2)}\n`
    csvContent += `Ticket Promedio,$${resumen.ticket_promedio.toFixed(2)}\n\n`

    csvContent += '=== PRODUCTOS MAS VENDIDOS ===\n'
    if (productosExport.length > 0) {
      const headersProductos = Object.keys(productosExport[0]) as (keyof ProductoExport)[]
      csvContent += headersProductos.join(',') + '\n'
      productosExport.forEach(row => {
        csvContent += headersProductos.map(h => row[h]).join(',') + '\n'
      })
    } else {
      csvContent += 'No hay datos disponibles\n'
    }
    csvContent += '\n'

    csvContent += '=== CLIENTES QUE MAS COMPRAN ===\n'
    if (clientesExport.length > 0) {
      const headersClientes = Object.keys(clientesExport[0]) as (keyof ClienteExport)[]
      csvContent += headersClientes.join(',') + '\n'
      clientesExport.forEach(row => {
        csvContent += headersClientes.map(h => row[h]).join(',') + '\n'
      })
    } else {
      csvContent += 'No hay datos disponibles\n'
    }
    csvContent += '\n'

    csvContent += '========================================\n'
    csvContent += 'Sistema JJPANTALONES\n'
    csvContent += 'Pantalones por Mayoreo | El Salvador\n'
    csvContent += '========================================\n'

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte_${periodo}_${fechaArchivo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Loading / acceso ─────────────────────────
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
      {/* ── Header ── */}
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
            <button
              onClick={handleLogout}
              className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* ── Título + controles ── */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-[#003366]">📊 Reportes y Estadísticas</h2>
          <div className="flex gap-3 items-center">
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

            {/* Botón PDF */}
            <button
              onClick={exportarPDF}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition flex items-center gap-2"
            >
              <FileText size={18} /> PDF
            </button>

            {/* Botón Excel */}
            <button
              onClick={exportarExcel}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2"
            >
              <FileSpreadsheet size={18} /> Excel
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">Cargando reportes...</div>
        ) : (
          <>
            {/* ── Tarjetas resumen ── */}
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

            {/* ── Tabla Productos ── */}
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ingresos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {productosTop.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                          No hay datos disponibles
                        </td>
                      </tr>
                    ) : (
                      productosTop.map((p, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-gray-400 font-medium">{i + 1}</td>
                          <td className="px-6 py-4 font-medium">{p.nombre}</td>
                          <td className="px-6 py-4 text-center">{p.total_vendido} unidades</td>
                          <td className="px-6 py-4 text-right font-bold text-green-600">
                            ${p.total_ingresos.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Tabla Clientes ── */}
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Compras</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Gastado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {clientesTop.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                          No hay datos disponibles
                        </td>
                      </tr>
                    ) : (
                      clientesTop.map((c, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-gray-400 font-medium">{i + 1}</td>
                          <td className="px-6 py-4 font-medium">{c.nombre}</td>
                          <td className="px-6 py-4 text-center">{c.total_compras} compras</td>
                          <td className="px-6 py-4 text-right font-bold text-[#003366]">
                            ${c.total_gastado.toFixed(2)}
                          </td>
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