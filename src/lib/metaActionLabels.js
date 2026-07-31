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
  follow: { label: 'Seguidores no Instagram', category: 'Conversões', kind: 'int' },
  'onsite_conversion.follow': { label: 'Seguidores no Instagram', category: 'Conversões', kind: 'int' },
  page_likes: { label: 'Curtidas na Página', category: 'Conversões', kind: 'int' },
  'onsite_conversion.page_like': { label: 'Curtidas na Página', category: 'Conversões', kind: 'int' },
  'onsite_conversion.page_unlike': { label: 'Descurtidas da Página', category: 'Conversões', kind: 'int' },
  'onsite_conversion.page_net_likes': { label: 'Curtidas líquidas na Página', category: 'Conversões', kind: 'int' },

  // Vídeo
  video_view: { label: 'Visualizações de vídeo', category: 'Reconhecimento', kind: 'int' },
  video_play: { label: 'Reproduções de vídeo', category: 'Reconhecimento', kind: 'int' },
  video_play_p25: { label: 'Reproduções a 25%', category: 'Reconhecimento', kind: 'int' },
  video_play_p50: { label: 'Reproduções a 50%', category: 'Reconhecimento', kind: 'int' },
  video_play_p75: { label: 'Reproduções a 75%', category: 'Reconhecimento', kind: 'int' },
  video_play_p95: { label: 'Reproduções a 95%', category: 'Reconhecimento', kind: 'int' },
  video_play_p100: { label: 'Reproduções completas', category: 'Reconhecimento', kind: 'int' },
  video_10s_watched: { label: 'Visualizações de 10s', category: 'Reconhecimento', kind: 'int' },
  video_15s_watched: { label: 'Visualizações de 15s', category: 'Reconhecimento', kind: 'int' },
  video_30s_watched: { label: 'Visualizações de 30s', category: 'Reconhecimento', kind: 'int' },
  video_avg_time_watched: { label: 'Tempo médio de visualização', category: 'Reconhecimento', kind: 'int' },
  video_view_3s: { label: 'Visualizações de 3s', category: 'Reconhecimento', kind: 'int' },
  video_thruplay_watched: { label: 'ThruPlays', category: 'Reconhecimento', kind: 'int' },
  view_opens: { label: 'Visualizações', category: 'Reconhecimento', kind: 'int' },
  'onsite_conversion.video_view_opens': { label: 'Visualizações', category: 'Reconhecimento', kind: 'int' },
  unique_video_views: { label: 'Visualizadores', category: 'Reconhecimento', kind: 'int' },
  'onsite_conversion.unique_video_views': { label: 'Visualizadores', category: 'Reconhecimento', kind: 'int' },

  // Mensagens
  'onsite_conversion.messaging_conversation_started_7d': { label: 'Conversas por mensagem iniciadas', category: 'Conversões', kind: 'int' },
  'onsite_conversion.messaging_conversation_started': { label: 'Conversas por mensagem iniciadas', category: 'Conversões', kind: 'int' },
  'onsite_conversion.total_messaging_connection': { label: 'Contatos por mensagem que retornam', category: 'Conversões', kind: 'int' },
  'onsite_conversion.messaging_first_reply': { label: 'Conversas por mensagem respondidas', category: 'Conversões', kind: 'int' },
  'onsite_conversion.messaging_conversation_replied_7d': { label: 'Conversas por mensagem respondidas', category: 'Conversões', kind: 'int' },
  'onsite_conversion.messaging_referral_reply': { label: 'Respostas por referência', category: 'Conversões', kind: 'int' },
  'onsite_conversion.messaging_block': { label: 'Bloqueios de mensagem', category: 'Conversões', kind: 'int' },
  'onsite_conversion.messaging_user_depth_2_message_send': { label: 'Mensagens (profundidade 2)', category: 'Conversões', kind: 'int' },
  'onsite_conversion.messaging_user_depth_3_message_send': { label: 'Mensagens (profundidade 3)', category: 'Conversões', kind: 'int' },
  'onsite_conversion.messaging_user_depth_5_message_send': { label: 'Mensagens (profundidade 5)', category: 'Conversões', kind: 'int' },
  'onsite_conversion.welcome_message_opened': { label: 'Visualizações da mensagem de boas-vindas', category: 'Conversões', kind: 'int' },
  whatsapp_opened: { label: 'WhatsApp aberto', category: 'Conversões', kind: 'int' },
  'onsite_conversion.booking': { label: 'Reservas', category: 'Conversões', kind: 'int' },
  'onsite_conversion.appointment_update': { label: 'Agendamentos', category: 'Conversões', kind: 'int' },

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
  add_to_cart: { label: 'Adições ao carrinho', category: 'Conversões', kind: 'int' },
  'offsite_conversion.fb_pixel_add_to_cart': { label: 'Adições ao carrinho', category: 'Conversões', kind: 'int' },
  add_to_wishlist: { label: 'Adições à lista de desejos', category: 'Conversões', kind: 'int' },
  initiate_checkout: { label: 'Inícios de checkout', category: 'Conversões', kind: 'int' },
  'offsite_conversion.initiate_checkout': { label: 'Inícios de checkout', category: 'Conversões', kind: 'int' },
  view_content: { label: 'Visualizações de conteúdo', category: 'Conversões', kind: 'int' },
  'offsite_conversion.fb_pixel_view_content': { label: 'Visualizações de conteúdo', category: 'Conversões', kind: 'int' },
  'offsite_conversion.view_content': { label: 'Visualizações de conteúdo', category: 'Conversões', kind: 'int' },
  search: { label: 'Buscas', category: 'Conversões', kind: 'int' },
  'offsite_conversion.fb_pixel_search': { label: 'Buscas', category: 'Conversões', kind: 'int' },

  // Contato
  contact: { label: 'Contatos', category: 'Conversões', kind: 'int' },
  get_directions: { label: 'Como chegar', category: 'Conversões', kind: 'int' },
  find_location: { label: 'Buscas de localização', category: 'Conversões', kind: 'int' },
  call_now: { label: 'Chamadas', category: 'Conversões', kind: 'int' },
  'onsite_conversion.call_now': { label: 'Chamadas', category: 'Conversões', kind: 'int' },
  message: { label: 'Mensagens', category: 'Conversões', kind: 'int' },
  'onsite_conversion.message_send': { label: 'Mensagens', category: 'Conversões', kind: 'int' },

  // Visitas ao perfil / Instagram
  'onsite_conversion.profile_visits': { label: 'Visitas ao perfil', category: 'Conversões', kind: 'int' },
  'onsite_conversion.instagram_profile_visits': { label: 'Visitas ao perfil do Instagram', category: 'Conversões', kind: 'int' },
  'onsite_conversion.profile_visit': { label: 'Visitas ao perfil', category: 'Conversões', kind: 'int' },
  'instagram_profile_visits': { label: 'Visitas ao perfil do Instagram', category: 'Conversões', kind: 'int' },
  profile_visits: { label: 'Visitas ao perfil', category: 'Conversões', kind: 'int' },

  // Leads Meta (formulários/CRM)
  'offsite_complete_registration_add_meta_leads': { label: 'Cadastros (Leads Meta)', category: 'Conversões', kind: 'int' },
  'offsite_search_add_meta_leads': { label: 'Buscas (Leads Meta)', category: 'Conversões', kind: 'int' },
  'offsite_content_view_add_meta_leads': { label: 'Visitas (Leads Meta)', category: 'Conversões', kind: 'int' },
};

