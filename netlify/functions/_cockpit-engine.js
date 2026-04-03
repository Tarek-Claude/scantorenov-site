const {
  ACTIVE_TASK_STATES,
  getTaskTypeDefinition,
  normalizeClientStatus,
} = require('./_cockpit-config');

function addDays(baseDate, numberOfDays) {
  const date = baseDate ? new Date(baseDate) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + numberOfDays);
  return date.toISOString();
}

function getClientDisplayName(client) {
  const first = client && client.prenom ? String(client.prenom).trim() : '';
  const last = client && client.nom ? String(client.nom).trim() : '';
  const fullName = [first, last].filter(Boolean).join(' ').trim();
  return fullName || client.email || 'Client';
}

function buildExpectedTask(taskType, overrides) {
  const definition = getTaskTypeDefinition(taskType);
  if (!definition) return null;

  return {
    task_type: taskType,
    title: definition.label,
    description: null,
    owner: 'scantorenov',
    priority: definition.defaultPriority,
    screen_target: definition.screenTarget,
    status: 'open',
    due_date: null,
    proof_required: null,
    created_from: 'cockpit_reconcile',
    meta: {},
    ...overrides,
  };
}

function getExpectedTasksForClient(client) {
  const normalizedStatus = normalizeClientStatus(client && client.status ? client.status : 'contact_submitted')
    || 'contact_submitted';
  const displayName = getClientDisplayName(client);

  switch (normalizedStatus) {
    case 'contact_submitted':
      return [
        buildExpectedTask('lead_review', {
          description: `Verifier la demande initiale et qualifier le dossier de ${displayName}.`,
          due_date: addDays(client && client.updated_at, 1),
          proof_required: 'Lead qualifie ou besoin de relance consigne',
        }),
      ];

    case 'identity_created':
      return [
        buildExpectedTask('onboarding_nudge', {
          description: `Suivre la progression de ${displayName} dans l espace client et relancer si besoin.`,
          status: 'waiting_client',
          due_date: addDays(client && client.updated_at, 3),
          proof_required: 'Onboarding termine ou relance envoyee',
        }),
      ];

    case 'onboarding_completed':
      return [
        buildExpectedTask('client_followup', {
          title: 'Suivre la prise de RDV telephone',
          description: `Attendre ou relancer la prise de rendez-vous telephone pour ${displayName}.`,
          status: 'waiting_client',
          due_date: addDays(client && client.updated_at, 3),
          screen_target: 'client_overview',
          proof_required: 'RDV telephone reserve',
          meta: { followup_kind: 'phone_booking' },
        }),
      ];

    case 'call_requested':
      return [
        buildExpectedTask('phone_call_prepare', {
          description: `Preparer le rendez-vous telephone de ${displayName}.`,
          due_date: client && client.call_scheduled_at ? client.call_scheduled_at : addDays(new Date(), 1),
          proof_required: 'Contexte relu et rendez-vous confirme',
        }),
      ];

    case 'call_done':
      return [
        buildExpectedTask('phone_summary_validate', {
          status: 'awaiting_validation',
          description: `Valider la synthese d appel et decider de la suite pour ${displayName}.`,
          due_date: addDays(client && client.updated_at, 1),
          proof_required: 'Synthese d appel validee',
        }),
      ];

    case 'scan_scheduled':
      return [
        buildExpectedTask('scan_payment_followup', {
          status: 'waiting_client',
          description: `Suivre le paiement du scan et la bonne tenue du rendez-vous pour ${displayName}.`,
          due_date: addDays(client && client.updated_at, 2),
          proof_required: 'Paiement confirme',
        }),
      ];

    case 'scan_payment_completed':
      return [
        buildExpectedTask('scan_visit_prepare', {
          description: `Preparer la visite de scan 3D pour ${displayName}.`,
          due_date: addDays(client && client.updated_at, 1),
          proof_required: 'Logistique visite prete',
        }),
      ];

    case 'scan_completed':
      return [
        buildExpectedTask('scan_assets_sync', {
          description: `Rattacher Matterport, photos et fichiers du scan au dossier de ${displayName}.`,
          due_date: addDays(client && client.updated_at, 1),
          proof_required: 'Assets du scan synchronises',
        }),
      ];

    case 'analysis_ready':
      return [
        buildExpectedTask('analysis_build', {
          description: `Produire l analyse complete du projet de ${displayName}.`,
          due_date: addDays(client && client.updated_at, 2),
          proof_required: 'Analyse structuree produite',
        }),
      ];

    case 'avant_projet_ready':
      return [
        buildExpectedTask('avant_project_finalize', {
          description: `Finaliser l avant-projet de ${displayName} et preparer sa transmission.`,
          due_date: addDays(client && client.updated_at, 2),
          proof_required: 'Avant-projet finalise',
        }),
      ];

    case 'avant_projet_transmitted':
      return [
        buildExpectedTask('client_followup', {
          title: 'Suivre le retour apres transmission',
          description: `Attendre ou relancer le retour de ${displayName} apres transmission de l avant-projet.`,
          status: 'waiting_client',
          due_date: addDays(client && client.updated_at, 3),
          screen_target: 'avant_projet_screen',
          proof_required: 'Retour client ou prochaine etape decidee',
          meta: { followup_kind: 'avant_projet' },
        }),
      ];

    case 'accompaniment_subscribed':
      return [
        buildExpectedTask('accompaniment_onboard', {
          description: `Lancer la feuille de route d accompagnement pour ${displayName}.`,
          due_date: addDays(client && client.updated_at, 2),
          proof_required: 'Feuille de route creee',
        }),
      ];

    case 'abandoned':
    case 'paused':
      return [];

    default:
      return [];
  }
}

