'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Producto {
  id: string
  nombre: string
  talla: string
  color: string
  genero: string
  marca: string
  precio_costo: number
  precio_venta: number
  stock_actual: number
  stock_minimo: number
}

export default function TestPage() {
  const [resultado, setResultado] = useState<string>('Probando...')
  const [productos, setProductos] = useState<Producto[]>([])

  useEffect(() => {
    const test = async () => {
      try {
        setResultado('Conectando a Supabase...')
        
        const { data, error, status } = await supabase
          .from('productos')
          .select('*')
          .limit(5)

        if (error) {
          setResultado(`❌ Error: ${error.message}`)
          console.error('Error detallado:', error)
        } else {
          setResultado(`✅ Conexión OK! ${data?.length || 0} productos encontrados. Status: ${status}`)
          setProductos(data || [])
        }
      } catch (err) {
        const error = err as Error
        setResultado(`❌ Excepción: ${error.message}`)
      }
    }

    test()
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-xl font-bold mb-4">Test de Conexión a Supabase</h1>
      <p className="mb-4">{resultado}</p>
      
      {productos.length > 0 && (
        <div>
          <h2 className="font-bold mt-4">Productos encontrados:</h2>
          <div className="bg-gray-100 p-4 rounded mt-2 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Nombre</th>
                  <th className="text-left p-2">Talla</th>
                  <th className="text-left p-2">Color</th>
                  <th className="text-left p-2">Precio</th>
                  <th className="text-left p-2">Stock</th>
                </tr>
              </thead>
              <tbody>
                {productos.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="p-2">{p.nombre}</td>
                    <td className="p-2">{p.talla}</td>
                    <td className="p-2">{p.color}</td>
                    <td className="p-2">${p.precio_venta}</td>
                    <td className="p-2">{p.stock_actual}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}