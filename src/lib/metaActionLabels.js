// Dicionário de action_types da Meta → nomes amigáveis em PT-BR.
// Nomenclatura IDÊNTICA ao "Personalizar colunas" do Gerenciador de Anúncios da Meta.
// Cada entrada: { label, category, kind }
//   kind: 'int' (contagem) ou 'currency' (valor monetário, de action_values)
// Categorias seguem o agrupamento do Meta Ads Manager.

export const META_ACTION_LABELS = {
  // Engajamento → Cliques
  link_click: { label: 'Cliques no link', category: 'Engajamento', kind: 'int' },
  link_click_unique: { label: 'Cliques no link únicos', category: 'Engajamento', kind: 'int' },
  outbound_click: { label: 'Cliques de saída', category: 'Engajamento', kind: 'int' },
  outbound_click_unique: { label: 'Cliques de saída únicos', category: 'Engajamento', kind: 'int' },
  button_click: { label: 'Cliques no botão', category: 'Engajamento', kind: 'int' },
  photo_view: { label: 'Cliques na foto', category: 'Engajamento', kind: 'int' },
  click_onsite: { label: 'Cliques na loja', category: 'Engajamento', kind: 'int' },
  clicks: { label: 'Cliques (todos)', category: 'Engajamento', kind: 'int' },
  unique_clicks: { label: 'Cliques únicos (todos)', category: 'Engajamento', kind: 'int' },

  // Engajamento
  page_engagement: { label: 'Engajamento com a Página', category: 'Engajamento', kind: 'int' },
  post_engagement: { label: 'Engajamentos com o post', category: 'Engajamento', kind: 'int' },
  post_reaction: { label: 'Reações ao post', category: 'Engajamento', kind: 'int' },
  post: { label: 'Publicações', category: 'Engajamento', kind: 'int' },
  like: { label: 'Curtidas', category: 'Engajamento', kind: 'int' },
  comment: { label: 'Comentários no post', category: 'Engajamento', kind: 'int' },
  shares: { label: 'Compartilhamentos do post', category: 'Engajamento', kind: 'int' },
  checkin: { label: 'Check-ins', category: 'Engajamento', kind: 'int' },
  post_save: { label: 'Salvamentos do post', category: 'Engajamento', kind: 'int' },
  'onsite_conversion.post_save': { label: 'Salvamentos do post', category: 'Engajamento', kind: 'int' },
  'onsite_conversion.post_net_save': { label: 'Saves líquidos', category: 'Engajamento', kind: 'int' },
  'onsite_conversion.post_unsave': { label: 'Remoções de save', category: 'Engajamento', kind: 'int' },
  'onsite_conversion.post_net_like': { label: 'Curtidas líquidas', category: 'Engajamento', kind: 'int' },
  'onsite_conversion.post_unlike': { label: 'Descurtidas', category: 'Engajamento', kind: 'int' },
  'onsite_conversion.post_net_comment': { label: 'Comentários líquidos', category: 'Engajamento', kind: 'int' },
  post_interaction_gross: { label: 'Interações', category: 'Engajamento', kind: 'int' },
  post_interaction_net: { label: 'Interações líquidas', category: 'Engajamento', kind: 'int' },
  event_reminder_set: { label: 'Lembretes de rede ativados', category: 'Engajamento', kind: 'int' },
  'onsite_conversion.event_reminder_set': { label: 'Lembretes de rede ativados', category: 'Engajamento', kind: 'int' },
  event_responses: { label: 'Participações no evento', category: 'Engajamento', kind: 'int' },
  'onsite_conversion.rsvp': { label: 'Participações no evento', category: 'Engajamento', kind: 'int' },

  // Seguidores e curtidas
  follow: { label: 'Seguidores no Instagram', category: 'Seguidores e curtidas', kind: 'int' },
  'onsite_conversion.follow': { label: 'Seguidores no Instagram', category: 'Seguidores e curtidas', kind: 'int' },
  page_likes: { label: 'Curtidas na Página', category: 'Seguidores e curtidas', kind: 'int' },
  'onsite_conversion.page_like': { label: 'Curtidas na Página', category: 'Seguidores e curtidas', kind: 'int' },
  'onsite_conversion.page_unlike': { label: 'Descurtidas da Página', category: 'Seguidores e curtidas', kind: 'int' },
  'onsite_conversion.page_net_likes': { label: 'Curtidas líquidas na Página', category: 'Seguidores e curtidas', kind: 'int' },

  // Vídeo
  video_view: { label: 'Visualizações de vídeo', category: 'Vídeo', kind: 'int' },
  video_play: { label: 'Reproduções de vídeo', category: 'Vídeo', kind: 'int' },
  video_play_p25: { label: 'Reproduções a 25%', category: 'Vídeo', kind: 'int' },
  video_play_p50: { label: 'Reproduções a 50%', category: 'Vídeo', kind: 'int' },
  video_play_p75: { label: 'Reproduções a 75%', category: 'Vídeo', kind: 'int' },
  video_play_p95: { label: 'Reproduções a 95%', category: 'Vídeo', kind: 'int' },
  video_play_p100: { label: 'Reproduções completas', category: 'Vídeo', kind: 'int' },
  video_10s_watched: { label: 'Visualizações de 10s', category: 'Vídeo', kind: 'int' },
  video_15s_watched: { label: 'Visualizações de 15s', category: 'Vídeo', kind: 'int' },
  video_30s_watched: { label: 'Visualizações de 30s', category: 'Vídeo', kind: 'int' },
  video_avg_time_watched: { label: 'Tempo médio de visualização', category: 'Vídeo', kind: 'int' },
  video_view_3s: { label: 'Visualizações de 3s', category: 'Vídeo', kind: 'int' },
  video_thruplay_watched: { label: 'ThruPlays', category: 'Vídeo', kind: 'int' },
  view_opens: { label: 'Visualizações', category: 'Vídeo', kind: 'int' },
  'onsite_conversion.video_view_opens': { label: 'Visualizações', category: 'Vídeo', kind: 'int' },
  unique_video_views: { label: 'Visualizadores', category: 'Vídeo', kind: 'int' },
  'onsite_conversion.unique_video_views': { label: 'Visualizadores', category: 'Vídeo', kind: 'int' },

  // Mensagens
  'onsite_conversion.messaging_conversation_started_7d': { label: 'Conversas por mensagem iniciadas', category: 'Mensagens', kind: 'int' },
  'onsite_conversion.messaging_conversation_started': { label: 'Conversas por mensagem iniciadas', category: 'Mensagens', kind: 'int' },
  'onsite_conversion.total_messaging_connection': { label: 'Contatos por mensagem que retornam', category: 'Mensagens', kind: 'int' },
  'onsite_conversion.messaging_first_reply': { label: 'Conversas por mensagem respondidas', category: 'Mensagens', kind: 'int' },
  'onsite_conversion.messaging_conversation_replied_7d': { label: 'Conversas por mensagem respondidas', category: 'Mensagens', kind: 'int' },
  'onsite_conversion.messaging_referral_reply': { label: 'Respostas por referência', category: 'Mensagens', kind: 'int' },
  'onsite_conversion.messaging_block': { label: 'Bloqueios de mensagem', category: 'Mensagens', kind: 'int' },
  'onsite_conversion.messaging_user_depth_2_message_send': { label: 'Mensagens (profundidade 2)', category: 'Mensagens', kind: 'int' },
  'onsite_conversion.messaging_user_depth_3_message_send': { label: 'Mensagens (profundidade 3)', category: 'Mensagens', kind: 'int' },
  'onsite_conversion.messaging_user_depth_5_message_send': { label: 'Mensagens (profundidade 5)', category: 'Mensagens', kind: 'int' },
  'onsite_conversion.welcome_message_opened': { label: 'Visualizações da mensagem de boas-vindas', category: 'Mensagens', kind: 'int' },
  whatsapp_opened: { label: 'WhatsApp aberto', category: 'Mensagens', kind: 'int' },
  'onsite_conversion.booking': { label: 'Reservas', category: 'Mensagens', kind: 'int' },
  'onsite_conversion.appointment_update': { label: 'Agendamentos', category: 'Mensagens', kind: 'int' },

  // Conversões → Eventos padrão
  purchase: { label: 'Compras', category: 'Conversões', kind: 'int' },
  'offsite_conversion.purchase': { label: 'Compras', category: 'Conversões', kind: 'int' },
  'offsite_conversion.fb_pixel_purchase': { label: 'Compras', category: 'Conversões', kind: 'int' },
  lead: { label: 'Leads', category: 'Conversões', kind: 'int' },
  leadgen_other: { label: 'Leads', category: 'Conversões', kind: 'int' },
  'offsite_conversion.lead': { label: 'Leads', category: 'Conversões', kind: 'int' },
  'offsite_conversion.fb_pixel_lead': { label: 'Leads', category: 'Conversões', kind: 'int' },
  'onsite_conversion.lead_group': { label: 'Leads', category: 'Conversões', kind: 'int' },
  'onsite_conversion.lead_grouped': { label: 'Leads', category: 'Conversões', kind: 'int' },
  complete_registration: { label: 'Cadastros concluídos', category: 'Conversões', kind: 'int' },
  'onsite_conversion.lead_gen_form_view': { label: 'Visualizações de formulário', category: 'Conversões', kind: 'int' },
  landing_page_view: { label: 'Visualizações da página de destino', category: 'Conversões', kind: 'int' },
  'omni_landing_page_view': { label: 'Visualizações da página de destino', category: 'Conversões', kind: 'int' },
  start_trial: { label: 'Inícios de teste', category: 'Conversões', kind: 'int' },
  subscribe: { label: 'Inscrições', category: 'Conversões', kind: 'int' },
  download: { label: 'Downloads', category: 'Conversões', kind: 'int' },

  // Comércio / Pixel
  add_to_cart: { label: 'Adições ao carrinho', category: 'Comércio', kind: 'int' },
  'offsite_conversion.fb_pixel_add_to_cart': { label: 'Adições ao carrinho', category: 'Comércio', kind: 'int' },
  add_to_wishlist: { label: 'Adições à lista de desejos', category: 'Comércio', kind: 'int' },
  initiate_checkout: { label: 'Inícios de checkout', category: 'Comércio', kind: 'int' },
  'offsite_conversion.initiate_checkout': { label: 'Inícios de checkout', category: 'Comércio', kind: 'int' },
  view_content: { label: 'Visualizações de conteúdo', category: 'Comércio', kind: 'int' },
  'offsite_conversion.fb_pixel_view_content': { label: 'Visualizações de conteúdo', category: 'Comércio', kind: 'int' },
  'offsite_conversion.view_content': { label: 'Visualizações de conteúdo', category: 'Comércio', kind: 'int' },
  search: { label: 'Buscas', category: 'Comércio', kind: 'int' },
  'offsite_conversion.fb_pixel_search': { label: 'Buscas', category: 'Comércio', kind: 'int' },

  // Contato
  contact: { label: 'Contatos', category: 'Contato', kind: 'int' },
  get_directions: { label: 'Como chegar', category: 'Contato', kind: 'int' },
  find_location: { label: 'Buscas de localização', category: 'Contato', kind: 'int' },
  call_now: { label: 'Chamadas', category: 'Contato', kind: 'int' },
  'onsite_conversion.call_now': { label: 'Chamadas', category: 'Contato', kind: 'int' },
  message: { label: 'Mensagens', category: 'Contato', kind: 'int' },
  'onsite_conversion.message_send': { label: 'Mensagens', category: 'Contato', kind: 'int' },

  // Visitas ao perfil / Instagram
  'onsite_conversion.profile_visits': { label: 'Visitas ao perfil', category: 'Contato', kind: 'int' },
  'onsite_conversion.instagram_profile_visits': { label: 'Visitas ao perfil do Instagram', category: 'Contato', kind: 'int' },
  'onsite_conversion.profile_visit': { label: 'Visitas ao perfil', category: 'Contato', kind: 'int' },
  'instagram_profile_visits': { label: 'Visitas ao perfil do Instagram', category: 'Contato', kind: 'int' },
  profile_visits: { label: 'Visitas ao perfil', category: 'Contato', kind: 'int' },

  // Leads Meta (formulários/CRM)
  'offsite_complete_registration_add_meta_leads': { label: 'Cadastros (Leads Meta)', category: 'Conversões', kind: 'int' },
  'offsite_search_add_meta_leads': { label: 'Buscas (Leads Meta)', category: 'Comércio', kind: 'int' },
  'offsite_content_view_add_meta_leads': { label: 'Visitas (Leads Meta)', category: 'Comércio', kind: 'int' },
};