function isMissingTableError(error) {
  const message = error && error.message ? error.message : '';
  return /admin_tasks/i.test(message) && (/does not exist/i.test(message) || /Could not find the table/i.test(message));
}

async function fetchClientByReference(supabase, options = {}) {
  const { clientId, email } = options;

  let query = supabase.from('clients').select('*').limit(1);
  if (clientId) {
    query = query.eq('id', clientId);
  } else if (email) {
    query = query.eq('email', String(email).trim().toLowerCase());
  } else {
    throw new Error('clientId ou email requis');
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(`Lecture client cockpit: ${error.message}`);
  }
  return data || null;
}

async function listActiveTasks(supabase, clientId) {
  const { data, error } = await supabase
    .from('admin_tasks')
    .select('*')
    .eq('client_id', clientId)
    .in('status', ACTIVE_TASK_STATES)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

async function insertTask(supabase, clientId, expectedTask) {
  const payload = {
    client_id: clientId,
    task_type: expectedTask.task_type,
    title: expectedTask.title,
    description: expectedTask.description,
    owner: expectedTask.owner,
    status: expectedTask.status,
    previous_status: null,
    priority: expectedTask.priority,
    due_date: expectedTask.due_date,
    screen_target: expectedTask.screen_target,
    created_from: expectedTask.created_from,
    blocking_reason: null,
    proof_required: expectedTask.proof_required,
    meta: expectedTask.meta || {},
  };

  const { error } = await supabase.from('admin_tasks').insert([payload]);
  if (error) throw error;
}

async function updateActiveTask(supabase, taskId, currentTask, expectedTask) {
  const patch = {};
  const fields = [
    'title',
    'description',
    'owner',
    'status',
    'priority',
    'due_date',
    'screen_target',
    'created_from',
    'proof_required',
  ];

  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i];
    if ((currentTask[field] || null) !== (expectedTask[field] || null)) {
      patch[field] = expectedTask[field] || null;
    }
  }

  const currentMeta = JSON.stringify(currentTask.meta || {});
  const nextMeta = JSON.stringify(expectedTask.meta || {});
  if (currentMeta !== nextMeta) {
    patch.meta = expectedTask.meta || {};
  }

  if (Object.keys(patch).length === 0) {
    return false;
  }

  patch.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('admin_tasks')
    .update(patch)
    .eq('id', taskId);

  if (error) throw error;
  return true;
}

