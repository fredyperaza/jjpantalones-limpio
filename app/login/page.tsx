'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [blockedMessage, setBlockedMessage] = useState('')
  const [clientIp, setClientIp] = useState('')
  const router = useRouter()

  // Obtener IP del cliente al cargar la página
  useEffect(() => {
    const getIp = async () => {
      try {
        const res = await fetch('https://api.ipify.org?format=json')
        const data = await res.json()
        setClientIp(data.ip)
      } catch (error) {
        console.error('Error obteniendo IP:', error)
        setClientIp('0.0.0.0')
      }
    }
    getIp()
  }, [])

  // Registrar intento de login
  const registrarIntento = async (email: string, ip: string, success: boolean) => {
    try {
      await supabase.from('login_attempts').insert({
        email: email,
        ip_address: ip,
        success: success
      })
    } catch (error) {
      console.error('Error registrando intento:', error)
    }
  }

  // Verificar rate limiting
  const verificarRateLimit = async (email: string, ip: string): Promise<{ allowed: boolean; message?: string }> => {
    try {
      const { data, error } = await supabase.rpc('verificar_rate_limiting', {
        p_email: email,
        p_ip: ip,
        max_intentos: 5,
        ventana_minutos: 15
      })
      
      if (error) {
        console.error('Error verificando rate limit:', error)
        return { allowed: true }
      }
      
      if (!data) {
        return { allowed: false, message: 'Demasiados intentos. Espere 15 minutos.' }
      }
      
      return { allowed: true }
    } catch (error) {
      console.error('Error:', error)
      return { allowed: true }
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (blocked) {
      toast.error(blockedMessage)
      return
    }
    
    if (!clientIp) {
      toast.error('Error de conexión. Recargue la página.')
      return
    }
    
    setLoading(true)

    try {
      // Verificar rate limiting
      const rateCheck = await verificarRateLimit(email, clientIp)
      if (!rateCheck.allowed) {
        setBlocked(true)
        setBlockedMessage(rateCheck.message || 'Demasiados intentos. Espere 15 minutos.')
        toast.error(rateCheck.message || 'Demasiados intentos. Espere 15 minutos.')
        setLoading(false)
        
        // Desbloquear después de 15 minutos
        setTimeout(() => {
          setBlocked(false)
          setBlockedMessage('')
        }, 15 * 60 * 1000)
        return
      }
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      // Registrar intento (éxito o fracaso)
      await registrarIntento(email, clientIp, !error)

      if (error) {
        toast.error('Credenciales incorrectas')
        setLoading(false)
      } else {
        toast.success('Bienvenido a JJPantalones')
        router.push('/dashboard')
      }
    } catch (err) {
      console.error('Error:', err)
      toast.error('Error al conectar con el servidor')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <div className="text-center mb-8">
          <div className="relative w-24 h-24 mx-auto mb-4">
            <Image
              src="/logo.png"
              alt="JJPantalones"
              fill
              className="rounded-full object-cover"
              priority
              sizes="(max-width: 768px) 96px, 96px"
            />
          </div>
          <h1 className="text-2xl font-bold text-[#003366]">JJPantalones</h1>
          <p className="text-gray-500 text-sm">Pantalones por Mayoreo</p>
          <p className="text-xs text-gray-400 mt-2">El Salvador 🇸🇻</p>
        </div>

        {blocked && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
            <p className="text-sm font-medium">{blockedMessage}</p>
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003366]"
              placeholder="admin@jjpantalones.com"
              required
              disabled={blocked}
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 mb-2">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003366]"
              placeholder="••••••••"
              required
              disabled={blocked}
            />
          </div>

          <button
            type="submit"
            disabled={loading || blocked}
            className="w-full bg-[#003366] text-white py-2 rounded-lg hover:bg-[#002244] transition disabled:opacity-50"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-gray-400">
          <p>🔒 Sistema seguro | Máximo 5 intentos cada 15 minutos</p>
        </div>
      </div>
    </div>
  )
}