// Rótulos exatos para a coluna de VALOR (action_values) — "Valor de ..." no Meta
export const META_ACTION_VALUE_LABELS = {
  'offsite_conversion.fb_pixel_purchase': { label: 'Valor de compras', category: 'Conversões' },
  'offsite_conversion.purchase': { label: 'Valor de compras', category: 'Conversões' },
  purchase: { label: 'Valor de compras', category: 'Conversões' },
  'offsite_conversion.fb_pixel_add_to_cart': { label: 'Valor de adições ao carrinho', category: 'Comércio' },
  add_to_cart: { label: 'Valor de adições ao carrinho', category: 'Comércio' },
  'offsite_conversion.fb_pixel_view_content': { label: 'Valor de visualizações de conteúdo', category: 'Comércio' },
  view_content: { label: 'Valor de visualizações de conteúdo', category: 'Comércio' },
  'offsite_conversion.fb_pixel_lead': { label: 'Valor de leads', category: 'Conversões' },
  'offsite_conversion.lead': { label: 'Valor de leads', category: 'Conversões' },
  lead: { label: 'Valor de leads', category: 'Conversões' },
};

// Rótulos exatos para "Custo por ..." (derivado: spend / count) — espelha o Meta
export const META_COST_LABELS = {
  'onsite_conversion.messaging_conversation_started': { label: 'Custo por conversa por mensagem iniciada', category: 'Mensagens' },
  'onsite_conversion.messaging_conversation_started_7d': { label: 'Custo por conversa por mensagem iniciada', category: 'Mensagens' },
  'onsite_conversion.messaging_first_reply': { label: 'Custo por conversa por mensagem respondida', category: 'Mensagens' },
  'onsite_conversion.messaging_conversation_replied_7d': { label: 'Custo por conversa por mensagem respondida', category: 'Mensagens' },
  page_engagement: { label: 'Custo por engajamento com a Página', category: 'Engajamento' },
  post_engagement: { label: 'Custo por engajamento com o post', category: 'Engajamento' },
  post_interaction_gross: { label: 'Custo por interação', category: 'Engajamento' },
  event_responses: { label: 'Custo por participação no evento', category: 'Engajamento' },
  'onsite_conversion.rsvp': { label: 'Custo por participação no evento', category: 'Engajamento' },
  link_click: { label: 'CPC (custo por clique no link)', category: 'Engajamento' },
  link_click_unique: { label: 'Custo por clique único (todos)', category: 'Engajamento' },
  purchase: { label: 'Custo por compra', category: 'Conversões' },
  'offsite_conversion.purchase': { label: 'Custo por compra', category: 'Conversões' },
  'offsite_conversion.fb_pixel_purchase': { label: 'Custo por compra', category: 'Conversões' },
  lead: { label: 'Custo por lead', category: 'Conversões' },
  'offsite_conversion.lead': { label: 'Custo por lead', category: 'Conversões' },
  'offsite_conversion.fb_pixel_lead': { label: 'Custo por lead', category: 'Conversões' },
  add_to_cart: { label: 'Custo por adição ao carrinho', category: 'Comércio' },
  'offsite_conversion.fb_pixel_add_to_cart': { label: 'Custo por adição ao carrinho', category: 'Comércio' },
  view_content: { label: 'Custo por visualização de conteúdo', category: 'Comércio' },
  landing_page_view: { label: 'Custo por visualização da página de destino', category: 'Conversões' },
  complete_registration: { label: 'Custo por cadastro concluído', category: 'Conversões' },
  contact: { label: 'Custo por contato', category: 'Contato' },
  follow: { label: 'Custo por seguidor', category: 'Seguidores e curtidas' },
  'onsite_conversion.follow': { label: 'Custo por seguidor', category: 'Seguidores e curtidas' },
  'onsite_conversion.instagram_profile_visits': { label: 'Custo por visita ao perfil do Instagram', category: 'Contato' },
  'onsite_conversion.profile_visits': { label: 'Custo por visita ao perfil', category: 'Contato' },
  'onsite_conversion.profile_visit': { label: 'Custo por visita ao perfil', category: 'Contato' },
  profile_visits: { label: 'Custo por visita ao perfil', category: 'Contato' },
  post_reaction: { label: 'Custo por reação', category: 'Engajamento' },
  comment: { label: 'Custo por comentário', category: 'Engajamento' },
  shares: { label: 'Custo por compartilhamento', category: 'Engajamento' },
  post_save: { label: 'Custo por salvamento', category: 'Engajamento' },
  'onsite_conversion.post_save': { label: 'Custo por salvamento', category: 'Engajamento' },
  video_view: { label: 'Custo por visualização de vídeo', category: 'Vídeo' },
  video_play: { label: 'Custo por reprodução', category: 'Vídeo' },
  'onsite_conversion.total_messaging_connection': { label: 'Custo por contato por mensagem', category: 'Mensagens' },
  get_directions: { label: 'Custo por como chegar', category: 'Contato' },
  call_now: { label: 'Custo por chamada', category: 'Contato' },
  message: { label: 'Custo por mensagem', category: 'Contato' },
  initiate_checkout: { label: 'Custo por início de checkout', category: 'Comércio' },
  add_to_wishlist: { label: 'Custo por adição à lista de desejos', category: 'Comércio' },
  search: { label: 'Custo por busca', category: 'Comércio' },
};

