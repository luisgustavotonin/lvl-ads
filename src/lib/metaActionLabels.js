// Dicionário de action_types da Meta → nomes amigáveis em PT-BR.
// Cada entrada: { label, category, kind }
//   kind: 'int' (contagem) ou 'currency' (valor monetário, de action_values)
// Categorias: Investimento, Volume, Engajamento, Vídeo, Comércio, Conversão, Contato, Outros

export const META_ACTION_LABELS = {
  // Cliques / Engajamento básico
  link_click: { label: 'Cliques no Link', category: 'Engajamento', kind: 'int' },
  outbound_click: { label: 'Cliques de Saída', category: 'Engajamento', kind: 'int' },
  button_click: { label: 'Cliques no Botão', category: 'Engajamento', kind: 'int' },
  page_engagement: { label: 'Engajamento da Página', category: 'Engajamento', kind: 'int' },
  post_engagement: { label: 'Engajamento da Publicação', category: 'Engajamento', kind: 'int' },
  post_reaction: { label: 'Reações', category: 'Engajamento', kind: 'int' },
  post: { label: 'Publicações', category: 'Engajamento', kind: 'int' },
  like: { label: 'Curtidas', category: 'Engajamento', kind: 'int' },
  comment: { label: 'Comentários', category: 'Engajamento', kind: 'int' },
  shares: { label: 'Compartilhamentos', category: 'Engajamento', kind: 'int' },
  photo_view: { label: 'Visualizações de Foto', category: 'Engajamento', kind: 'int' },
  follow: { label: 'Novos Seguidores', category: 'Engajamento', kind: 'int' },
  page_likes: { label: 'Curtidas na Página', category: 'Engajamento', kind: 'int' },
  event_responses: { label: 'Respostas a Eventos', category: 'Engajamento', kind: 'int' },
  checkin: { label: 'Check-ins', category: 'Engajamento', kind: 'int' },

  // Vídeo
  video_view: { label: 'Visualizações de Vídeo', category: 'Vídeo', kind: 'int' },
  video_play: { label: 'Reproduções de Vídeo', category: 'Vídeo', kind: 'int' },
  video_play_p75: { label: 'Reproduções 75%', category: 'Vídeo', kind: 'int' },
  video_play_p50: { label: 'Reproduções 50%', category: 'Vídeo', kind: 'int' },
  video_play_p25: { label: 'Reproduções 25%', category: 'Vídeo', kind: 'int' },
  video_play_p95: { label: 'Reproduções 95%', category: 'Vídeo', kind: 'int' },
  video_play_p100: { label: 'Reproduções Completas', category: 'Vídeo', kind: 'int' },
  video_10s_watched: { label: 'Visualizações 10s', category: 'Vídeo', kind: 'int' },
  video_15s_watched: { label: 'Visualizações 15s', category: 'Vídeo', kind: 'int' },
  video_30s_watched: { label: 'Visualizações 30s', category: 'Vídeo', kind: 'int' },
  video_avg_time_watched: { label: 'Tempo Médio de Visualização', category: 'Vídeo', kind: 'int' },
  video_view_3s: { label: 'Visualizações 3s', category: 'Vídeo', kind: 'int' },
  video_thruplay_watched: { label: 'ThruPlays', category: 'Vídeo', kind: 'int' },

  // Mensagens / WhatsApp
  'onsite_conversion.messaging_conversation_started_7d': { label: 'Conversas Iniciadas (7d)', category: 'Conversão', kind: 'int' },
  'onsite_conversion.messaging_conversation_started': { label: 'Conversas Iniciadas', category: 'Conversão', kind: 'int' },
  'onsite_conversion.total_messaging_connection': { label: 'Conexões de Mensagem', category: 'Conversão', kind: 'int' },
  'onsite_conversion.messaging_first_reply': { label: 'Primeira Resposta', category: 'Conversão', kind: 'int' },
  'onsite_conversion.messaging_referral_reply': { label: 'Respostas por Referência', category: 'Conversão', kind: 'int' },
  whatsapp_opened: { label: 'WhatsApp Aberto', category: 'Conversão', kind: 'int' },
  'onsite_conversion.booking': { label: 'Reservas', category: 'Conversão', kind: 'int' },
  'onsite_conversion.appointment_update': { label: 'Agendamentos', category: 'Conversão', kind: 'int' },

  // Leads / Formulários
  lead: { label: 'Leads', category: 'Conversão', kind: 'int' },
  leadgen_other: { label: 'Leads (Outros)', category: 'Conversão', kind: 'int' },
  'onsite_conversion.lead_group': { label: 'Leads (Grupo)', category: 'Conversão', kind: 'int' },
  'offsite_conversion.lead': { label: 'Leads (Pixel)', category: 'Conversão', kind: 'int' },
  'offsite_conversion.fb_pixel_lead': { label: 'Leads (Pixel)', category: 'Conversão', kind: 'int' },
  complete_registration: { label: 'Cadastros Concluídos', category: 'Conversão', kind: 'int' },
  'onsite_conversion.lead_gen_form_view': { label: 'Visualizações de Formulário', category: 'Conversão', kind: 'int' },

  // Comércio / Pixel
  'offsite_conversion.fb_pixel_purchase': { label: 'Compras (Pixel)', category: 'Comércio', kind: 'int' },
  'offsite_conversion.purchase': { label: 'Compras', category: 'Comércio', kind: 'int' },
  purchase: { label: 'Compras', category: 'Comércio', kind: 'int' },
  add_to_cart: { label: 'Adicionar ao Carrinho', category: 'Comércio', kind: 'int' },
  'offsite_conversion.fb_pixel_add_to_cart': { label: 'Adicionar ao Carrinho (Pixel)', category: 'Comércio', kind: 'int' },
  add_to_wishlist: { label: 'Lista de Desejos', category: 'Comércio', kind: 'int' },
  initiate_checkout: { label: 'Iniciar Checkout', category: 'Comércio', kind: 'int' },
  view_content: { label: 'Visualizações de Conteúdo', category: 'Comércio', kind: 'int' },
  'offsite_conversion.fb_pixel_view_content': { label: 'Visualizações de Conteúdo (Pixel)', category: 'Comércio', kind: 'int' },
  search: { label: 'Buscas', category: 'Comércio', kind: 'int' },
  'offsite_conversion.fb_pixel_search': { label: 'Buscas (Pixel)', category: 'Comércio', kind: 'int' },
  contact: { label: 'Contatos', category: 'Contato', kind: 'int' },
  get_directions: { label: 'Como Chegar', category: 'Contato', kind: 'int' },
  find_location: { label: 'Buscar Localização', category: 'Contato', kind: 'int' },
  call_now: { label: 'Ligar Agora', category: 'Contato', kind: 'int' },
  message: { label: 'Mensagens', category: 'Contato', kind: 'int' },
  start_trial: { label: 'Iniciar Teste', category: 'Conversão', kind: 'int' },
  subscribe: { label: 'Inscrições', category: 'Conversão', kind: 'int' },
  download: { label: 'Downloads', category: 'Conversão', kind: 'int' },
  landing_page_view: { label: 'Visualizações da Página de Destino', category: 'Conversão', kind: 'int' },
};

