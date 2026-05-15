'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Search, Eye, Printer } from 'lucide-react'

// ============================================
// INTERFACES
// ============================================

interface ClienteInfo {
  nombre: string
  numero_documento: string
  tipo_documento: string
}

interface UsuarioInfo {
  nombre_completo: string
}

interface Venta {
  id: string
  numero_factura: string
  fecha_venta: string
  total: number
  subtotal: number
  metodo_pago: string
  estado: string
  cliente: ClienteInfo | null
  usuario: UsuarioInfo | null
}

interface ProductoDetalle {
  nombre: string
  talla: string
  color: string
}

interface DetalleVenta {
  id: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  producto: ProductoDetalle | null
}

interface VentaRaw {
  id: string
  numero_factura: string
  fecha_venta: string
  total: number
  subtotal: number
  metodo_pago: string
  estado: string
  cliente: ClienteInfo[] | null
  usuario: UsuarioInfo[] | null
}

interface DetalleRaw {
  id: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  producto: ProductoDetalle[] | null
}

interface ItemDetalle {
  cantidad: number
  precio_unitario: number
  producto: { nombre: string; talla: string; color: string } | null
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

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

  // ============================================
  // VERIFICAR ROL (admin, gerente, vendedor)
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

    if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'gerente' && usuario.rol !== 'vendedor')) {
      router.push('/dashboard')
      return false
    }

    return true
  }, [router])

  // ============================================
  // FUNCIONES
  // ============================================

  const verificarSesion = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      router.push('/login')
    }
  }, [router])

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
          cliente:clientes (nombre, numero_documento, tipo_documento),
          usuario:usuarios (nombre_completo)
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

      const ventasFormateadas: Venta[] = (data || []).map((item: VentaRaw) => ({
        id: item.id,
        numero_factura: item.numero_factura,
        fecha_venta: item.fecha_venta,
        total: item.total,
        subtotal: item.subtotal,
        metodo_pago: item.metodo_pago,
        estado: item.estado,
        cliente: item.cliente?.[0] || null,
        usuario: item.usuario?.[0] || null
      }))

      setVentas(ventasFormateadas)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [fechaInicio, fechaFin])

  // ============================================
  // USEEFFECT CON VERIFICACIÓN DE ROL
  // ============================================

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

    const { data } = await supabase
      .from('detalle_ventas')
      .select(`
        id,
        cantidad,
        precio_unitario,
        subtotal,
        producto:productos (nombre, talla, color)
      `)
      .eq('id_venta', venta.id)

    if (data) {
      const detallesFormateados: DetalleVenta[] = data.map((item: DetalleRaw) => ({
        id: item.id,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        subtotal: item.subtotal,
        producto: item.producto?.[0] || null
      }))
      setDetalles(detallesFormateados)
    }
  }

  // Función para reimprimir ticket
  const reimprimirTicket = async (venta: Venta) => {
    const { data: detallesData } = await supabase
      .from('detalle_ventas')
      .select(`
        cantidad,
        precio_unitario,
        producto:productos (nombre, talla, color)
      `)
      .eq('id_venta', venta.id)

    const items: ItemDetalle[] = (detallesData || []).map((item: {
      cantidad: number
      precio_unitario: number
      producto: { nombre: string; talla: string; color: string }[] | null
    }) => ({
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      producto: item.producto?.[0] || null
    }))
    
    const fecha = new Date(venta.fecha_venta).toLocaleString('es-SV', {
      dateStyle: 'short',
      timeStyle: 'short'
    })

    const subtotal = venta.subtotal || items.reduce((sum: number, item: ItemDetalle) => {
      return sum + (item.cantidad * item.precio_unitario)
    }, 0)
    
    const iva = subtotal * 0.13
    const total = venta.total || subtotal + iva

    const htmlTicket = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Ticket ${venta.numero_factura}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', 'Lucida Console', monospace;
            font-size: 12px;
            width: 300px;
            margin: 0 auto;
            padding: 20px 10px;
            background: white;
          }
          .ticket { text-align: center; }
          .header { margin-bottom: 15px; }
          .logo { font-size: 18px; font-weight: bold; color: #003366; }
          .subtitle { font-size: 10px; color: #666; }
          .line { border-top: 1px dashed #000; margin: 10px 0; }
          .line-solid { border-top: 1px solid #000; margin: 10px 0; }
          .info-row { display: flex; justify-content: space-between; margin: 5px 0; }
          .producto-row { display: flex; justify-content: space-between; margin: 3px 0; font-size: 11px; }
          .total { font-size: 14px; font-weight: bold; }
          .gracias { margin-top: 15px; font-size: 10px; color: #666; }
          .reimpreso { font-size: 8px; color: red; margin-top: 5px; }
          @media print {
            body { margin: 0; padding: 10px; }
          }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="header">
            <div class="logo">JJPantalones</div>
            <div class="subtitle">Pantalones por Mayoreo</div>
            <div class="subtitle">El Salvador 🇸🇻</div>
            <div class="subtitle">NIT: 0614-123456-789-0</div>
          </div>
          
          <div class="line"></div>
          
          <div class="info-row">
            <span>FACTURA:</span>
            <span><strong>${venta.numero_factura}</strong></span>
          </div>
          <div class="info-row">
            <span>FECHA:</span>
            <span>${fecha}</span>
          </div>
          <div class="info-row">
            <span>CAJA:</span>
            <span>Principal</span>
          </div>
          
          <div class="line"></div>
          
          <div class="info-row">
            <span>CLIENTE:</span>
            <span><strong>${venta.cliente?.nombre || 'Cliente Mostrador'}</strong></span>
          </div>
          ${venta.cliente?.numero_documento ? `
          <div class="info-row">
            <span>DOCUMENTO:</span>
            <span>${venta.cliente.tipo_documento}: ${venta.cliente.numero_documento}</span>
          </div>
          ` : ''}
          
          <div class="line"></div>
          
          <div>
            <div class="info-row" style="font-weight: bold;">
              <span>PRODUCTO</span>
              <span>CANT x PRECIO</span>
            </div>
            ${items.map((item: ItemDetalle) => `
              <div class="producto-row">
                <span>${item.producto?.nombre || 'Producto'} (${item.producto?.talla || ''}/${item.producto?.color || ''})</span>
                <span>${item.cantidad} x $${item.precio_unitario.toFixed(2)}</span>
              </div>
              <div class="producto-row" style="margin-left: 10px;">
                <span></span>
                <span>= $${(item.cantidad * item.precio_unitario).toFixed(2)}</span>
              </div>
            `).join('')}
          </div>
          
          <div class="line"></div>
          
          <div class="info-row">
            <span>SUBTOTAL:</span>
            <span>$${subtotal.toFixed(2)}</span>
          </div>
          <div class="info-row">
            <span>IVA (13%):</span>
            <span>$${iva.toFixed(2)}</span>
          </div>
          <div class="line-solid"></div>
          <div class="info-row total">
            <span>TOTAL:</span>
            <span>$${total.toFixed(2)}</span>
          </div>
          
          <div class="line"></div>
          
          <div class="info-row">
            <span>MÉTODO DE PAGO:</span>
            <span>
              ${venta.metodo_pago === 'efectivo' ? '💵 Efectivo' : 
                venta.metodo_pago === 'tarjeta' ? '💳 Tarjeta' : 
                venta.metodo_pago === 'transferencia' ? '🏦 Transferencia' : venta.metodo_pago}
                
            </span>
          </div>
          
          <div class="line"></div>
          
          <div class="gracias">
            ¡Gracias por su compra!<br/>
            Visítenos nuevamente
          </div>
          <div class="reimpreso">
            ** REIMPRESIÓN **
          </div>
        </div>
        <script>
          window.print();
          setTimeout(() => window.close(), 1000);
        </script>
      </body>
      </html>
    `

    const ventanaTicket = window.open('', '_blank', 'width=400,height=600')
    if (ventanaTicket) {
      ventanaTicket.document.write(htmlTicket)
      ventanaTicket.document.close()
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const ventasFiltradas = ventas.filter(v =>
    v.numero_factura.toLowerCase().includes(search.toLowerCase()) ||
    v.cliente?.nombre.toLowerCase().includes(search.toLowerCase() || '')
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
            <button onClick={() => router.push('/dashboard')} className="text-white hover:text-[#00aaff] transition">
              📊 Dashboard
            </button>
            <button onClick={() => router.push('/ventas/nueva')} className="text-white hover:text-[#00aaff] transition">
              🛒 Nueva Venta
            </button>
            <button onClick={() => router.push('/clientes')} className="text-white hover:text-[#00aaff] transition">
              👥 Clientes
            </button>
            <button onClick={() => router.push('/reportes')} className="text-white hover:text-[#00aaff] transition">
              📊 Reportes
            </button>
            <button onClick={handleLogout} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition">
              Salir
            </button>
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
                        {new Date(v.fecha_venta).toLocaleString('es-SV')}
                      </td>
                      <td className="px-6 py-4">{v.cliente?.nombre || 'Cliente Mostrador'}</td>
                      <td className="px-6 py-4 font-bold text-[#003366]">${v.total.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        {v.metodo_pago === 'efectivo' ? '💵 Efectivo' :
                         v.metodo_pago === 'tarjeta' ? '💳 Tarjeta' :
                         v.metodo_pago === 'transferencia' ? '🏦 Transferencia' : v.metodo_pago}
                         
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
          Total: {ventasFiltradas.length} venta(s)
        </p>
      </main>

      {/* Modal de detalle */}
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
                  <p>{new Date(selectedVenta.fecha_venta).toLocaleString('es-SV')}</p>
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
                    <td className="px-4 py-2">
                      {d.producto?.nombre || 'Producto no disponible'}
                      {d.producto?.talla && <span className="text-xs text-gray-500 ml-1">({d.producto.talla}/{d.producto.color})</span>}
                    </td>
                    <td className="px-4 py-2 text-center">{d.cantidad}</td>
                    <td className="px-4 py-2 text-right">${d.precio_unitario.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-medium">${d.subtotal.toFixed(2)}</td>
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

            <div className="flex gap-3">
              <button
                onClick={() => reimprimirTicket(selectedVenta)}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <Printer size={18} /> Reimprimir Ticket
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