const fmtInt = (v) => new Intl.NumberFormat('pt-BR').format(Math.round(Number(v || 0)));
const fmtCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const fmtPct = (v) => `${Number(v || 0).toFixed(2)}%`;
const fmtRoas = (v) => `${Number(v || 0).toFixed(2)}`;

// Catálogo PADRÃO fixo — métricas sempre disponíveis (mesmo sem dado ingerido),
// espelhando o "Personalizar colunas" do Meta onde tudo aparece.
function actionKpi(type) {
  const meta = META_ACTION_LABELS[type];
  return {
    id: `action:${type}`,
    actionType: type,
    source: 'action',
    label: meta ? meta.label : fallbackLabel(type),
    category: meta ? meta.category : 'Outros',
    format: fmtInt,
  };
}
function costKpi(type) {
  const meta = META_COST_LABELS[type];
  const base = META_ACTION_LABELS[type];
  return {
    id: `cost:${type}`,
    actionType: type,
    source: 'cost',
    label: meta ? meta.label : `Custo por ${base ? base.label.toLowerCase() : fallbackLabel(type).toLowerCase()}`,
    category: meta ? meta.category : base ? base.category : 'Custo',
    format: fmtCurrency,
  };
}
function valueKpi(type) {
  const meta = META_ACTION_VALUE_LABELS[type];
  const base = META_ACTION_LABELS[type];
  return {
    id: `value:${type}`,
    actionType: type,
    source: 'value',
    label: meta ? meta.label : `Valor de ${base ? base.label.toLowerCase() : fallbackLabel(type).toLowerCase()}`,
    category: meta ? meta.category : 'Comércio',
    format: fmtCurrency,
  };
}

