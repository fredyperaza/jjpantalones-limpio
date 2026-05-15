import { supabase } from './supabase'

export async function verificarRol(rolesPermitidos: string[]) {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    return { permitido: false, redirectTo: '/login' }
  }

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', session.user.id)
    .single()

  if (!usuario || !rolesPermitidos.includes(usuario.rol)) {
    return { permitido: false, redirectTo: '/dashboard' }
  }

  return { permitido: true, usuario, redirectTo: null }
}