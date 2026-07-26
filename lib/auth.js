import { lerToken } from './session'

// Lê o usuário autenticado a partir do cookie de sessão da requisição
export async function getUsuarioFromReq(req) {
  const token = req.cookies.get('athos_sessao')?.value
  return token ? await lerToken(token) : null
}

function perfilDe(usuario) {
  const p = String(usuario?.perfil || '').trim().toLowerCase()
  // Normaliza variações que podem existir na planilha
  if (['adm', 'admin', 'administrador', 'administradora', 'administrator'].includes(p)) return 'adm'
  if (['analista', 'analyst', 'consultor', 'consultora'].includes(p)) return 'analista'
  if (['empresa', 'cliente', 'company'].includes(p)) return 'empresa'
  return p
}

// Exposto para o frontend usar o mesmo critério de normalização
export function normalizarPerfil(usuario) {
  return perfilDe(usuario)
}

export function ehAdmin(usuario) {
  return perfilDe(usuario) === 'adm'
}

// Adm e Analista podem editar dados; perfil Empresa é somente consulta
export function podeEditar(usuario) {
  const p = perfilDe(usuario)
  return p === 'adm' || p === 'analista'
}

// Filtra a lista de empresas conforme o perfil do usuário
// - adm: vê todas
// - empresa: vê apenas a própria empresa (empresa_id)
// - analista: vê as empresas em empresas_permitidas (vazio = todas)
export function empresasVisiveis(usuario, todasEmpresas) {
  const p = perfilDe(usuario)
  if (p === 'adm') return todasEmpresas

  if (p === 'empresa') {
    return todasEmpresas.filter(e => String(e.id).trim() === String(usuario.empresa_id || '').trim())
  }

  if (p === 'analista') {
    const permitidas = String(usuario.empresas_permitidas || '')
      .split(',').map(s => s.trim()).filter(Boolean)
    if (!permitidas.length) return todasEmpresas
    return todasEmpresas.filter(e => permitidas.includes(String(e.id).trim()))
  }

  return []
}