async function closeTask(supabase, task, terminalStatus, reason) {
  const patch = {
    previous_status: task.status,
    status: terminalStatus,
    updated_at: new Date().toISOString(),
    meta: {
      ...(task.meta || {}),
      close_reason: reason,
    },
  };

  if (terminalStatus === 'done') {
    patch.completed_at = new Date().toISOString();
  }
  if (terminalStatus === 'cancelled') {
    patch.cancelled_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('admin_tasks')
    .update(patch)
    .eq('id', task.id);

  if (error) throw error;
}

async function reconcileClientTasks(options = {}) {
  const { supabase, clientId, email, client: providedClient } = options;
  if (!supabase) {
    throw new Error('Supabase requis');
  }

  const client = providedClient || await fetchClientByReference(supabase, { clientId, email });
  if (!client) {
    return { skipped: true, reason: 'client_not_found' };
  }

  const expectedTasks = getExpectedTasksForClient(client).filter(Boolean);
  const expectedByType = expectedTasks.reduce((acc, task) => {
    acc[task.task_type] = task;
    return acc;
  }, {});

  let activeTasks;
  try {
    activeTasks = await listActiveTasks(supabase, client.id);
  } catch (error) {
    if (isMissingTableError(error)) {
      return { skipped: true, reason: 'missing_admin_tasks_table', client };
    }
    throw new Error(`Lecture admin_tasks: ${error.message}`);
  }

  const activeByType = activeTasks.reduce((acc, task) => {
    if (!acc[task.task_type]) acc[task.task_type] = [];
    acc[task.task_type].push(task);
    return acc;
  }, {});

  let created = 0;
  let updated = 0;
  let closed = 0;

  const expectedTaskTypes = Object.keys(expectedByType);
  for (let i = 0; i < expectedTaskTypes.length; i += 1) {
    const taskType = expectedTaskTypes[i];
    const expectedTask = expectedByType[taskType];
    const activeTask = activeByType[taskType] && activeByType[taskType][0];

    if (!activeTask) {
      try {
        await insertTask(supabase, client.id, expectedTask);
        created += 1;
      } catch (error) {
        if (!isMissingTableError(error)) {
          throw new Error(`Creation admin_task ${taskType}: ${error.message}`);
        }
        return { skipped: true, reason: 'missing_admin_tasks_table', client };
      }
      continue;
    }

    const hasChanged = await updateActiveTask(supabase, activeTask.id, activeTask, expectedTask);
    if (hasChanged) updated += 1;

    const duplicates = activeByType[taskType].slice(1);
    for (let d = 0; d < duplicates.length; d += 1) {
      await closeTask(supabase, duplicates[d], 'done', 'duplicate_task_reconciled');
      closed += 1;
    }
  }

  for (let i = 0; i < activeTasks.length; i += 1) {
    const task = activeTasks[i];
    if (expectedByType[task.task_type]) continue;

    const terminalStatus = normalizeClientStatus(client.status) === 'abandoned' ? 'cancelled' : 'done';
    await closeTask(supabase, task, terminalStatus, 'superseded_by_client_status');
    closed += 1;
  }

  return {
    skipped: false,
    client,
    expectedTaskTypes,
    created,
    updated,
    closed,
  };
}

async function safeReconcileClientTasks(options = {}) {
  try {
    return await reconcileClientTasks(options);
  } catch (error) {
    console.warn('[cockpit] reconcile skipped:', error.message);
    return {
      skipped: true,
      reason: error.message,
    };
  }
}

module.exports = {
  getExpectedTasksForClient,
  reconcileClientTasks,
  safeReconcileClientTasks,
};
