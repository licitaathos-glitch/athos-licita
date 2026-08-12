import { lerToken } from './session'
import { MENUS, PADRAO_POR_PERFIL } from './menus'

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

// ── PERMISSÃO DE MENUS (global e por empresa) ────────────────
// A coluna "menus" guarda o padrão do usuário.
// A coluna "menus_por_empresa" guarda um JSON {empresaId: "chave1,chave2"}
// com exceções — usada quando o analista tem níveis diferentes por empresa.

function listaDeMenus(valor) {
  if (Array.isArray(valor)) return valor.map(x => String(x).trim()).filter(Boolean)
  return String(valor || '').split(',').map(x => x.trim()).filter(Boolean)
}

export function mapaPorEmpresa(usuario) {
  const bruto = usuario?.menus_por_empresa
  if (!bruto) return {}
  if (typeof bruto === 'object') return bruto
  try {
    const o = JSON.parse(bruto)
    return (o && typeof o === 'object') ? o : {}
  } catch {
    return {}
  }
}

// Menus do usuário. Se empresaId for informado e houver exceção para ela,
// a exceção prevalece sobre o padrão do usuário.
export function menusPermitidos(usuario, empresaId) {
  const p = perfilDe(usuario)
  if (p === 'adm') return MENUS.map(m => m.key)

  const doPerfil = PADRAO_POR_PERFIL[p] || []
  const padrao = listaDeMenus(usuario?.menus)
  const base = padrao.length ? padrao : doPerfil

  let escolhidos = base
  if (empresaId) {
    const mapa = mapaPorEmpresa(usuario)
    const excecao = mapa[String(empresaId).trim()]
    if (excecao !== undefined && excecao !== null) escolhidos = listaDeMenus(excecao)
  }

  // Dashboard e Agenda são sempre acessíveis (a Agenda saiu de dentro do
  // Dashboard, então tirá-la de quem já a via seria uma perda silenciosa);
  // nada além disso escapa do que o perfil permite.
  return [...new Set(['dashboard', 'agenda', ...escolhidos.filter(k => doPerfil.includes(k))])]
}

// União de tudo que o usuário alcança em qualquer empresa — usado quando
// "Todas as empresas" está selecionado e na checagem de entrada das rotas.
export function menusUnificados(usuario) {
  const p = perfilDe(usuario)
  if (p === 'adm') return MENUS.map(m => m.key)

  const todos = new Set(menusPermitidos(usuario))
  const mapa = mapaPorEmpresa(usuario)
  Object.keys(mapa).forEach(id => menusPermitidos(usuario, id).forEach(k => todos.add(k)))
  return [...todos]
}

export function podeAcessarMenu(usuario, chave, empresaId) {
  return empresaId
    ? menusPermitidos(usuario, empresaId).includes(chave)
    : menusUnificados(usuario).includes(chave)
}

// Empresas que o usuário enxerga NAQUELE módulo — combina o acesso à empresa
// com a permissão de menu específica dela. É o que as APIs devem usar.
export function empresasComMenu(usuario, chave, todasEmpresas) {
  return empresasVisiveis(usuario, todasEmpresas)
    .filter(e => menusPermitidos(usuario, e.id).includes(chave))
}
