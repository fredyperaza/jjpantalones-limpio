'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      toast.error('Credenciales incorrectas')
      setLoading(false)
    } else {
      toast.success('Bienvenido a JJPantalones')
      router.push('/dashboard')
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

          <div className="mb-6">
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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#003366] text-white py-2 rounded-lg hover:bg-[#002244] transition disabled:opacity-50"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}