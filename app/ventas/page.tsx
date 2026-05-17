'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Search, Eye, Printer, FileDown } from 'lucide-react'

interface ClienteInfo {
  nombre: string
  numero_documento: string
  tipo_documento: string
}

interface UsuarioInfo {
  nombre_completo: string
}

interface ProductoDetalle {
  nombre: string
  talla: string
  color: string
}

interface Venta {
  id: string
  numero_factura: string
  fecha_venta: string
  total: number
  subtotal: number
  metodo_pago: string
  estado: string
  id_cliente: string | null
  cliente: ClienteInfo | null
  usuario: UsuarioInfo | null
}

interface DetalleVenta {
  id: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  producto: ProductoDetalle | null
}

interface ItemTicket {
  cantidad: number
  precio_unitario: number
  producto: ProductoDetalle | null
}

// ✅ FIX 1: Tipos raw que devuelve Supabase (producto como array)
interface DetalleRaw {
  id: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  producto: ProductoDetalle[]
}

interface ItemTicketRaw {
  cantidad: number
  precio_unitario: number
  producto: ProductoDetalle[]
}

interface VentaRaw {
  id: string
  numero_factura: string
  fecha_venta: string
  total: number
  subtotal: number
  metodo_pago: string
  estado: string
  id_cliente: string | null
  cliente: ClienteInfo[]
  usuario: UsuarioInfo[]
}

// ✅ Formatea fecha de Supabase (UTC) a hora local de El Salvador (UTC-6)
// Supabase a veces devuelve "2026-05-17T16:13:26" sin la "Z" al final,
// lo que hace que JS lo interprete como hora local en vez de UTC.
// Agregamos "Z" si falta para forzar la lectura correcta en UTC.
const formatearFechaSV = (fechaISO: string): string => {
  const fechaUTC = fechaISO.endsWith('Z') || fechaISO.includes('+') ? fechaISO : `${fechaISO}Z`
  const fecha = new Date(fechaUTC)
  return fecha.toLocaleString('es-SV', {
    timeZone: 'America/El_Salvador',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  })
}

type ClienteResponse = ClienteInfo | ClienteInfo[] | null
type UsuarioResponse = UsuarioInfo | UsuarioInfo[] | null
type ProductoResponse = ProductoDetalle | ProductoDetalle[] | null