// Rótulos exatos para a coluna de VALOR (action_values) — "Valor de ..." no Meta
export const META_ACTION_VALUE_LABELS = {
  'offsite_conversion.fb_pixel_purchase': { label: 'Valor de compras', category: 'Conversões' },
  'offsite_conversion.purchase': { label: 'Valor de compras', category: 'Conversões' },
  purchase: { label: 'Valor de compras', category: 'Conversões' },
  'offsite_conversion.fb_pixel_add_to_cart': { label: 'Valor de adições ao carrinho', category: 'Conversões' },
  add_to_cart: { label: 'Valor de adições ao carrinho', category: 'Conversões' },
  'offsite_conversion.fb_pixel_view_content': { label: 'Valor de visualizações de conteúdo', category: 'Conversões' },
  view_content: { label: 'Valor de visualizações de conteúdo', category: 'Conversões' },
  'offsite_conversion.fb_pixel_lead': { label: 'Valor de leads', category: 'Conversões' },
  'offsite_conversion.lead': { label: 'Valor de leads', category: 'Conversões' },
  lead: { label: 'Valor de leads', category: 'Conversões' },
};

// Rótulos exatos para "Custo por ..." (derivado: spend / count) — espelha o Meta
export const META_COST_LABELS = {
  'onsite_conversion.messaging_conversation_started': { label: 'Custo por conversa por mensagem iniciada', category: 'Conversões' },
  'onsite_conversion.messaging_conversation_started_7d': { label: 'Custo por conversa por mensagem iniciada', category: 'Conversões' },
  'onsite_conversion.messaging_first_reply': { label: 'Custo por conversa por mensagem respondida', category: 'Conversões' },
  'onsite_conversion.messaging_conversation_replied_7d': { label: 'Custo por conversa por mensagem respondida', category: 'Conversões' },
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
  add_to_cart: { label: 'Custo por adição ao carrinho', category: 'Conversões' },
  'offsite_conversion.fb_pixel_add_to_cart': { label: 'Custo por adição ao carrinho', category: 'Conversões' },
  view_content: { label: 'Custo por visualização de conteúdo', category: 'Conversões' },
  landing_page_view: { label: 'Custo por visualização da página de destino', category: 'Conversões' },
  complete_registration: { label: 'Custo por cadastro concluído', category: 'Conversões' },
  contact: { label: 'Custo por contato', category: 'Conversões' },
  follow: { label: 'Custo por seguidor', category: 'Conversões' },
  'onsite_conversion.follow': { label: 'Custo por seguidor', category: 'Conversões' },
  'onsite_conversion.instagram_profile_visits': { label: 'Custo por visita ao perfil do Instagram', category: 'Conversões' },
  'onsite_conversion.profile_visits': { label: 'Custo por visita ao perfil', category: 'Conversões' },
  'onsite_conversion.profile_visit': { label: 'Custo por visita ao perfil', category: 'Conversões' },
  profile_visits: { label: 'Custo por visita ao perfil', category: 'Conversões' },
  post_reaction: { label: 'Custo por reação', category: 'Engajamento' },
  comment: { label: 'Custo por comentário', category: 'Engajamento' },
  shares: { label: 'Custo por compartilhamento', category: 'Engajamento' },
  post_save: { label: 'Custo por salvamento', category: 'Engajamento' },
  'onsite_conversion.post_save': { label: 'Custo por salvamento', category: 'Engajamento' },
  video_view: { label: 'Custo por visualização de vídeo', category: 'Reconhecimento' },
  video_play: { label: 'Custo por reprodução', category: 'Reconhecimento' },
  'onsite_conversion.total_messaging_connection': { label: 'Custo por contato por mensagem', category: 'Conversões' },
  get_directions: { label: 'Custo por como chegar', category: 'Conversões' },
  call_now: { label: 'Custo por chamada', category: 'Conversões' },
  message: { label: 'Custo por mensagem', category: 'Conversões' },
  initiate_checkout: { label: 'Custo por início de checkout', category: 'Conversões' },
  add_to_wishlist: { label: 'Custo por adição à lista de desejos', category: 'Conversões' },
  search: { label: 'Custo por busca', category: 'Conversões' },
};

