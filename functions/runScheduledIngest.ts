import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Brasília timezone offset: UTC-3
function getBrasiliaDate(offsetDays = 0) {
  const now = new Date();
  const brasiliaMs = now.getTime() - (3 * 60 * 60 * 1000);
  const brasilia = new Date(brasiliaMs);
  brasilia.setDate(brasilia.getDate() + offsetDays);
  return brasilia.toISOString().split('T')[0];
}

function getBrasiliaHHMM() {
  const now = new Date();
  const brasiliaMs = now.getTime() - (3 * 60 * 60 * 1000);
  const brasilia = new Date(brasiliaMs);
  const hh = String(brasilia.getUTCHours()).padStart(2, '0');
  const mm = String(brasilia.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function getBrasiliaDayOfWeek() {
  const now = new Date();
  const brasiliaMs = now.getTime() - (3 * 60 * 60 * 1000);
  return new Date(brasiliaMs).getUTCDay(); // 0=Sun, 6=Sat
}

function simpleHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(16);
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Allow both scheduled (no auth) and manual (admin) calls
  let isAdmin = false;
  try {
    const user = await base44.auth.me();
    isAdmin = user?.role === 'admin';
  } catch (_) {}

  // For scheduled automation calls, we skip auth check
  // For manual calls, only admins can trigger
  const body = await req.json().catch(() => ({}));
  const { schedule_id, force_all } = body;

  const nowBrasilia = getBrasiliaHHMM();
  const today = getBrasiliaDate(0);
  const yesterday = getBrasiliaDate(-1);
  const todayDOW = getBrasiliaDayOfWeek();

  console.log(`⏰ runScheduledIngest | brasília_time=${nowBrasilia} | today=${today} | yesterday=${yesterday}`);

  // Load all active schedules (or just one if schedule_id passed)
  let schedules;
  if (schedule_id) {
    // id is a built-in field, can't filter by it - fetch all and filter in-memory
    const all = await base44.asServiceRole.entities.IngestSchedule.filter({ is_active: true });
    schedules = all.filter(s => s.id === schedule_id);
  } else {
    schedules = await base44.asServiceRole.entities.IngestSchedule.filter({ is_active: true });
  }

  if (!schedules.length) {
    return Response.json({ ok: true, message: 'Nenhum agendamento ativo', ran: 0 });
  }

  const results = [];

  for (const schedule of schedules) {
    // Check if current Brasília time matches any scheduled time (within 5min window)
    const shouldRun = force_all || schedule_id || schedule.schedule_times?.some(t => {
      const [sh, sm] = t.split(':').map(Number);
      const [nh, nm] = nowBrasilia.split(':').map(Number);
      const diff = Math.abs((sh * 60 + sm) - (nh * 60 + nm));
      return diff <= 4; // within 4 minutes
    });

    if (!shouldRun) continue;

    // Determine date range
    let date_from, date_to;
    if (schedule.date_mode === 'today') {
      date_from = today; date_to = today;
    } else if (schedule.date_mode === 'yesterday_and_today') {
      date_from = yesterday; date_to = today;
    } else {
      // default: yesterday
      date_from = yesterday; date_to = yesterday;
    }

    const modes = schedule.modes || ['base'];
    const unit_ids = schedule.unit_ids || [];

    // Load units
    const allUnits = await base44.asServiceRole.entities.Unit.filter({ status: 'active' });
    const units = allUnits.filter(u => unit_ids.includes(u.id));

    const scheduleResult = { schedule_id: schedule.id, name: schedule.name, jobs: [] };

    // Update schedule: mark as running
    await base44.asServiceRole.entities.IngestSchedule.update(schedule.id, {
      last_run: new Date().toISOString(),
      last_status: 'running',
      last_log: `Iniciado em ${nowBrasilia} (horário Brasília)`
    });

    // Enfileirar em SEQUÊNCIA, por unidade em ordem alfabética
    const sortedUnits = [...units].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    let enqueuedCount = 0;

    // Buscar tokens Meta associados às unidades
    const allMetaTokens = await base44.asServiceRole.entities.MetaToken.filter({ status: 'active' });
    const unitTokenMap = {};
    allMetaTokens.forEach(mt => {
      mt.unit_ids?.forEach(uid => {
        unitTokenMap[uid] = mt.token;
      });
    });

    for (const unit of sortedUnits) {
      if (!unit.account_id) {
        scheduleResult.jobs.push({ unit: unit.name, status: 'skipped', reason: 'sem account_id (configure em Unidades)' });
        continue;
      }
      
      const metaToken = unitTokenMap[unit.id];
      if (!metaToken) {
        scheduleResult.jobs.push({ unit: unit.name, status: 'skipped', reason: 'sem token Meta (configure em Tokens Meta)' });
        continue;
      }

      for (const mode of modes) {
        const job_key = simpleHash(`${unit.account_id}:${date_from}:${date_to}:${mode}:sched`);
        
        try {
          const result = await base44.asServiceRole.functions.invoke('enqueueMetaIngest', {
            account_id: unit.account_id,
            unit_id: unit.id,
            date_from,
            date_to,
            job_type: 'insights',
            level: 'ad',
            breakdowns: [],
            force: schedule.force || false,
            meta_token: metaToken,
            mode,
            job_key_override: job_key,
            trigger_type: 'scheduled',
            schedule_name: schedule.name,
          });

          if (result.data?.status === 'queued') {
            scheduleResult.jobs.push({
              unit: unit.name,
              mode: mode,
              status: 'queued',
              job_id: result.data.job_id
            });
            enqueuedCount++;
          } else {
            scheduleResult.jobs.push({
              unit: unit.name,
              mode: mode,
              status: 'skipped',
              reason: result.data?.status || 'status desconhecido'
            });
          }
        } catch (err) {
          scheduleResult.jobs.push({
            unit: unit.name,
            mode: mode,
            status: 'error',
            error: err.message
          });
        }
      }
    }

     // Sync creatives if configured (também em paralelo, sem delay)
     if (schedule.sync_creatives) {
       const creativeDOW = schedule.creatives_day_of_week;
       const shouldSyncCreatives = force_all || schedule_id || (creativeDOW == null ? true : creativeDOW === todayDOW);

       if (shouldSyncCreatives) {
         const creativeTasks = units
           .filter(u => u.account_id && unitTokenMap[u.id])
           .map(unit =>
             base44.asServiceRole.functions.invoke('syncMetaCreatives', {
               account_id: unit.account_id,
               unit_id: unit.id,
               meta_token: unitTokenMap[unit.id],
             }).then(res => ({ unit, status: 'done', data: res.data }))
               .catch(e => ({ unit, status: 'error', error: e.message }))
           );

         const creativesResults = await Promise.all(creativeTasks);
         for (const cResult of creativesResults) {
           scheduleResult.jobs.push({
             unit: cResult.unit.name,
             mode: 'creatives',
             status: cResult.status,
             rows: cResult.data?.rows_written || 0,
             error: cResult.error || null,
           });
         }
       }
     }

     const skippedByReason = scheduleResult.jobs.reduce((acc, j) => {
       if (j.status === 'skipped') {
         acc[j.reason] = (acc[j.reason] || 0) + 1;
       }
       return acc;
     }, {});

     const logLines = [`${enqueuedCount} jobs enfileirados (${scheduleResult.jobs.filter(j => j.status === 'queued').length} sucesso, ${scheduleResult.jobs.filter(j => j.status === 'skipped').length} pulados)`];

     Object.entries(skippedByReason).forEach(([reason, count]) => {
       logLines.push(`${count} unidades puladas: ${reason}`);
     });

     scheduleResult.jobs.forEach(j => {
       if (j.status === 'queued' || j.status === 'error') {
         logLines.push(`${j.unit}/${j.mode}: ${j.status}${j.job_id ? ` (${j.job_id})` : ''}${j.error ? ` - ${j.error}` : ''}`);
       }
     });

     const logSummary = logLines.join('\n');

     await base44.asServiceRole.entities.IngestSchedule.update(schedule.id, {
       last_status: 'success',
       last_log: `${nowBrasilia} Brasília | ${date_from}→${date_to} | ${logSummary}`
     });

     results.push(scheduleResult);
     }

     return Response.json({ ok: true, ran: results.length, results, message: `${results.reduce((sum, r) => sum + r.jobs.filter(j => j.status === 'queued').length, 0)} jobs enfileirados` });
     });