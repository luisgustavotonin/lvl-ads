import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    // LIST — retorna todos os tokens SEM o campo token
    if (action === 'list') {
      const tokens = await base44.asServiceRole.entities.MetaToken.list('-created_date');
      const safe = tokens.map(({ token, ...rest }) => rest); // remove token
      return Response.json({ tokens: safe });
    }

    // CREATE — salva token, nunca retorna o valor
    if (action === 'create') {
      const { name, token, unit_ids, notes } = body;
      if (!name || !token) return Response.json({ error: 'Nome e token são obrigatórios' }, { status: 400 });

      const created = await base44.asServiceRole.entities.MetaToken.create({
        name, token, unit_ids: unit_ids || [], notes: notes || '', status: 'active'
      });

      const { token: _t, ...safe } = created;
      return Response.json({ token: safe });
    }

    // UPDATE — atualiza; se token vier vazio, mantém o existente
    if (action === 'update') {
      const { id, name, token, unit_ids, notes, status } = body;
      if (!id) return Response.json({ error: 'ID obrigatório' }, { status: 400 });

      const patch = { name, unit_ids, notes, status };
      if (token && token.trim()) patch.token = token; // só atualiza se informado

      const updated = await base44.asServiceRole.entities.MetaToken.update(id, patch);
      const { token: _t, ...safe } = updated;
      return Response.json({ token: safe });
    }

    // DELETE
    if (action === 'delete') {
      const { id } = body;
      if (!id) return Response.json({ error: 'ID obrigatório' }, { status: 400 });
      await base44.asServiceRole.entities.MetaToken.delete(id);
      return Response.json({ ok: true });
    }

    // GET_TOKEN_FOR_UNIT — uso interno das outras funções de ingestão
    if (action === 'get_token_for_unit') {
      const { unit_id } = body;
      if (!unit_id) return Response.json({ error: 'unit_id obrigatório' }, { status: 400 });

      const all = await base44.asServiceRole.entities.MetaToken.list();
      const match = all.find(t => t.status === 'active' && Array.isArray(t.unit_ids) && t.unit_ids.includes(unit_id));

      if (!match) return Response.json({ error: 'Nenhum token ativo encontrado para esta unidade' }, { status: 404 });
      return Response.json({ token: match.token }); // retorna token apenas para uso interno backend
    }

    return Response.json({ error: 'Ação inválida' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});