const fmtInt = (v) => new Intl.NumberFormat('pt-BR').format(Math.round(Number(v || 0)));
const fmtCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const fmtPct = (v) => `${Number(v || 0).toFixed(2)}%`;
const fmtRoas = (v) => `${Number(v || 0).toFixed(2)}`;

// ---------------------------------------------------------------------------
// Métricas CANÔNICAS — cada métrica lógica soma TODAS as suas variantes de
// action_type (ex: "follow" e "onsite_conversion.follow" viram um único KPI
// "Seguidores no Instagram"). Evita duplicatas/triplicatas no catálogo e bate
// com o "Personalizar colunas" do Meta, que mostra uma coluna por métrica.
// Categorias = grupos do Gerenciador de Anúncios:
//   Resultado e investimento | Distribuição | Reconhecimento | Engajamento | Conversões
// ---------------------------------------------------------------------------
export const META_CANONICAL_METRICS = [
  // -- Conversões (Instagram / perfil / contato) --
  { key: 'instagram_profile_visits', label: 'Visitas ao perfil do Instagram', category: 'Conversões',
    actionTypes: ['onsite_conversion.instagram_profile_visits', 'instagram_profile_visits'],
    costLabel: 'Custo por visita ao perfil do Instagram' },
  { key: 'profile_visits', label: 'Visitas ao perfil', category: 'Conversões',
    actionTypes: ['onsite_conversion.profile_visits', 'onsite_conversion.profile_visit', 'profile_visits'],
    costLabel: 'Custo por visita ao perfil' },
  { key: 'follow', label: 'Seguidores no Instagram', category: 'Conversões',
    actionTypes: ['follow', 'onsite_conversion.follow'],
    costLabel: 'Custo por seguidor' },
  { key: 'page_likes', label: 'Curtidas na Página', category: 'Conversões',
    actionTypes: ['page_likes', 'onsite_conversion.page_like'] },

  // -- Conversões (comércio / pixel) --
  { key: 'purchase', label: 'Compras', category: 'Conversões',
    actionTypes: ['purchase', 'offsite_conversion.purchase', 'offsite_conversion.fb_pixel_purchase'],
    valueLabel: 'Valor de compras', costLabel: 'Custo por compra' },
  { key: 'lead', label: 'Leads', category: 'Conversões',
    actionTypes: ['lead', 'leadgen_other', 'offsite_conversion.lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_group', 'onsite_conversion.lead_grouped'],
    valueLabel: 'Valor de leads', costLabel: 'Custo por lead' },
  { key: 'add_to_cart', label: 'Adições ao carrinho', category: 'Conversões',
    actionTypes: ['add_to_cart', 'offsite_conversion.fb_pixel_add_to_cart'],
    valueLabel: 'Valor de adições ao carrinho', costLabel: 'Custo por adição ao carrinho' },
  { key: 'view_content', label: 'Visualizações de conteúdo', category: 'Conversões',
    actionTypes: ['view_content', 'offsite_conversion.fb_pixel_view_content', 'offsite_conversion.view_content'],
    valueLabel: 'Valor de visualizações de conteúdo', costLabel: 'Custo por visualização de conteúdo' },
  { key: 'landing_page_view', label: 'Visualizações da página de destino', category: 'Conversões',
    actionTypes: ['landing_page_view', 'omni_landing_page_view'],
    costLabel: 'Custo por visualização da página de destino' },
  { key: 'complete_registration', label: 'Cadastros concluídos', category: 'Conversões',
    actionTypes: ['complete_registration'],
    costLabel: 'Custo por cadastro concluído' },
  { key: 'initiate_checkout', label: 'Inícios de checkout', category: 'Conversões',
    actionTypes: ['initiate_checkout', 'offsite_conversion.initiate_checkout'],
    costLabel: 'Custo por início de checkout' },
  { key: 'search', label: 'Buscas', category: 'Conversões',
    actionTypes: ['search', 'offsite_conversion.fb_pixel_search'],
    costLabel: 'Custo por busca' },

  // -- Conversões (contato / mensagem) --
  // Usa SOMENTE a variante _7d — é a coluna oficial "Conversas por mensagem iniciadas"
  // do Gerenciador de Anúncios. A variante sem _7d tem janela de atribuição diferente
  // e a Meta retorna as duas no mesmo payload; somá-las duplica a contagem (ex: 37 vs 32).
  { key: 'messaging_conversation_started', label: 'Conversas por mensagem iniciadas', category: 'Conversões',
    actionTypes: ['onsite_conversion.messaging_conversation_started_7d'],
    costLabel: 'Custo por conversa por mensagem iniciada' },
  { key: 'total_messaging_connection', label: 'Contatos por mensagem que retornam', category: 'Conversões',
    actionTypes: ['onsite_conversion.total_messaging_connection'],
    costLabel: 'Custo por contato por mensagem' },
  // Usa SOMENTE a variante _7d — é a coluna oficial "Conversas por mensagem respondidas"
  // do Gerenciador de Anúncios. messaging_first_reply tem janela de atribuição diferente
  // e somá-las duplica a contagem.
  { key: 'messaging_first_reply', label: 'Conversas por mensagem respondidas', category: 'Conversões',
    actionTypes: ['onsite_conversion.messaging_conversation_replied_7d'],
    costLabel: 'Custo por conversa por mensagem respondida' },
  { key: 'contact', label: 'Contatos', category: 'Conversões',
    actionTypes: ['contact'], costLabel: 'Custo por contato' },
  { key: 'get_directions', label: 'Como chegar', category: 'Conversões',
    actionTypes: ['get_directions', 'find_location'], costLabel: 'Custo por como chegar' },
  { key: 'call_now', label: 'Chamadas', category: 'Conversões',
    actionTypes: ['call_now', 'onsite_conversion.call_now'], costLabel: 'Custo por chamada' },
  { key: 'message', label: 'Mensagens', category: 'Conversões',
    actionTypes: ['message', 'onsite_conversion.message_send'], costLabel: 'Custo por mensagem' },

  // -- Engajamento --
  { key: 'link_click', label: 'Cliques no link', category: 'Engajamento',
    actionTypes: ['link_click'], costLabel: 'CPC (custo por clique no link)' },
  { key: 'link_click_unique', label: 'Cliques no link únicos', category: 'Engajamento',
    actionTypes: ['link_click_unique'], costLabel: 'Custo por clique único (todos)' },
  { key: 'outbound_click', label: 'Cliques de saída', category: 'Engajamento',
    actionTypes: ['outbound_click'] },
  { key: 'outbound_click_unique', label: 'Cliques de saída únicos', category: 'Engajamento',
    actionTypes: ['outbound_click_unique'] },
  { key: 'button_click', label: 'Cliques no botão', category: 'Engajamento',
    actionTypes: ['button_click'] },
  { key: 'photo_view', label: 'Cliques na foto', category: 'Engajamento',
    actionTypes: ['photo_view'] },
  { key: 'click_onsite', label: 'Cliques na loja', category: 'Engajamento',
    actionTypes: ['click_onsite'] },
  { key: 'post_engagement', label: 'Engajamentos com o post', category: 'Engajamento',
    actionTypes: ['post_engagement'], costLabel: 'Custo por engajamento com o post' },
  { key: 'page_engagement', label: 'Engajamento com a Página', category: 'Engajamento',
    actionTypes: ['page_engagement'], costLabel: 'Custo por engajamento com a Página' },
  { key: 'post_reaction', label: 'Reações ao post', category: 'Engajamento',
    actionTypes: ['post_reaction'], costLabel: 'Custo por reação' },
  { key: 'comment', label: 'Comentários no post', category: 'Engajamento',
    actionTypes: ['comment'], costLabel: 'Custo por comentário' },
  { key: 'shares', label: 'Compartilhamentos do post', category: 'Engajamento',
    actionTypes: ['shares'], costLabel: 'Custo por compartilhamento' },
  { key: 'post_save', label: 'Salvamentos do post', category: 'Engajamento',
    actionTypes: ['post_save', 'onsite_conversion.post_save'], costLabel: 'Custo por salvamento' },
  { key: 'post_interaction_gross', label: 'Interações', category: 'Engajamento',
    actionTypes: ['post_interaction_gross'], costLabel: 'Custo por interação' },
  { key: 'checkin', label: 'Check-ins', category: 'Engajamento',
    actionTypes: ['checkin'] },
  { key: 'event_responses', label: 'Participações no evento', category: 'Engajamento',
    actionTypes: ['event_responses', 'onsite_conversion.rsvp'], costLabel: 'Custo por participação no evento' },

  // -- Reconhecimento (vídeo / alcance de marca) --
  { key: 'video_view', label: 'Visualizações de vídeo', category: 'Reconhecimento',
    actionTypes: ['video_view'], costLabel: 'Custo por visualização de vídeo' },
  { key: 'video_play', label: 'Reproduções de vídeo', category: 'Reconhecimento',
    actionTypes: ['video_play'], costLabel: 'Custo por reprodução' },
  { key: 'video_30s_watched', label: 'Visualizações de 30s', category: 'Reconhecimento',
    actionTypes: ['video_30s_watched'] },
  { key: 'video_thruplay_watched', label: 'ThruPlays', category: 'Reconhecimento',
    actionTypes: ['video_thruplay_watched'] },
  { key: 'video_play_p100', label: 'Reproduções completas', category: 'Reconhecimento',
    actionTypes: ['video_play_p100'] },
  { key: 'video_10s_watched', label: 'Visualizações de 10s', category: 'Reconhecimento',
    actionTypes: ['video_10s_watched'] },
  { key: 'video_15s_watched', label: 'Visualizações de 15s', category: 'Reconhecimento',
    actionTypes: ['video_15s_watched'] },
];

