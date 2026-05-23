import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Crear cliente de Supabase con la clave service_role (solo en servidor)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(request: NextRequest) {
  try {
    // Verificar que el usuario que hace la petición es admin
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }
    
    const token = authHeader.replace('Bearer ', '')
    
    // Verificar el token del usuario actual
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      )
    }
    
    // Verificar que el usuario tiene rol admin
    const { data: usuarioDB } = await supabaseAdmin
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()
    
    if (usuarioDB?.rol !== 'admin') {
      return NextResponse.json(
        { error: 'No tienes permisos de administrador' },
        { status: 403 }
      )
    }
    
    // Obtener datos del nuevo usuario
    const body = await request.json()
    const { email, password, nombre_usuario, nombre_completo, rol } = body
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son requeridos' },
        { status: 400 }
      )
    }
    
    // Crear usuario en Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nombre_completo: nombre_completo || '',
        rol: rol || 'vendedor'
      }
    })
    
    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }
    
    // Insertar en la tabla usuarios
    const { error: insertError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        id: authUser.user.id,
        nombre_usuario: nombre_usuario || email.split('@')[0],
        email: email,
        nombre_completo: nombre_completo || '',
        rol: rol || 'vendedor',
        activo: true
      })
    
    if (insertError) {
      // Si falla la inserción, eliminar el usuario de Auth
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      return NextResponse.json(
        { error: insertError.message },
        { status: 400 }
      )
    }
    
    return NextResponse.json({
      success: true,
      user: {
        id: authUser.user.id,
        email: authUser.user.email,
        nombre_usuario: nombre_usuario || email.split('@')[0],
        nombre_completo: nombre_completo || '',
        rol: rol || 'vendedor'
      }
    })
    
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}