export const META_STANDARD_KPIS = [
  // Seguidores e curtidas (Instagram)
  actionKpi('follow'),
  actionKpi('onsite_conversion.follow'),
  costKpi('follow'),
  costKpi('onsite_conversion.follow'),
  // Visitas ao perfil (Instagram)
  actionKpi('onsite_conversion.instagram_profile_visits'),
  actionKpi('onsite_conversion.profile_visits'),
  actionKpi('onsite_conversion.profile_visit'),
  actionKpi('profile_visits'),
  costKpi('onsite_conversion.instagram_profile_visits'),
  costKpi('onsite_conversion.profile_visits'),
  // Mensagens
  actionKpi('onsite_conversion.messaging_conversation_started'),
  actionKpi('onsite_conversion.messaging_conversation_started_7d'),
  actionKpi('onsite_conversion.total_messaging_connection'),
  actionKpi('onsite_conversion.messaging_first_reply'),
  actionKpi('onsite_conversion.messaging_conversation_replied_7d'),
  costKpi('onsite_conversion.messaging_conversation_started'),
  costKpi('onsite_conversion.messaging_first_reply'),
  // Engajamento
  actionKpi('post_engagement'),
  actionKpi('page_engagement'),
  actionKpi('post_reaction'),
  actionKpi('comment'),
  actionKpi('shares'),
  actionKpi('post_save'),
  actionKpi('post_interaction_gross'),
  actionKpi('checkin'),
  actionKpi('event_responses'),
  costKpi('post_engagement'),
  costKpi('page_engagement'),
  costKpi('post_interaction_gross'),
  costKpi('event_responses'),
  // Cliques
  actionKpi('link_click'),
  actionKpi('link_click_unique'),
  actionKpi('outbound_click'),
  actionKpi('button_click'),
  actionKpi('photo_view'),
  // Conversões
  actionKpi('purchase'),
  actionKpi('lead'),
  actionKpi('landing_page_view'),
  actionKpi('complete_registration'),
  actionKpi('contact'),
  actionKpi('add_to_cart'),
  actionKpi('view_content'),
  actionKpi('initiate_checkout'),
  costKpi('purchase'),
  costKpi('lead'),
  costKpi('landing_page_view'),
  costKpi('complete_registration'),
  costKpi('contact'),
  costKpi('add_to_cart'),
  costKpi('view_content'),
  valueKpi('purchase'),
  valueKpi('lead'),
  // Vídeo
  actionKpi('video_view'),
  actionKpi('video_play'),
  actionKpi('video_30s_watched'),
  actionKpi('video_thruplay_watched'),
  actionKpi('video_play_p100'),
  // Contato
  actionKpi('contact'),
  actionKpi('get_directions'),
  actionKpi('call_now'),
  actionKpi('message'),
];

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