// Mapa de action_types cujo valor é monetário (action_values) e merece rótulo amigável
export const META_ACTION_VALUE_LABELS = {
  'offsite_conversion.fb_pixel_purchase': { label: 'Valor de Compras', category: 'Comércio' },
  'offsite_conversion.purchase': { label: 'Valor de Compras', category: 'Comércio' },
  purchase: { label: 'Valor de Compras', category: 'Comércio' },
  'offsite_conversion.fb_pixel_add_to_cart': { label: 'Valor no Carrinho', category: 'Comércio' },
  add_to_cart: { label: 'Valor no Carrinho', category: 'Comércio' },
  'offsite_conversion.fb_pixel_view_content': { label: 'Valor de Conteúdo Visto', category: 'Comércio' },
  'offsite_conversion.fb_pixel_lead': { label: 'Valor de Leads', category: 'Conversão' },
  'offsite_conversion.lead': { label: 'Valor de Leads', category: 'Conversão' },
};

const fmtInt = (v) => new Intl.NumberFormat('pt-BR').format(Math.round(Number(v || 0)));
const fmtCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));

// Extrai o mapa {action_type: valor} de um registro (nova ingestion ou fallback do raw)
export function getActionsMap(record) {
  if (!record) return {};
  if (record.actions_map && typeof record.actions_map === 'object') return record.actions_map;
  const raw = record.raw;
  if (!raw) return {};
  const arr = Array.isArray(raw.actions) ? raw.actions : Array.isArray(raw.action_values) ? raw.action_values : null;
  if (!arr) return {};
  const out = {};
  for (const a of arr) {
    if (a && a.action_type) out[a.action_type] = parseFloat(a.value) || 0;
  }
  return out;
}

