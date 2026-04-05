function isCompletedPayment(payment, type) {
  if (!payment || typeof payment !== 'object') {
    return false;
  }

  if (type && payment.type !== type) {
    return false;
  }

  return payment.status === 'completed';
}

function buildPaymentAccessSummary(payments, client = null) {
  const rows = Array.isArray(payments) ? payments : [];
  const legacyVirtualTourUnlocked = !!(client && client.marcel_enabled === true);

  return {
    scanPaid: rows.some((payment) => isCompletedPayment(payment, 'scan_3d')),
    virtualTourUnlocked:
      legacyVirtualTourUnlocked
      || rows.some((payment) => isCompletedPayment(payment, 'virtual_tour')),
  };
}

async function fetchClientPayments(supabase, clientId) {
  if (!supabase || !clientId) {
    return [];
  }

  const { data, error } = await supabase
    .from('payments')
    .select('id, type, status, amount_cents, currency, paid_at, created_at, description')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Lecture paiements: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
}

module.exports = {
  buildPaymentAccessSummary,
  fetchClientPayments,
  isCompletedPayment,
};