// Soma total de spend de um conjunto de registros (para derivar custo por)
function sumSpend(records) {
  let total = 0;
  for (const r of records || []) total += Number(r.spend || 0);
  return total;
}

// Constrói o catálogo dinâmico de KPIs a partir dos registros retornados pela API.
// Gera: contagem (action), valor (value), custo por (cost) e ROAS — espelhando o Meta.
export function buildDynamicKpiCatalog(records) {
  const counts = {};
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

  const spend = sumSpend(records);
  // Catálogo padrão sempre disponível (sem duplicar os descobertos)
  const seenIds = new Set();
  const out = [];
  for (const k of META_STANDARD_KPIS) {
    if (!seenIds.has(k.id)) {
      seenIds.add(k.id);
      out.push(k);
    }
  }

  // Contagem (action) — descobertas, sem duplicar padrão
  const countKeys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  for (const k of countKeys) {
    const id = `action:${k}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    const meta = META_ACTION_LABELS[k];
    out.push({
      id,
      actionType: k,
      source: 'action',
      label: meta ? meta.label : fallbackLabel(k),
      category: meta ? meta.category : 'Outros',
      format: fmtInt,
    });
  }

  // Valor monetário (action_values) — descobertas, sem duplicar padrão
  const valueKeys = Object.keys(values).sort((a, b) => values[b] - values[a]);
  for (const k of valueKeys) {
    const id = `value:${k}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    const meta = META_ACTION_VALUE_LABELS[k];
    const base = META_ACTION_LABELS[k];
    out.push({
      id,
      actionType: k,
      source: 'value',
      label: meta ? meta.label : `Valor de ${base ? base.label : fallbackLabel(k)}`,
      category: meta ? meta.category : 'Comércio',
      format: fmtCurrency,
    });
  }

  // Custo por (spend / contagem) — descobertas, sem duplicar padrão
  for (const k of countKeys) {
    if (counts[k] <= 0) continue;
    const id = `cost:${k}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    const costMeta = META_COST_LABELS[k];
    const base = META_ACTION_LABELS[k];
    out.push({
      id,
      actionType: k,
      source: 'cost',
      label: costMeta ? costMeta.label : `Custo por ${base ? base.label.toLowerCase() : fallbackLabel(k).toLowerCase()}`,
      category: costMeta ? costMeta.category : base ? base.category : 'Custo',
      format: fmtCurrency,
      spend,
    });
  }

  // ROAS de resultados (quando há valor de compras)
  const purchaseValue =
    (values['offsite_conversion.fb_pixel_purchase'] || 0) ||
    (values['offsite_conversion.purchase'] || 0) ||
    (values['purchase'] || 0);
  if (spend > 0 && purchaseValue > 0) {
    out.push({
      id: 'roas:results',
      source: 'roas',
      label: 'ROAS de resultados',
      category: 'Resultados e investimento',
      format: fmtRoas,
      spend,
      purchaseValue,
    });
  }

  // Valor dos resultados (soma de valores de conversão)
  if (purchaseValue > 0) {
    out.push({
      id: 'value:results',
      source: 'fixedValue',
      label: 'Valor dos resultados',
      category: 'Resultados e investimento',
      format: fmtCurrency,
      value: purchaseValue,
    });
  }

  return out;
}

// Soma um KPI dinâmico sobre um conjunto de registros
export function sumDynamicKpi(records, kpi) {
  if (!kpi) return 0;
  if (kpi.source === 'roas') {
    const spend = sumSpend(records);
    if (spend <= 0) return 0;
    const purchaseValue =
      sumActionValue(records, 'offsite_conversion.fb_pixel_purchase') ||
      sumActionValue(records, 'offsite_conversion.purchase') ||
      sumActionValue(records, 'purchase');
    return purchaseValue / spend;
  }
  if (kpi.source === 'fixedValue') return kpi.value || 0;
  if (!kpi.actionType || !records) return 0;
  if (kpi.source === 'cost') {
    const spend = sumSpend(records);
    const count = sumActionCount(records, kpi.actionType);
    return count > 0 ? spend / count : 0;
  }
  if (kpi.source === 'value') {
    return sumActionValue(records, kpi.actionType);
  }
  return sumActionCount(records, kpi.actionType);
}

function sumActionCount(records, actionType) {
  let total = 0;
  for (const r of records || []) {
    const map = getActionsMap(r);
    total += map[actionType] || 0;
  }
  return total;
}

function sumActionValue(records, actionType) {
  let total = 0;
  for (const r of records || []) {
    const map = getActionValuesMap(r);
    total += map[actionType] || 0;
  }
  return total;
}

// -----------------------
// KPIs por plataforma (breakdown publisher_platform)
// -----------------------
export const PLATFORM_LABELS = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  messenger: 'Messenger',
  audience_network: 'Audience Network',
  whatsapp: 'WhatsApp',
};

export function platformLabel(p) {
  if (!p) return 'Plataforma';
  return PLATFORM_LABELS[p] || (p.charAt(0).toUpperCase() + p.slice(1));
}

// Descobre action_types por publisher_platform nos registros de breakdown.
export function buildPlatformKpiCatalog(platformRecords) {
  const byPlatform = {};
  for (const r of platformRecords || []) {
    const platform = r.publisher_platform;
    if (!platform) continue;
    const am = getActionsMap(r);
    if (!byPlatform[platform]) byPlatform[platform] = {};
    for (const k of Object.keys(am)) {
      if (am[k]) byPlatform[platform][k] = (byPlatform[platform][k] || 0) + am[k];
    }
  }

  const order = { instagram: 0, facebook: 1, messenger: 2, audience_network: 3, whatsapp: 4 };
  const platforms = Object.keys(byPlatform).sort((a, b) => (order[a] ?? 9) - (order[b] ?? 9));

  const out = [];
  for (const platform of platforms) {
    const actions = byPlatform[platform];
    const sorted = Object.entries(actions).sort((a, b) => b[1] - a[1]);
    for (const [actionType] of sorted) {
      const meta = META_ACTION_LABELS[actionType];
      const baseLabel = meta ? meta.label : fallbackLabel(actionType);
      out.push({
        id: `action:${platform}:${actionType}`,
        actionType,
        platform,
        source: 'action',
        label: `${baseLabel} · ${platformLabel(platform)}`,
        category: 'Por Plataforma',
        format: fmtInt,
      });
    }
  }
  return out;
}

// Soma um KPI por plataforma (filtra registros pelo publisher_platform)
export function sumPlatformKpi(platformRecords, kpi) {
  if (!kpi || !kpi.actionType || !kpi.platform || !platformRecords) return 0;
  let total = 0;
  for (const r of platformRecords) {
    if (r.publisher_platform !== kpi.platform) continue;
    const map = getActionsMap(r);
    total += map[kpi.actionType] || 0;
  }
  return total;
}