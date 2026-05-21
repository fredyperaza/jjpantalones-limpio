import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body
    
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Token no proporcionado' },
        { status: 400 }
      )
    }
    
    const secretKey = process.env.RECAPTCHA_SECRET_KEY
    
    if (!secretKey) {
      console.error('RECAPTCHA_SECRET_KEY no está configurada')
      return NextResponse.json(
        { success: false, message: 'Error de configuración del servidor' },
        { status: 500 }
      )
    }
    
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    })
    
    const data = await response.json()
    
    if (!data.success) {
      console.error('Error de reCAPTCHA:', data)
      return NextResponse.json(
        { success: false, message: 'Verificación fallida', errors: data['error-codes'] },
        { status: 400 }
      )
    }
    
    return NextResponse.json({ success: true, score: data.score })
  } catch (error) {
    console.error('Error en verify-recaptcha:', error)
    return NextResponse.json(
      { success: false, message: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}