export function getActionValuesMap(record) {
  if (!record) return {};
  if (record.action_values_map && typeof record.action_values_map === 'object') return record.action_values_map;
  const raw = record.raw;
  if (!raw) return {};
  const arr = Array.isArray(raw.action_values) ? raw.action_values : null;
  if (!arr) return {};
  const out = {};
  for (const a of arr) {
    if (a && a.action_type) out[a.action_type] = parseFloat(a.value) || 0;
  }
  return out;
}

// Gera um nome amigável para action_type desconhecido
function fallbackLabel(actionType) {
  if (!actionType) return 'Métrica';
  const parts = String(actionType).split('.');
  const last = parts[parts.length - 1];
  return last
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/7D/gi, '7d')
    .replace(/Fb Pixel/gi, 'Pixel');
}

// Constrói o catálogo dinâmico de KPIs a partir dos registros retornados pela API.
// Retorna entradas no mesmo formato dos KPIs fixos (id, label, category, format, kind, actionType).
export function buildDynamicKpiCatalog(records) {
  const counts = {}; // action_type -> total (só pra descobrir quais existem)
  const values = {};
  for (const r of records || []) {
    const am = getActionsMap(r);
    for (const k of Object.keys(am)) {
      if (am[k]) counts[k] = (counts[k] || 0) + am[k];
    }
    const vm = getActionValuesMap(r);
    for (const k of Object.keys(vm)) {
      if (vm[k]) values[k] = (values[k] || 0) + vm[k];
    }
  }

  const out = [];

  // Counts
  const countKeys = Object.keys(counts).sort((a, b) => (counts[b] - counts[a]));
  for (const k of countKeys) {
    const meta = META_ACTION_LABELS[k];
    const id = `action:${k}`;
    out.push({
      id,
      actionType: k,
      source: 'action',
      label: meta ? meta.label : fallbackLabel(k),
      category: meta ? meta.category : 'Outros',
      format: fmtInt,
    });
  }

  // Values (monetários)
  const valueKeys = Object.keys(values).sort((a, b) => (values[b] - values[a]));
  for (const k of valueKeys) {
    const meta = META_ACTION_VALUE_LABELS[k];
    const id = `value:${k}`;
    const base = META_ACTION_LABELS[k];
    out.push({
      id,
      actionType: k,
      source: 'value',
      label: meta ? meta.label : `Valor · ${base ? base.label : fallbackLabel(k)}`,
      category: meta ? meta.category : 'Comércio',
      format: fmtCurrency,
    });
  }

  return out;
}

// Soma um KPI dinâmico sobre um conjunto de registros
export function sumDynamicKpi(records, kpi) {
  if (!kpi || !kpi.actionType || !records) return 0;
  let total = 0;
  for (const r of records) {
    const map = kpi.source === 'value' ? getActionValuesMap(r) : getActionsMap(r);
    total += map[kpi.actionType] || 0;
  }
  return total;
}