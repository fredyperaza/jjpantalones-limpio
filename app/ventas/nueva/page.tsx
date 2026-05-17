'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Search, ShoppingCart, Printer, MessageCircle, Download } from 'lucide-react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

interface Producto {
  id: string
  nombre: string
  talla: string
  color: string
  precio_venta: number
  stock_actual: number
}

interface ItemCarrito {
  id: string
  productoId: string
  nombre: string
  talla: string
  color: string
  cantidad: number
  precio: number
  subtotal: number
}

interface Cliente {
  id: string
  nombre: string
  telefono: string
  email: string
  numero_documento: string
  tipo_documento: string
}

export default function NuevaVentaPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [search, setSearch] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState('')
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [loading, setLoading] = useState(false)
  const [autorizado, setAutorizado] = useState(false)
  const [ultimaFactura, setUltimaFactura] = useState('')
  const [ultimoCliente, setUltimoCliente] = useState<Cliente | null>(null)
  const router = useRouter()
  
  const nextIdRef = useRef(1)
  const ticketRef = useRef<HTMLDivElement>(null)

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

  const generarIdUnico = () => {
    const id = nextIdRef.current
    nextIdRef.current += 1
    return `item-${id}`
  }

  const verificarSesion = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      router.push('/login')
    }
  }, [router])

  const cargarProductos = useCallback(async () => {
    const { data } = await supabase
      .from('productos')
      .select('id, nombre, talla, color, precio_venta, stock_actual')
      .eq('activo', true)
      .gt('stock_actual', 0)
    setProductos(data || [])
  }, [])

  const cargarClientes = useCallback(async () => {
    const { data } = await supabase
      .from('clientes')
      .select('id, nombre, telefono, email, numero_documento, tipo_documento')
      .limit(50)
    setClientes(data || [])
  }, [])

  const clienteSeleccionado = clienteId ? clientes.find(c => c.id === clienteId) || null : null

  const total = carrito.reduce((sum, item) => sum + (item.cantidad * item.precio), 0)

  const generarNumeroFactura = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('siguiente_numero_factura')
      if (error) {
        console.error('Error de Supabase:', error)
        return `FAC-${Date.now()}`
      }
      if (!data) {
        console.error('No se recibió data')
        return `FAC-${Date.now()}`
      }
      return data
    } catch (error) {
      console.error('Error en try-catch:', error)
      return `FAC-${Date.now()}`
    }
  }, [])

  // ============================================
  // FUNCIÓN PARA GENERAR PDF DEL TICKET
  // ============================================
  const generarPDF = async (factura: string, cliente: Cliente | null, items: ItemCarrito[], totalVal: number, pagoMetodo: string) => {
    const subtotalSinIVA = totalVal / 1.13
    const ivaCalculado = totalVal - subtotalSinIVA
    const fecha = new Date().toLocaleString('es-SV')
    
    // Crear elemento temporal para el ticket
    const ticketElement = document.createElement('div')
    ticketElement.style.width = '350px'
    ticketElement.style.padding = '20px'
    ticketElement.style.backgroundColor = 'white'
    ticketElement.style.fontFamily = 'monospace'
    ticketElement.style.fontSize = '12px'
    ticketElement.innerHTML = `
      <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px;">
        <h2 style="margin: 0; color: #003366;">JJPantalones</h2>
        <p style="margin: 5px 0;">Pantalones por Mayoreo</p>
        <p style="margin: 2px 0;">El Salvador 🇸🇻</p>
        <p style="margin: 2px 0;">NIT: 0614-123456-789-0</p>
      </div>
      
      <div style="margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between;">
          <span>FACTURA:</span>
          <span><strong>${factura}</strong></span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>FECHA:</span>
          <span>${fecha}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>CAJA:</span>
          <span>Principal</span>
        </div>
      </div>
      
      <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 10px 0; margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between;">
          <span>CLIENTE:</span>
          <span><strong>${cliente?.nombre || 'Cliente Mostrador'}</strong></span>
        </div>
        ${cliente?.numero_documento ? `
        <div style="display: flex; justify-content: space-between;">
          <span>DOCUMENTO:</span>
          <span>${cliente.tipo_documento}: ${cliente.numero_documento}</span>
        </div>
        ` : ''}
        ${cliente?.telefono ? `
        <div style="display: flex; justify-content: space-between;">
          <span>TELÉFONO:</span>
          <span>${cliente.telefono}</span>
        </div>
        ` : ''}
      </div>
      
      <div style="margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 5px; margin-bottom: 5px;">
          <span>PRODUCTO</span>
          <span>SUB TOTAL</span>
        </div>
        ${items.map(item => `
          <div style="margin-bottom: 5px;">
            <div>${item.cantidad}x ${item.nombre} (${item.talla}/${item.color})</div>
            <div style="text-align: right;">$${(item.cantidad * item.precio).toFixed(2)}</div>
          </div>
        `).join('')}
      </div>
      
      <div style="border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px;">
        <div style="display: flex; justify-content: space-between;">
          <span>SUBTOTAL:</span>
          <span>$${subtotalSinIVA.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>IVA (13%):</span>
          <span>$${ivaCalculado.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; margin-top: 5px; padding-top: 5px; border-top: 1px solid #000;">
          <span>TOTAL:</span>
          <span>$${totalVal.toFixed(2)}</span>
        </div>
      </div>
      
      <div style="border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px;">
        <div style="display: flex; justify-content: space-between;">
          <span>MÉTODO DE PAGO:</span>
          <span>${pagoMetodo === 'efectivo' ? '💵 Efectivo' : pagoMetodo === 'tarjeta' ? '💳 Tarjeta' : '🏦 Transferencia'}</span>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 15px; padding-top: 10px; border-top: 1px dashed #000;">
        <p>¡Gracias por su compra!</p>
        <p style="font-size: 10px;">Visítenos nuevamente</p>
      </div>
    `
    
    document.body.appendChild(ticketElement)
    
    try {
      const canvas = await html2canvas(ticketElement, {
        scale: 2,
        backgroundColor: '#ffffff'
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      })
      const imgWidth = 190
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight)
      pdf.save(`Ticket_${factura}.pdf`)
    } catch (error) {
      console.error('Error al generar PDF:', error)
      alert('Error al generar el PDF')
    } finally {
      document.body.removeChild(ticketElement)
    }
  }

  // ============================================
  // FUNCIÓN PARA ENVIAR PDF POR WHATSAPP
  // ============================================
  const enviarPDFporWhatsApp = async (cliente: Cliente | null, factura: string, totalVal: number, items: ItemCarrito[], pagoMetodo: string) => {
    if (!cliente?.telefono) {
      alert('El cliente no tiene número de teléfono registrado.')
      return false
    }
    
    // Primero generar el PDF
    const subtotalSinIVA = totalVal / 1.13
    const ivaCalculado = totalVal - subtotalSinIVA
    const fecha = new Date().toLocaleString('es-SV')
    
    const ticketElement = document.createElement('div')
    ticketElement.style.width = '350px'
    ticketElement.style.padding = '20px'
    ticketElement.style.backgroundColor = 'white'
    ticketElement.style.fontFamily = 'monospace'
    ticketElement.style.fontSize = '12px'
    ticketElement.innerHTML = `
      <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px;">
        <h2 style="margin: 0; color: #003366;">JJPantalones</h2>
        <p>Pantalones por Mayoreo | El Salvador 🇸🇻</p>
        <p>NIT: 0614-123456-789-0</p>
      </div>
      <div><strong>FACTURA:</strong> ${factura}</div>
      <div><strong>FECHA:</strong> ${fecha}</div>
      <div><strong>CLIENTE:</strong> ${cliente?.nombre || 'Cliente Mostrador'}</div>
      ${cliente?.numero_documento ? `<div><strong>DOCUMENTO:</strong> ${cliente.tipo_documento}: ${cliente.numero_documento}</div>` : ''}
      <div style="border-top: 1px dashed #000; margin: 10px 0;"></div>
      ${items.map(item => `<div>${item.cantidad}x ${item.nombre} (${item.talla}/${item.color}) - $${(item.cantidad * item.precio).toFixed(2)}</div>`).join('')}
      <div style="border-top: 1px dashed #000; margin: 10px 0;"></div>
      <div><strong>SUBTOTAL:</strong> $${subtotalSinIVA.toFixed(2)}</div>
      <div><strong>IVA (13%):</strong> $${ivaCalculado.toFixed(2)}</div>
      <div><strong>TOTAL:</strong> $${totalVal.toFixed(2)}</div>
      <div><strong>MÉTODO DE PAGO:</strong> ${pagoMetodo === 'efectivo' ? 'Efectivo' : pagoMetodo === 'tarjeta' ? 'Tarjeta' : 'Transferencia'}</div>
      <div style="border-top: 1px dashed #000; margin: 10px 0;"></div>
      <div>¡Gracias por su compra!</div>
    `
    
    document.body.appendChild(ticketElement)
    
    try {
      const canvas = await html2canvas(ticketElement, { scale: 2, backgroundColor: '#ffffff' })
      const imgData = canvas.toDataURL('image/png')
      
      // Crear mensaje con link para descargar (WhatsApp no permite enviar archivos directamente sin API)
      const mensaje = `*JJPANTALONES - TICKET DE COMPRA*\n\n` +
        `Factura: ${factura}\n` +
        `Cliente: ${cliente?.nombre}\n` +
        `Total: $${totalVal.toFixed(2)}\n\n` +
        `Puede descargar su ticket en el siguiente enlace:\n` +
        `(El PDF se generará al hacer clic en "Descargar Ticket" en el sistema)\n\n` +
        `¡Gracias por su compra!`
      
      let telefono = cliente.telefono.replace(/[^0-9]/g, '')
      if (!telefono.startsWith('503') && telefono.length <= 8) {
        telefono = `503${telefono}`
      }
      
      const url = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`
      window.open(url, '_blank')
      
      // También ofrecer descargar el PDF
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
      const imgWidth = 190
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight)
      pdf.save(`Ticket_${factura}.pdf`)
      
    } catch (error) {
      console.error('Error:', error)
    } finally {
      document.body.removeChild(ticketElement)
    }
    return true
  }

  useEffect(() => {
    const iniciar = async () => {
      const tieneAcceso = await verificarRol()
      if (!tieneAcceso) return
      await verificarSesion()
      await cargarProductos()
      await cargarClientes()
      setAutorizado(true)
    }
    iniciar()
  }, [verificarRol, verificarSesion, cargarProductos, cargarClientes])

  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    p.talla.toLowerCase().includes(search.toLowerCase())
  )

  const agregarAlCarrito = (producto: Producto) => {
    const existente = carrito.find(item => item.productoId === producto.id)
    if (existente) {
      if (existente.cantidad + 1 > producto.stock_actual) {
        alert(`Solo hay ${producto.stock_actual} unidades disponibles`)
        return
      }
      setCarrito(carrito.map(item =>
        item.productoId === producto.id
          ? { ...item, cantidad: item.cantidad + 1, subtotal: (item.cantidad + 1) * item.precio }
          : item
      ))
    } else {
      setCarrito([...carrito, {
        id: generarIdUnico(),
        productoId: producto.id,
        nombre: producto.nombre,
        talla: producto.talla,
        color: producto.color,
        cantidad: 1,
        precio: producto.precio_venta,
        subtotal: producto.precio_venta
      }])
    }
  }

  const actualizarCantidad = (id: string, nuevaCantidad: number) => {
    if (nuevaCantidad < 1) {
      eliminarDelCarrito(id)
      return
    }
    const item = carrito.find(i => i.id === id)
    if (item) {
      const producto = productos.find(p => p.id === item.productoId)
      if (producto && nuevaCantidad > producto.stock_actual) {
        alert('No hay suficiente stock')
        return
      }
    }
    setCarrito(carrito.map(item =>
      item.id === id
        ? { ...item, cantidad: nuevaCantidad, subtotal: nuevaCantidad * item.precio }
        : item
    ))
  }

  const eliminarDelCarrito = (id: string) => {
    setCarrito(carrito.filter(item => item.id !== id))
  }

  const finalizarVenta = async () => {
    if (carrito.length === 0) {
      alert('Agregue productos al carrito')
      return
    }

    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuario no autenticado')

      let clienteFinal = clienteId
      let clienteInfo: Cliente | null = clienteSeleccionado

      if (!clienteFinal) {
        const { data: mostrador } = await supabase
          .from('clientes')
          .select('id, nombre, telefono, email, numero_documento, tipo_documento')
          .eq('nombre', 'Cliente Mostrador')
          .single()
        if (mostrador) {
          clienteFinal = mostrador.id
          clienteInfo = mostrador as Cliente
        }
      }

      const factura = await generarNumeroFactura()
      setUltimaFactura(factura)
      setUltimoCliente(clienteInfo)
      
      const { data: venta, error: errorVenta } = await supabase
        .from('ventas')
        .insert({
          numero_factura: factura,
          id_cliente: clienteFinal || null,
          id_usuario: user.id,
          subtotal: total,
          descuento: 0,
          impuesto: 0,
          total: total,
          metodo_pago: metodoPago,
          estado: 'completada'
        })
        .select()
        .single()

      if (errorVenta) throw errorVenta

      for (const item of carrito) {
        await supabase.from('detalle_ventas').insert({
          id_venta: venta.id,
          id_producto: item.productoId,
          cantidad: item.cantidad,
          precio_unitario: item.precio
        })
      }

      // Preguntar qué hacer con el ticket
      const accion = confirm('¿Desea generar el ticket en PDF?\n\nAceptar = Generar PDF\nCancelar = Solo finalizar venta')
      
      if (accion) {
        await generarPDF(factura, clienteInfo, carrito, total, metodoPago)
        
        // Preguntar si enviar por WhatsApp
        if (clienteInfo?.telefono) {
          const enviarWhats = confirm('¿Desea enviar el ticket por WhatsApp?')
          if (enviarWhats) {
            await enviarPDFporWhatsApp(clienteInfo, factura, total, carrito, metodoPago)
          }
        }
      }
      
      setTimeout(() => {
        setCarrito([])
        setClienteId('')
        router.push('/dashboard')
      }, 2000)
    } catch (error) {
      console.error('Error:', error)
      alert('Error al procesar la venta')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!autorizado) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100"><div className="text-center"><div className="w-12 h-12 border-4 border-[#003366] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p className="text-gray-500">Verificando permisos...</p></div></div>
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
              <p className="text-[#00aaff] text-xs">Punto de Venta</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-white hover:text-[#00aaff] transition">📊 Dashboard</button>
            <button onClick={() => router.push('/clientes')} className="text-white hover:text-[#00aaff] transition">👥 Clientes</button>
            <button onClick={() => router.push('/ventas')} className="text-white hover:text-[#00aaff] transition">📜 Historial</button>
            <button onClick={handleLogout} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition">Salir</button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-xl font-bold text-[#003366] mb-4">Productos</h2>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input type="text" placeholder="Buscar por nombre o talla..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003366]" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-125 overflow-y-auto">
                {productosFiltrados.slice(0, 30).map((producto) => (
                  <button key={producto.id} onClick={() => agregarAlCarrito(producto)} className="border rounded-lg p-3 text-left hover:bg-gray-50 hover:border-[#003366] transition">
                    <p className="font-semibold text-sm">{producto.nombre}</p>
                    <p className="text-xs text-gray-500">{producto.talla} / {producto.color}</p>
                    <p className="text-[#003366] font-bold mt-1">${producto.precio_venta}</p>
                    <p className="text-xs text-gray-400">Stock: {producto.stock_actual}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-4 sticky top-20">
              <div className="flex items-center gap-2 mb-4"><ShoppingCart className="text-[#003366]" /><h2 className="text-xl font-bold text-[#003366]">Carrito</h2></div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Cliente</label>
                <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                  <option value="">Cliente Mostrador (por defecto)</option>
                  {clientes.map((c) => (<option key={c.id} value={c.id}>{c.nombre}</option>))}
                </select>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Método de pago</label>
                <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                  <option value="efectivo">💵 Efectivo</option>
                  <option value="tarjeta">💳 Tarjeta</option>
                  <option value="transferencia">🏦 Transferencia</option>
                </select>
              </div>
              <div className="border-t pt-3 max-h-75 overflow-y-auto">
                {carrito.map((item) => (
                  <div key={item.id} className="flex justify-between items-center py-2 border-b">
                    <div className="flex-1"><p className="font-medium text-sm">{item.nombre}</p><p className="text-xs text-gray-500">{item.talla}/{item.color}</p><p className="text-xs">${item.precio} c/u</p></div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => actualizarCantidad(item.id, item.cantidad - 1)} className="w-7 h-7 bg-gray-200 rounded-full">-</button>
                      <span className="w-8 text-center">{item.cantidad}</span>
                      <button onClick={() => actualizarCantidad(item.id, item.cantidad + 1)} className="w-7 h-7 bg-gray-200 rounded-full">+</button>
                      <button onClick={() => eliminarDelCarrito(item.id)} className="text-red-500 ml-2">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t pt-3 mt-3">
                <div className="flex justify-between"><span>TOTAL:</span><span className="text-[#003366] font-bold text-xl">${total.toFixed(2)}</span></div>
              </div>
              <button onClick={finalizarVenta} disabled={loading || carrito.length === 0} className="mt-4 w-full bg-[#003366] text-white py-3 rounded-lg hover:bg-[#002244] disabled:opacity-50 flex items-center justify-center gap-2"><Printer size={18} />{loading ? 'Procesando...' : 'Finalizar Venta'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}