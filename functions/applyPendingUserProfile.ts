import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Busca perfil pendente pelo email
    const allPending = await base44.asServiceRole.entities.PendingUserProfile.list();
    const pending = allPending.find(p => p.email === user.email && !p.applied);

    if (!pending) {
      return Response.json({ applied: false });
    }

    // Verifica se já existe UserProfile
    const existing = await base44.asServiceRole.entities.UserProfile.filter({ user_id: user.id });

    if (existing.length > 0) {
      // Atualiza o existente
      await base44.asServiceRole.entities.UserProfile.update(existing[0].id, {
        profile_id: pending.profile_id,
        unit_ids: pending.unit_ids || [],
      });
    } else {
      // Cria novo
      await base44.asServiceRole.entities.UserProfile.create({
        user_id: user.id,
        profile_id: pending.profile_id,
        unit_ids: pending.unit_ids || [],
      });
    }

    // Marca como aplicado
    await base44.asServiceRole.entities.PendingUserProfile.update(pending.id, { applied: true });

    return Response.json({ applied: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});