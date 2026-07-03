'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Search, ShoppingCart, Printer, Plus, Minus, Trash2 } from 'lucide-react'

interface Producto {
  id: string
  nombre: string
  talla: string
  color: string
  precio_venta: number
  stock_actual: number
  codigo_barras?: string
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

export default function NuevaVentaPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [search, setSearch] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState('')
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [loading, setLoading] = useState(false)
  const [autorizado, setAutorizado] = useState(false)
  const [showTallaModal, setShowTallaModal] = useState(false)
  const [productoTemporal, setProductoTemporal] = useState<Producto | null>(null)
  const [tallasDisponibles, setTallasDisponibles] = useState<string[]>([])
  const router = useRouter()

  const nextIdRef = useRef(1)

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
    const { data, error } = await supabase
      .from('productos')
      .select('id, nombre, talla, color, precio_venta, stock_actual, codigo_barras')
      .eq('activo', true)

    if (error) {
      console.error('Error al cargar productos:', error)
    }

    setProductos(data || [])
  }, [])

  const cargarClientes = useCallback(async () => {
    const { data } = await supabase
      .from('clientes')
      .select('id, nombre, telefono, numero_documento, tipo_documento')
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

  const productosFiltrados = productos.filter(p => {
    const texto = search.toLowerCase().trim()
    if (!texto) return true

    return (
      p.nombre?.toLowerCase().includes(texto) ||
      p.talla?.toLowerCase().includes(texto) ||
      p.color?.toLowerCase().includes(texto) ||
      (p.codigo_barras ? p.codigo_barras.toLowerCase().includes(texto) : false)
    )
  })

  const agregarProductoAlCarrito = (producto: Producto, tallaSeleccionada?: string) => {
    const tallaFinal = tallaSeleccionada || producto.talla

    const existente = carrito.find(item =>
      item.productoId === producto.id && item.talla === tallaFinal
    )

    if (existente) {
      if (existente.cantidad + 1 > producto.stock_actual) {
        alert(`Solo hay ${producto.stock_actual} unidades disponibles`)
        return
      }
      setCarrito(carrito.map(item =>
        item.id === existente.id
          ? { ...item, cantidad: item.cantidad + 1, subtotal: (item.cantidad + 1) * item.precio }
          : item
      ))
    } else {
      setCarrito([...carrito, {
        id: generarIdUnico(),
        productoId: producto.id,
        nombre: producto.nombre,
        talla: tallaFinal,
        color: producto.color,
        cantidad: 1,
        precio: producto.precio_venta,
        subtotal: producto.precio_venta
      }])
    }
  }

  const agregarAlCarrito = (producto: Producto) => {
    if (producto.stock_actual === 0) {
      alert('Producto sin stock disponible')
      return
    }

    if (producto.talla && producto.talla.includes(',')) {
      setProductoTemporal(producto)
      const tallas = producto.talla.split(',').map(t => t.trim()).filter(t => t !== '')
      setTallasDisponibles(tallas)
      setShowTallaModal(true)
      return
    }

    agregarProductoAlCarrito(producto)
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

  const imprimirTicket = (factura: string, cliente: Cliente | null, carritoItems: ItemCarrito[], totalVal: number, pagoMetodo: string) => {
    const fecha = new Date().toLocaleString('es-SV')

    const totalReal = carritoItems.reduce((sum, item) => sum + (item.cantidad * item.precio), 0)

    const duenaNombre = "JJPantalones"
    const duenaTelefono = "7099-7994"

    const itemsHtml = carritoItems.map(item => `
      <div style="margin-bottom: 8px;">
        <div><strong>${item.cantidad}x</strong> ${item.nombre} <span style="color: #003366;">(Talla: ${item.talla})</span></div>
        <div style="margin-left: 20px; font-size: 11px;">Precio unitario: $${item.precio.toFixed(2)}</div>
        <div style="margin-left: 20px; font-size: 11px;">Subtotal: $${(item.cantidad * item.precio).toFixed(2)}</div>
      </div>
    `).join('')

    const html = `
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
          .ticket { text-align: center; }
          .logo { font-size: 18px; font-weight: bold; color: #003366; }
          .subtitle { font-size: 10px; color: #666; }
          .line { border-top: 1px dashed #000; margin: 10px 0; }
          .line-solid { border-top: 1px solid #000; margin: 10px 0; }
          .info-row { display: flex; justify-content: space-between; margin: 5px 0; }
          .total { font-size: 14px; font-weight: bold; }
          .gracias { margin-top: 15px; font-size: 10px; color: #666; }
          @media print {
            body { margin: 0; padding: 10px; }
          }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="logo">JJPANTALONESPORMAYOREO</div>
          <div class="subtitle">Pantalones por Mayoreo</div>
          <div class="subtitle">El Salvador 🇸🇻</div>
          <div class="subtitle">📍 Avenida Independencia Sur, Callejón del Carmen</div>
          <div class="subtitle">📞 ${duenaTelefono} | Contacto: ${duenaNombre}</div>

          <div class="line"></div>

          <div class="info-row"><span>FACTURA:</span><span><strong>${factura}</strong></span></div>
          <div class="info-row"><span>FECHA:</span><span>${fecha}</span></div>
          <div class="info-row"><span>CAJA:</span><span>Principal</span></div>

          <div class="line"></div>

          <div class="info-row"><span>CLIENTE:</span><span><strong>${cliente?.nombre || 'Cliente Mostrador'}</strong></span></div>
          ${cliente?.numero_documento ? `<div class="info-row"><span>DOCUMENTO:</span><span>${cliente.tipo_documento}: ${cliente.numero_documento}</span></div>` : ''}
          ${cliente?.telefono ? `<div class="info-row"><span>TELÉFONO:</span><span>${cliente.telefono}</span></div>` : ''}

          <div class="line"></div>

          <div style="font-weight: bold; margin-bottom: 5px;">PRODUCTOS:</div>
          ${itemsHtml}

          <div class="line"></div>

          <div class="info-row total"><span>TOTAL:</span><span><strong>$${totalReal.toFixed(2)}</strong></span></div>

          <div class="line"></div>

          <div class="info-row"><span>MÉTODO DE PAGO:</span><span>${pagoMetodo === 'efectivo' ? '💵 Efectivo' : pagoMetodo === 'tarjeta' ? '💳 Tarjeta' : '🏦 Transferencia'}</span></div>

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

    const ventana = window.open('', '_blank', 'width=400,height=600')
    if (ventana) {
      ventana.document.write(html)
      ventana.document.close()
    }
  }

  // ✅ FUNCIÓN FINALIZAR VENTA COMPLETAMENTE CORREGIDA
  const finalizarVenta = async () => {
    if (carrito.length === 0) {
      alert('Agregue productos al carrito')
      return
    }

    // ✅ Validar stock antes de continuar
    for (const item of carrito) {
      const producto = productos.find(p => p.id === item.productoId)
      if (!producto) {
        alert(`El producto ${item.nombre} ya no existe`)
        return
      }
      if (producto.stock_actual < item.cantidad) {
        alert(`Stock insuficiente para ${item.nombre}. Disponible: ${producto.stock_actual}`)
        return
      }
    }

    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuario no autenticado')

      let clienteFinal = clienteId
      let clienteInfo: Cliente | null = clienteSeleccionado

      // ✅ Manejo mejorado de "Cliente Mostrador"
      if (!clienteFinal) {
        const { data: mostrador, error: mostradorError } = await supabase
          .from('clientes')
          .select('id, nombre, telefono, numero_documento, tipo_documento')
          .eq('nombre', 'Cliente Mostrador')
          .maybeSingle()  // ✅ Cambiado de .single() a .maybeSingle()

        if (mostradorError) {
          console.error('Error al buscar Cliente Mostrador:', mostradorError)
        }

        if (mostrador) {
          clienteFinal = mostrador.id
          clienteInfo = mostrador as Cliente
        } else {
          // ✅ Crear "Cliente Mostrador" si no existe
          const { data: nuevoMostrador, error: createError } = await supabase
            .from('clientes')
            .insert({
              nombre: 'Cliente Mostrador',
              tipo_documento: 'N/A',
              numero_documento: '00000000-0',
              telefono: '0000-0000',
              activo: true
            })
            .select()
            .single()

          if (createError) {
            console.error('Error al crear Cliente Mostrador:', createError)
          } else if (nuevoMostrador) {
            clienteFinal = nuevoMostrador.id
            clienteInfo = nuevoMostrador as Cliente
            await cargarClientes()  // ✅ Recargar lista de clientes
          }
        }
      }

      const factura = await generarNumeroFactura()
      const totalReal = carrito.reduce((sum, item) => sum + (item.cantidad * item.precio), 0)

      // 1. Insertar la venta
      const { data: venta, error: errorVenta } = await supabase
        .from('ventas')
        .insert({
          numero_factura: factura,
          id_cliente: clienteFinal || null,
          id_usuario: user.id,
          subtotal: totalReal,
          descuento: 0,
          impuesto: 0,
          total: totalReal,
          metodo_pago: metodoPago,
          estado: 'completada'
        })
        .select()
        .single()

      if (errorVenta) throw errorVenta

      // 2. Insertar detalles con subtotal y manejo de errores
      let erroresDetalle = false
      for (const item of carrito) {
        const { error: errorDetalle } = await supabase
          .from('detalle_ventas')
          .insert({
            id_venta: venta.id,
            id_producto: item.productoId,
            cantidad: item.cantidad,
            precio_unitario: item.precio,
            subtotal: item.cantidad * item.precio  // ✅ AGREGADO: subtotal
          })

        if (errorDetalle) {
          console.error('Error al insertar detalle:', errorDetalle)
          erroresDetalle = true
        }
      }

      // ✅ Si hay errores en detalles, marcar venta como incompleta
      if (erroresDetalle) {
        await supabase
          .from('ventas')
          .update({ estado: 'incompleta' })
          .eq('id', venta.id)
        
        alert('La venta se registró pero hubo problemas con algunos productos. La venta ha sido marcada como incompleta.')
        return
      }

      // 3. ✅ Actualizar el stock de los productos
      for (const item of carrito) {
        const producto = productos.find(p => p.id === item.productoId)
        if (producto) {
          const nuevoStock = producto.stock_actual - item.cantidad
          const { error: errorStock } = await supabase
            .from('productos')
            .update({ stock_actual: nuevoStock })
            .eq('id', item.productoId)

          if (errorStock) {
            console.error(`Error al actualizar stock de ${item.nombre}:`, errorStock)
          }
        }
      }

      // 4. ✅ Recargar productos para actualizar stock en UI
      await cargarProductos()

      // 5. Imprimir ticket
      imprimirTicket(factura, clienteInfo, carrito, totalReal, metodoPago)

      // 6. Limpiar carrito y redirigir
      setTimeout(() => {
        setCarrito([])
        setClienteId('')
        router.push('/dashboard')
      }, 2000)

    } catch (error) {
      console.error('Error:', error)
      alert('Error al procesar la venta. Por favor, verifique los datos e intente nuevamente.')
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-[#003366]">Productos</h2>
                <span className="text-xs text-gray-400">
                  {productosFiltrados.length} de {productos.length}
                </span>
              </div>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar por nombre, talla, color o código de barras..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003366]"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-125 overflow-y-auto">
                {productosFiltrados.map((producto) => (
                  <button
                    key={producto.id}
                    onClick={() => agregarAlCarrito(producto)}
                    disabled={producto.stock_actual === 0}
                    className={`border rounded-lg p-3 text-left hover:bg-gray-50 hover:border-[#003366] transition ${
                      producto.stock_actual === 0 ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <p className="font-semibold text-sm">{producto.nombre}</p>
                    <p className="text-xs text-gray-500">{producto.talla} / {producto.color}</p>
                    {producto.codigo_barras && (
                      <p className="text-[10px] text-gray-400">Cód: {producto.codigo_barras}</p>
                    )}
                    <p className="text-[#003366] font-bold mt-1">${producto.precio_venta}</p>
                    <p className={`text-xs ${producto.stock_actual === 0 ? 'text-red-500' : 'text-gray-400'}`}>
                      {producto.stock_actual === 0 ? 'Sin stock' : `Stock: ${producto.stock_actual}`}
                    </p>
                  </button>
                ))}
                {productosFiltrados.length === 0 && (
                  <p className="text-gray-500 col-span-full text-center py-8">
                    No hay productos que coincidan con la búsqueda
                  </p>
                )}
              </div>
            </div>
          </div>

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
                  {clientes.map((c) => (<option key={c.id} value={c.id}>{c.nombre}</option>))}
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
                <div className="flex justify-between">
                  <span>TOTAL:</span>
                  <span className="text-[#003366] font-bold text-xl">${total.toFixed(2)}</span>
                </div>
              </div>
              <button
                onClick={finalizarVenta}
                disabled={loading || carrito.length === 0}
                className="mt-4 w-full bg-[#003366] text-white py-3 rounded-lg hover:bg-[#002244] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Printer size={18} />
                {loading ? 'Procesando...' : 'Finalizar Venta'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showTallaModal && productoTemporal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-[#003366] mb-2">Seleccionar Talla</h3>
            <p className="text-gray-600 mb-4">
              Producto: <strong>{productoTemporal.nombre}</strong>
            </p>
            <p className="text-sm text-gray-500 mb-4">
              ¿Qué talla va a vender?
            </p>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {tallasDisponibles.map((talla) => {
                const disponible = productoTemporal.stock_actual > 0

                return (
                  <button
                    key={talla}
                    onClick={() => {
                      agregarProductoAlCarrito(productoTemporal, talla)
                      setShowTallaModal(false)
                      setProductoTemporal(null)
                      setTallasDisponibles([])
                    }}
                    disabled={!disponible}
                    className={`py-3 rounded-lg border-2 transition ${
                      disponible
                        ? 'border-[#003366] text-[#003366] hover:bg-[#003366] hover:text-white'
                        : 'border-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <div className="text-lg font-bold">{talla}</div>
                    {disponible && (
                      <div className="text-xs text-green-600">Stock: {productoTemporal.stock_actual}</div>
                    )}
                    {!disponible && (
                      <div className="text-xs text-red-500">Sin stock</div>
                    )}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => {
                setShowTallaModal(false)
                setProductoTemporal(null)
                setTallasDisponibles([])
              }}
              className="w-full border border-gray-300 py-2 rounded-lg hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}