export default function HistorialVentasPage() {
  const [ventas, setVentas] = useState<Venta[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null)
  const [detalles, setDetalles] = useState<DetalleVenta[]>([])
  const [showModal, setShowModal] = useState(false)
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
    if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'gerente' && usuario.rol !== 'vendedor')) {
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

  const obtenerClienteData = (cliente: ClienteResponse): ClienteInfo | null => {
    if (!cliente) return null
    if (Array.isArray(cliente) && cliente.length > 0) return cliente[0]
    if (!Array.isArray(cliente)) return cliente
    return null
  }

  const obtenerUsuarioData = (usuario: UsuarioResponse): UsuarioInfo | null => {
    if (!usuario) return null
    if (Array.isArray(usuario) && usuario.length > 0) return usuario[0]
    if (!Array.isArray(usuario)) return usuario
    return null
  }

  const obtenerProductoData = (producto: ProductoResponse): ProductoDetalle | null => {
    if (!producto) return null
    if (Array.isArray(producto) && producto.length > 0) return producto[0]
    if (!Array.isArray(producto)) return producto
    return null
  }

  const cargarVentas = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('ventas')
        .select(`
          id,
          numero_factura,
          fecha_venta,
          total,
          subtotal,
          metodo_pago,
          estado,
          id_cliente,
          cliente:clientes!ventas_id_cliente_fkey (
            nombre,
            numero_documento,
            tipo_documento
          ),
          usuario:usuarios!ventas_id_usuario_fkey (
            nombre_completo
          )
        `)
        .order('fecha_venta', { ascending: false })

      if (fechaInicio) {
        query = query.gte('fecha_venta', fechaInicio)
      }
      if (fechaFin) {
        query = query.lte('fecha_venta', `${fechaFin} 23:59:59`)
      }

      const { data, error } = await query

      if (error) throw error

      // ✅ FIX 2: Reemplazar `any` por VentaRaw
      const ventasFormateadas: Venta[] = (data || []).map((item: VentaRaw) => ({
        id: item.id,
        numero_factura: item.numero_factura,
        fecha_venta: item.fecha_venta,
        total: item.total,
        subtotal: item.subtotal,
        metodo_pago: item.metodo_pago,
        estado: item.estado,
        id_cliente: item.id_cliente,
        cliente: obtenerClienteData(item.cliente),
        usuario: obtenerUsuarioData(item.usuario)
      }))

      setVentas(ventasFormateadas)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [fechaInicio, fechaFin])

  useEffect(() => {
    const iniciar = async () => {
      const tieneAcceso = await verificarRol()
      if (!tieneAcceso) return
      await verificarSesion()
      await cargarVentas()
      setAutorizado(true)
    }
    iniciar()
  }, [verificarRol, verificarSesion, cargarVentas])

  const verDetalle = async (venta: Venta) => {
    setSelectedVenta(venta)
    setShowModal(true)

    const { data, error } = await supabase
      .from('detalle_ventas')
      .select(`
        id,
        cantidad,
        precio_unitario,
        subtotal,
        producto:productos!detalle_ventas_id_producto_fkey (
          nombre,
          talla,
          color
        )
      `)
      .eq('id_venta', venta.id)

    if (error) {
      console.error('Error al cargar detalles:', error)
      return
    }

    if (data) {
      // ✅ FIX 3: Reemplazar `any` por DetalleRaw (incluye id y subtotal)
      const detallesFormateados: DetalleVenta[] = (data as DetalleRaw[]).map((item: DetalleRaw) => ({
        id: item.id,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        subtotal: item.subtotal,
        producto: obtenerProductoData(item.producto)
      }))
      setDetalles(detallesFormateados)
    }
  }

  const reimprimirTicket = async (venta: Venta) => {
    const { data: detallesData, error } = await supabase
      .from('detalle_ventas')
      .select(`
        cantidad,
        precio_unitario,
        producto:productos!detalle_ventas_id_producto_fkey (
          nombre,
          talla,
          color
        )
      `)
      .eq('id_venta', venta.id)

    if (error) {
      console.error('Error al cargar detalles:', error)
      return
    }

    // ✅ FIX 4: Reemplazar `any` por ItemTicketRaw
    const items: ItemTicket[] = (detallesData as ItemTicketRaw[] || []).map((item: ItemTicketRaw) => ({
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      producto: obtenerProductoData(item.producto)
    }))

    const fechaOriginal = formatearFechaSV(venta.fecha_venta)
    const total = venta.total || items.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0)
    
    const subtotalSinIVA = total / 1.13
    const ivaCalculado = total - subtotalSinIVA

    let clienteNombre = 'Cliente Mostrador'
    let clienteDocumento = ''
    let clienteTipo = ''

    if (venta.id_cliente) {
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('nombre, numero_documento, tipo_documento')
        .eq('id', venta.id_cliente)
        .single()
      
      if (clienteData) {
        clienteNombre = clienteData.nombre
        clienteDocumento = clienteData.numero_documento || ''
        clienteTipo = clienteData.tipo_documento || ''
      }
    } else if (venta.cliente) {
      clienteNombre = venta.cliente.nombre
      clienteDocumento = venta.cliente.numero_documento || ''
      clienteTipo = venta.cliente.tipo_documento || ''
    }

    const htmlTicket = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"><title>Ticket ${venta.numero_factura}</title>
      <style>
        body { font-family: monospace; width: 300px; margin: 0 auto; padding: 20px 10px; }
        .ticket { text-align: center; }
        .line { border-top: 1px dashed #000; margin: 10px 0; }
        .line-solid { border-top: 1px solid #000; margin: 10px 0; }
        .info-row { display: flex; justify-content: space-between; margin: 5px 0; }
      </style>
      </head>
      <body>
        <div class="ticket">
          <div class="header">
            <div class="logo">JJPantalones</div>
            <div>Pantalones por Mayoreo | El Salvador 🇸🇻</div>
            <div>NIT: 0614-123456-789-0</div>
          </div>
          <div class="line"></div>
          <div class="info-row"><span>FACTURA:</span><span><strong>${venta.numero_factura}</strong></span></div>
          <div class="info-row"><span>FECHA:</span><span>${fechaOriginal}</span></div>
          <div class="info-row"><span>CAJA:</span><span>Principal</span></div>
          <div class="line"></div>
          <div class="info-row"><span>CLIENTE:</span><span><strong>${clienteNombre}</strong></span></div>
          ${clienteDocumento ? `<div class="info-row"><span>DOCUMENTO:</span><span>${clienteTipo}: ${clienteDocumento}</span></div>` : ''}
          <div class="line"></div>
          ${items.map((item) => `
            <div class="info-row"><span>${item.cantidad}x ${item.producto?.nombre || 'Producto'} (${item.producto?.talla || ''}/${item.producto?.color || ''})</span><span>$${(item.cantidad * item.precio_unitario).toFixed(2)}</span></div>
          `).join('')}
          <div class="line"></div>
          <div class="info-row"><span>SUBTOTAL:</span><span>$${subtotalSinIVA.toFixed(2)}</span></div>
          <div class="info-row"><span>IVA (13%):</span><span>$${ivaCalculado.toFixed(2)}</span></div>
          <div class="line-solid"></div>
          <div class="info-row total"><span>TOTAL:</span><span><strong>$${total.toFixed(2)}</strong></span></div>
          <div class="line"></div>
          <div class="info-row"><span>MÉTODO DE PAGO:</span><span>${venta.metodo_pago === 'efectivo' ? '💵 Efectivo' : venta.metodo_pago === 'tarjeta' ? '💳 Tarjeta' : '🏦 Transferencia'}</span></div>
          <div class="line"></div>
          <div>¡Gracias por su compra!</div>
          <div class="reimpreso">** REIMPRESIÓN **</div>
        </div>
        <script>window.print();setTimeout(() => window.close(), 1000);</script>
      </body>
      </html>
    `

    const ventanaTicket = window.open('', '_blank', 'width=400,height=600')
    if (ventanaTicket) {
      ventanaTicket.document.write(htmlTicket)
      ventanaTicket.document.close()
    }
  }

  const descargarPDF = async (venta: Venta) => {
    // Cargar detalles de la venta
    const { data: detallesData, error } = await supabase
      .from('detalle_ventas')
      .select(`
        cantidad,
        precio_unitario,
        producto:productos!detalle_ventas_id_producto_fkey (
          nombre,
          talla,
          color
        )
      `)
      .eq('id_venta', venta.id)

    if (error) {
      console.error('Error al cargar detalles:', error)
      return
    }

    const items: ItemTicket[] = (detallesData as ItemTicketRaw[] || []).map((item: ItemTicketRaw) => ({
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      producto: obtenerProductoData(item.producto)
    }))

    // Obtener datos del cliente si aplica
    let clienteNombre = 'Cliente Mostrador'
    let clienteDocumento = ''
    let clienteTipo = ''

    if (venta.id_cliente) {
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('nombre, numero_documento, tipo_documento')
        .eq('id', venta.id_cliente)
        .single()
      if (clienteData) {
        clienteNombre = clienteData.nombre
        clienteDocumento = clienteData.numero_documento || ''
        clienteTipo = clienteData.tipo_documento || ''
      }
    } else if (venta.cliente) {
      clienteNombre = venta.cliente.nombre
      clienteDocumento = venta.cliente.numero_documento || ''
      clienteTipo = venta.cliente.tipo_documento || ''
    }

    const fechaFormateada = formatearFechaSV(venta.fecha_venta)
    const total = venta.total
    const subtotalSinIVA = total / 1.13
    const ivaCalculado = total - subtotalSinIVA

    // Generar PDF con jsPDF via CDN cargado dinámicamente
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
    script.onload = () => {
      // @ts-expect-error jsPDF cargado dinámicamente
      const { jsPDF } = window.jspdf
      const doc = new jsPDF({ unit: 'mm', format: [80, 200], orientation: 'portrait' })

      const ancho = 80
      let y = 10

      const centrar = (texto: string, fontSize: number = 8) => {
        doc.setFontSize(fontSize)
        const anchoTexto = doc.getTextWidth(texto)
        doc.text(texto, (ancho - anchoTexto) / 2, y)
        y += fontSize * 0.5
      }

      const fila = (izq: string, der: string, fontSize: number = 7) => {
        doc.setFontSize(fontSize)
        doc.text(izq, 5, y)
        doc.text(der, ancho - 5 - doc.getTextWidth(der), y)
        y += 5
      }

      const linea = (punteada: boolean = false) => {
        if (punteada) {
          doc.setLineDashPattern([1, 1], 0)
        } else {
          doc.setLineDashPattern([], 0)
        }
        doc.line(5, y, ancho - 5, y)
        y += 4
      }

      // Encabezado
      doc.setFont('helvetica', 'bold')
      centrar('JJPantalones', 11)
      y += 1
      doc.setFont('helvetica', 'normal')
      centrar('Pantalones por Mayoreo', 7)
      centrar('El Salvador', 7)
      centrar('NIT: 0614-123456-789-0', 7)
      y += 2

      linea(true)

      // Datos de factura
      doc.setFont('helvetica', 'bold')
      fila('FACTURA:', venta.numero_factura, 7)
      doc.setFont('helvetica', 'normal')
      fila('FECHA:', fechaFormateada, 6.5)
      fila('CAJA:', 'Principal', 7)
      y += 1
      linea(true)

      // Cliente
      doc.setFont('helvetica', 'bold')
      fila('CLIENTE:', clienteNombre, 7)
      doc.setFont('helvetica', 'normal')
      if (clienteDocumento) {
        fila('DOCUMENTO:', `${clienteTipo}: ${clienteDocumento}`, 7)
      }
      y += 1
      linea(true)

      // Productos
      doc.setFontSize(7)
      items.forEach(item => {
        const nombre = item.producto?.nombre || 'Producto'
        const talla = item.producto?.talla || ''
        const color = item.producto?.color || ''
        const subtotalItem = (item.cantidad * item.precio_unitario).toFixed(2)
        const descripcion = `${item.cantidad}x ${nombre} (${talla}/${color})`
        // Dividir texto largo en líneas
        const lineasTexto = doc.splitTextToSize(descripcion, ancho - 20)
        doc.text(lineasTexto, 5, y)
        doc.text(`$${subtotalItem}`, ancho - 5 - doc.getTextWidth(`$${subtotalItem}`), y)
        y += lineasTexto.length * 4 + 1
      })

      y += 1
      linea(true)

      // Totales
      doc.setFont('helvetica', 'normal')
      fila('SUBTOTAL:', `$${subtotalSinIVA.toFixed(2)}`, 7)
      fila('IVA (13%):', `$${ivaCalculado.toFixed(2)}`, 7)
      y += 1
      linea(false)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      fila('TOTAL:', `$${total.toFixed(2)}`, 9)
      y += 1
      linea(true)

      // Método de pago
      doc.setFont('helvetica', 'normal')
      const metodosTexto: Record<string, string> = {
        efectivo: 'Efectivo',
        tarjeta: 'Tarjeta',
        transferencia: 'Transferencia'
      }
      fila('METODO DE PAGO:', metodosTexto[venta.metodo_pago] || venta.metodo_pago, 7)
      y += 3
      linea(true)

      // Pie
      doc.setFontSize(7)
      centrar('Gracias por su compra!', 8)

      doc.save(`Factura-${venta.numero_factura}.pdf`)
    }

    // Solo agregar el script si no está ya cargado
    if (!document.querySelector('script[src*="jspdf"]')) {
      document.head.appendChild(script)
    } else {
      script.onload?.(new Event('load'))
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const ventasFiltradas = ventas.filter(v =>
    v.numero_factura.toLowerCase().includes(search.toLowerCase()) ||
    v.cliente?.nombre?.toLowerCase().includes(search.toLowerCase())
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
              <p className="text-[#00aaff] text-xs">Historial de Ventas</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-white hover:text-[#00aaff] transition">📊 Dashboard</button>
            <button onClick={() => router.push('/ventas/nueva')} className="text-white hover:text-[#00aaff] transition">🛒 Nueva Venta</button>
            <button onClick={() => router.push('/clientes')} className="text-white hover:text-[#00aaff] transition">👥 Clientes</button>
            <button onClick={() => router.push('/reportes')} className="text-white hover:text-[#00aaff] transition">📊 Reportes</button>
            <button onClick={handleLogout} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition">Salir</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-[#003366] mb-6">📜 Historial de Ventas</h2>

        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Buscar por factura o cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003366]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Desde</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Hasta</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFechaInicio('')
                  setFechaFin('')
                  setSearch('')
                }}
                className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition"
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Factura</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pago</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center">Cargando...</td>
                  </tr>
                ) : ventasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">No hay ventas registradas</td>
                  </tr>
                ) : (
                  ventasFiltradas.map((v) => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-mono text-sm">{v.numero_factura}</td>
                      <td className="px-6 py-4 text-sm">
                        {formatearFechaSV(v.fecha_venta)}
                      </td>
                      <td className="px-6 py-4">{v.cliente?.nombre || 'Cliente Mostrador'}</td>
                      <td className="px-6 py-4 font-bold text-[#003366]">${v.total.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        {v.metodo_pago === 'efectivo' ? '💵 Efectivo' :
                         v.metodo_pago === 'tarjeta' ? '💳 Tarjeta' : '🏦 Transferencia'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${v.estado === 'completada' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {v.estado === 'completada' ? 'Completada' : v.estado}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => verDetalle(v)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Ver detalle"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => reimprimirTicket(v)}
                            className="text-green-600 hover:text-green-800"
                            title="Reimprimir ticket"
                          >
                            <Printer size={18} />
                          </button>
                          <button
                            onClick={() => descargarPDF(v)}
                            className="text-purple-600 hover:text-purple-800"
                            title="Descargar PDF"
                          >
                            <FileDown size={18} />
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
        <p className="mt-4 text-sm text-gray-500">Total: {ventasFiltradas.length} venta(s)</p>
      </main>

      {showModal && selectedVenta && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-[#003366]">Detalle de Venta</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Factura</p>
                  <p className="font-mono font-bold">{selectedVenta.numero_factura}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Fecha</p>
                  <p>{formatearFechaSV(selectedVenta.fecha_venta)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Cliente</p>
                  <p>{selectedVenta.cliente?.nombre || 'Cliente Mostrador'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Vendedor</p>
                  <p>{selectedVenta.usuario?.nombre_completo || 'Sistema'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Método de pago</p>
                  <p>{selectedVenta.metodo_pago}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="text-xl font-bold text-[#003366]">${selectedVenta.total.toFixed(2)}</p>
                </div>
              </div>
            </div>
            <h4 className="font-bold mb-3">Productos</h4>
            <div className="overflow-x-auto">
              <table className="w-full mb-4">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm">Producto</th>
                    <th className="px-4 py-2 text-center text-sm">Cantidad</th>
                    <th className="px-4 py-2 text-right text-sm">Precio</th>
                    <th className="px-4 py-2 text-right text-sm">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {detalles.map((d) => (
                    <tr key={d.id} className="border-b">
                      <td className="px-4 py-2 text-sm">
                        {d.producto?.nombre || 'Producto no disponible'}
                        {d.producto?.talla && <span className="text-xs text-gray-500 ml-1">({d.producto.talla}/{d.producto.color})</span>}
                      </td>
                      <td className="px-4 py-2 text-center text-sm">{d.cantidad}</td>
                      <td className="px-4 py-2 text-right text-sm">${d.precio_unitario.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-sm">${d.subtotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-right font-bold">Total:</td>
                    <td className="px-4 py-2 text-right font-bold text-[#003366]">${selectedVenta.total.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => reimprimirTicket(selectedVenta)}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <Printer size={18} /> Reimprimir Ticket
              </button>
              <button
                onClick={() => descargarPDF(selectedVenta)}
                className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2"
              >
                <FileDown size={18} /> Descargar PDF
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}