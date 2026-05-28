'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import toast from 'react-hot-toast'
import ReCAPTCHA from 'react-google-recaptcha'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [clientIp, setClientIp] = useState('')
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const recaptchaRef = useRef<ReCAPTCHA>(null)
  const router = useRouter()

  const isProduction = process.env.NODE_ENV === 'production'

  useEffect(() => {
    const getIp = async () => {
      try {
        const res = await fetch('https://api.ipify.org?format=json')
        const data = await res.json()
        setClientIp(data.ip)
      } catch (error) {
        setClientIp('0.0.0.0')
      }
    }
    getIp()
  }, [])

  const registrarIntento = async (email: string, ip: string, success: boolean) => {
    try {
      await supabase.from('login_attempts').insert({
        email: email,
        ip_address: ip,
        success: success
      })
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const verificarRateLimit = async (email: string, ip: string) => {
    try {
      const { data, error } = await supabase.rpc('verificar_rate_limiting', {
        p_email: email,
        p_ip: ip,
        max_intentos: 5,
        ventana_minutos: 15
      })
      if (error || !data) {
        return { allowed: false, message: 'Demasiados intentos. Espere 15 minutos.' }
      }
      return { allowed: true }
    } catch {
      return { allowed: true }
    }
  }

  const verificarCaptcha = async (token: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/verify-recaptcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })
      const data = await response.json()
      return data.success
    } catch {
      return false
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (isProduction && !captchaToken) {
      toast.error('Por favor, complete el captcha')
      return
    }
    
    if (!clientIp) {
      toast.error('Error de conexión. Recargue la página.')
      return
    }
    
    setLoading(true)

    try {
      if (isProduction) {
        const captchaValid = await verificarCaptcha(captchaToken!)
        if (!captchaValid) {
          toast.error('Verificación de captcha fallida')
          recaptchaRef.current?.reset()
          setCaptchaToken(null)
          setLoading(false)
          return
        }
      }
      
      const rateCheck = await verificarRateLimit(email, clientIp)
      if (!rateCheck.allowed) {
        toast.error(rateCheck.message || 'Demasiados intentos. Espere 15 minutos.')
        setLoading(false)
        recaptchaRef.current?.reset()
        setCaptchaToken(null)
        return
      }
      
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      await registrarIntento(email, clientIp, !error)

      if (error) {
        toast.error('Credenciales incorrectas')
        setLoading(false)
        recaptchaRef.current?.reset()
        setCaptchaToken(null)
      } else {
        toast.success('Bienvenido a JJPantalones')
        router.push('/dashboard')
      }
    } catch {
      toast.error('Error al conectar con el servidor')
      setLoading(false)
      recaptchaRef.current?.reset()
      setCaptchaToken(null)
    }
  }

  const onChangeCaptcha = (token: string | null) => {
    setCaptchaToken(token)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <div className="text-center mb-8">
          <div className="relative w-24 h-24 mx-auto mb-4">
            <Image src="/logo.png" alt="JJPantalones" fill className="rounded-full object-cover" priority />
          </div>
          <h1 className="text-2xl font-bold text-[#003366]">JJPantalones</h1>
          <p className="text-gray-500 text-sm">Pantalones por Mayoreo</p>
          <p className="text-xs text-gray-400 mt-2">El Salvador 🇸🇻</p>
        </div>

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
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003366]"
              placeholder="••••••••"
              required
            />
          </div>

          {isProduction && (
            <div className="mb-4 flex justify-center">
              <ReCAPTCHA
                ref={recaptchaRef}
                sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!}
                onChange={onChangeCaptcha}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#003366] text-white py-2 rounded-lg hover:bg-[#002244] transition disabled:opacity-50"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-gray-400">
          <p>🔒 Máximo 5 intentos cada 15 minutos</p>
        </div>
      </div>
    </div>
  )
}