// Mapa reverso: action_type -> chave canônica
export const ACTION_TYPE_TO_CANONICAL = (() => {
  const m = {};
  for (const c of META_CANONICAL_METRICS) {
    for (const at of c.actionTypes) m[at] = c.key;
  }
  return m;
})();

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

// Constrói o catálogo de KPIs a partir dos registros.
// Usa métricas CANÔNICAS (uma entrada cada, somando variantes) + descoberta de
// action_types não mapeados. Categorias = grupos do Gerenciador de Anúncios.
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
  const out = [];
  const seenIds = new Set();
  const add = (entry) => {
    if (!seenIds.has(entry.id)) {
      seenIds.add(entry.id);
      out.push(entry);
    }
  };

  // 1) Métricas canônicas (sempre disponíveis, somando variantes)
  for (const c of META_CANONICAL_METRICS) {
    add({
      id: `action:${c.key}`,
      canonicalKey: c.key,
      actionTypes: c.actionTypes,
      source: 'action',
      label: c.label,
      category: c.category,
      format: fmtInt,
    });
    if (c.costLabel) {
      add({
        id: `cost:${c.key}`,
        canonicalKey: c.key,
        actionTypes: c.actionTypes,
        source: 'cost',
        label: c.costLabel,
        category: c.category,
        format: fmtCurrency,
        spend,
      });
    }
    if (c.valueLabel) {
      add({
        id: `value:${c.key}`,
        canonicalKey: c.key,
        actionTypes: c.actionTypes,
        source: 'value',
        label: c.valueLabel,
        category: c.category,
        format: fmtCurrency,
      });
    }
  }

  // 2) Descoberta: action_types que não pertencem a nenhuma métrica canônica
  const mapped = new Set(Object.keys(ACTION_TYPE_TO_CANONICAL));
  const countKeys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  for (const k of countKeys) {
    if (mapped.has(k)) continue;
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

  const valueKeys = Object.keys(values).sort((a, b) => values[b] - values[a]);
  for (const k of valueKeys) {
    if (mapped.has(k)) continue;
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
      category: meta ? meta.category : 'Conversões',
      format: fmtCurrency,
    });
  }

  for (const k of countKeys) {
    if (mapped.has(k)) continue;
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
      category: costMeta ? costMeta.category : base ? base.category : 'Conversões',
      format: fmtCurrency,
      spend,
    });
  }

  // 3) ROAS de resultados (quando há valor de compras)
  const purchaseValue =
    (values['offsite_conversion.fb_pixel_purchase'] || 0) ||
    (values['offsite_conversion.purchase'] || 0) ||
    (values['purchase'] || 0);
  if (spend > 0 && purchaseValue > 0) {
    out.push({
      id: 'roas:results',
      source: 'roas',
      label: 'ROAS de resultados',
      category: 'Resultado e investimento',
      format: fmtRoas,
      spend,
      purchaseValue,
    });
  }

  if (purchaseValue > 0) {
    out.push({
      id: 'value:results',
      source: 'fixedValue',
      label: 'Valor dos resultados',
      category: 'Resultado e investimento',
      format: fmtCurrency,
      value: purchaseValue,
    });
  }

  return out;
}

