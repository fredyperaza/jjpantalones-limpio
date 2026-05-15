'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Search, Plus, Minus, Trash2, ShoppingCart, Printer } from 'lucide-react'

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
  numero_documento: string
  tipo_documento: string
}

// Helper function FUERA del componente
const generarNumeroFactura = () => {
  return `FAC-${Date.now()}`
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
  const router = useRouter()
  
  const nextIdRef = useRef(1)

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
      .select('id, nombre, telefono, numero_documento, tipo_documento')
      .limit(50)
    setClientes(data || [])
  }, [])

  // ✅ Cliente seleccionado calculado DURANTE el render
  const clienteSeleccionado = clienteId ? clientes.find(c => c.id === clienteId) || null : null

  const calcularSubtotal = () => {
    return carrito.reduce((sum, item) => sum + item.subtotal, 0)
  }

  const calcularIVA = () => {
    return calcularSubtotal() * 0.13
  }

  const calcularTotal = () => {
    return calcularSubtotal() + calcularIVA()
  }

  const subtotal = calcularSubtotal()
  const iva = calcularIVA()
  const total = calcularTotal()

  // ============================================
  // USEEFFECT CON VERIFICACIÓN DE ROL
  // ============================================

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

  // Función para imprimir ticket
  const imprimirTicket = (factura: string, cliente: Cliente | null) => {
    const fecha = new Date().toLocaleString('es-SV', {
      dateStyle: 'short',
      timeStyle: 'short'
    })

    const htmlTicket = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Ticket ${factura}</title>
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
          .ticket {
            text-align: center;
          }
          .header {
            margin-bottom: 15px;
          }
          .logo {
            font-size: 18px;
            font-weight: bold;
            color: #003366;
          }
          .subtitle {
            font-size: 10px;
            color: #666;
          }
          .line {
            border-top: 1px dashed #000;
            margin: 10px 0;
          }
          .line-solid {
            border-top: 1px solid #000;
            margin: 10px 0;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
          }
          .producto-row {
            display: flex;
            justify-content: space-between;
            margin: 3px 0;
            font-size: 11px;
          }
          .total {
            font-size: 14px;
            font-weight: bold;
          }
          .gracias {
            margin-top: 15px;
            font-size: 10px;
            color: #666;
          }
          @media print {
            body { margin: 0; padding: 10px; }
            .no-print { display: none; }
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
            <span><strong>${factura}</strong></span>
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
            <span><strong>${cliente?.nombre || 'Cliente Mostrador'}</strong></span>
          </div>
          ${cliente?.numero_documento ? `
          <div class="info-row">
            <span>DOCUMENTO:</span>
            <span>${cliente.tipo_documento}: ${cliente.numero_documento}</span>
          </div>
          ` : ''}
          
          <div class="line"></div>
          
          <div>
            <div class="info-row" style="font-weight: bold;">
              <span>PRODUCTO</span>
              <span>CANT x PRECIO</span>
            </div>
            ${carrito.map(item => `
              <div class="producto-row">
                <span>${item.nombre} (${item.talla}/${item.color})</span>
                <span>${item.cantidad} x $${item.precio.toFixed(2)}</span>
              </div>
              <div class="producto-row" style="margin-left: 10px;">
                <span></span>
                <span>= $${item.subtotal.toFixed(2)}</span>
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
              ${metodoPago === 'efectivo' ? '💵 Efectivo' : 
                metodoPago === 'tarjeta' ? '💳 Tarjeta' : 
                metodoPago === 'transferencia' ? '🏦 Transferencia' : metodoPago}
                
            </span>
          </div>
          
          <div class="line"></div>
          
          <div class="gracias">
            ¡Gracias por su compra!<br/>
            Visítenos nuevamente
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

  const finalizarVenta = async () => {
    if (carrito.length === 0) {
      alert('Agregue productos al carrito')
      return
    }

    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('Usuario no autenticado')
      }

      let clienteFinal = clienteId
      let clienteInfo: Cliente | null = clienteSeleccionado

      if (!clienteFinal) {
        const { data: mostrador } = await supabase
          .from('clientes')
          .select('id, nombre, telefono, numero_documento, tipo_documento')
          .eq('nombre', 'Cliente Mostrador')
          .single()
        
        if (mostrador) {
          clienteFinal = mostrador.id
          clienteInfo = mostrador as Cliente
        }
      }

      const factura = generarNumeroFactura()
      
      const { data: venta, error: errorVenta } = await supabase
        .from('ventas')
        .insert({
          numero_factura: factura,
          id_cliente: clienteFinal || null,
          id_usuario: user.id,
          subtotal: subtotal,
          descuento: 0,
          impuesto: iva,
          total: total,
          metodo_pago: metodoPago,
          estado: 'completada'
        })
        .select()
        .single()

      if (errorVenta) throw errorVenta

      for (const item of carrito) {
        const { error: errorDetalle } = await supabase
          .from('detalle_ventas')
          .insert({
            id_venta: venta.id,
            id_producto: item.productoId,
            cantidad: item.cantidad,
            precio_unitario: item.precio
          })

        if (errorDetalle) throw errorDetalle
      }

      imprimirTicket(factura, clienteInfo)
      
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
              <p className="text-[#00aaff] text-xs">Punto de Venta</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-white hover:text-[#00aaff] transition">
              📊 Dashboard
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

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna izquierda: Productos */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-xl font-bold text-[#003366] mb-4">Productos</h2>
              
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar por nombre o talla..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003366]"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-125 overflow-y-auto">
                {productosFiltrados.slice(0, 30).map((producto) => (
                  <button
                    key={producto.id}
                    onClick={() => agregarAlCarrito(producto)}
                    className="border rounded-lg p-3 text-left hover:bg-gray-50 hover:border-[#003366] transition"
                  >
                    <p className="font-semibold text-sm">{producto.nombre}</p>
                    <p className="text-xs text-gray-500">{producto.talla} / {producto.color}</p>
                    <p className="text-[#003366] font-bold mt-1">${producto.precio_venta}</p>
                    <p className="text-xs text-gray-400">Stock: {producto.stock_actual}</p>
                  </button>
                ))}
                {productosFiltrados.length === 0 && (
                  <p className="text-gray-500 col-span-3 text-center py-8">No hay productos disponibles</p>
                )}
              </div>
            </div>
          </div>

          {/* Columna derecha: Carrito */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-4 sticky top-20">
              <div className="flex items-center gap-2 mb-4">
                <ShoppingCart className="text-[#003366]" />
                <h2 className="text-xl font-bold text-[#003366]">Carrito</h2>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Cliente</label>
                <select
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003366]"
                >
                  <option value="">Cliente Mostrador (por defecto)</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Método de pago</label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="efectivo">💵 Efectivo</option>
                  <option value="tarjeta">💳 Tarjeta</option>
                  <option value="transferencia">🏦 Transferencia</option>
                  
                </select>
              </div>

              <div className="border-t pt-3 max-h-75 overflow-y-auto">
                {carrito.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">Carrito vacío</p>
                ) : (
                  carrito.map((item) => (
                    <div key={item.id} className="flex justify-between items-center py-2 border-b">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.nombre}</p>
                        <p className="text-xs text-gray-500">{item.talla} / {item.color}</p>
                        <p className="text-xs">${item.precio} c/u</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => actualizarCantidad(item.id, item.cantidad - 1)}
                          className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center">{item.cantidad}</span>
                        <button
                          onClick={() => actualizarCantidad(item.id, item.cantidad + 1)}
                          className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300"
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          onClick={() => eliminarDelCarrito(item.id)}
                          className="text-red-500 ml-2"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t pt-3 mt-3">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>IVA (13%):</span>
                  <span>${iva.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold mt-2 pt-2 border-t">
                  <span>Total:</span>
                  <span className="text-[#003366]">${total.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={finalizarVenta}
                  disabled={loading || carrito.length === 0}
                  className="flex-1 bg-[#003366] text-white py-3 rounded-lg hover:bg-[#002244] transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Printer size={18} />
                  {loading ? 'Procesando...' : 'Finalizar Venta'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}