// Resolve a lista de action_types que um KPI cobre (canônico = várias variantes)
function kpiActionTypes(kpi) {
  if (kpi.actionTypes && Array.isArray(kpi.actionTypes)) return kpi.actionTypes;
  if (kpi.actionType) return [kpi.actionType];
  return [];
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
  if (!records) return 0;
  const types = kpiActionTypes(kpi);
  if (!types.length) return 0;
  if (kpi.source === 'cost') {
    const spend = sumSpend(records);
    const count = sumActionCountMany(records, types);
    return count > 0 ? spend / count : 0;
  }
  if (kpi.source === 'value') {
    return sumActionValueMany(records, types);
  }
  return sumActionCountMany(records, types);
}

function sumActionCount(records, actionType) {
  return sumActionCountMany(records, [actionType]);
}
function sumActionCountMany(records, types) {
  const set = new Set(types);
  let total = 0;
  for (const r of records || []) {
    const map = getActionsMap(r);
    for (const k of Object.keys(map)) {
      if (set.has(k)) total += map[k] || 0;
    }
  }
  return total;
}

function sumActionValue(records, actionType) {
  return sumActionValueMany(records, [actionType]);
}
function sumActionValueMany(records, types) {
  const set = new Set(types);
  let total = 0;
  for (const r of records || []) {
    const map = getActionValuesMap(r);
    for (const k of Object.keys(map)) {
      if (set.has(k)) total += map[k] || 0;
    }
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