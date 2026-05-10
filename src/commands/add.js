const COST_REGEX = /^\d+(\.\d{1,2})?$/;
const CURRENCY_REGEX = /^[A-Z]{3}$/;

async function askLoop(io, question, validate) {
  while (true) {
    const raw = await io.ask(question);
    const value = raw.trim();
    const result = validate(value);
    if (result.ok) return result.value;
    io.stderr.write(`  ${result.error}\n`);
  }
}

export async function run(args, { store, io }) {
  const subs = await store.load();
  const existing = new Set(subs.map((s) => s.name.toLowerCase()));

  const name = await askLoop(io, 'Name: ', (v) => {
    if (!v) return { ok: false, error: 'Name cannot be empty.' };
    if (existing.has(v.toLowerCase())) return { ok: false, error: `"${v}" already exists.` };
    return { ok: true, value: v };
  });

  const cost = await askLoop(io, 'Monthly cost: ', (v) => {
    if (!COST_REGEX.test(v)) {
      return { ok: false, error: 'Cost must be a positive number with up to 2 decimals.' };
    }
    const n = parseFloat(v);
    if (n <= 0) return { ok: false, error: 'Cost must be greater than 0.' };
    return { ok: true, value: n };
  });

  const currency = await askLoop(io, 'Currency [USD]: ', (v) => {
    const value = (v || 'USD').toUpperCase();
    if (!CURRENCY_REGEX.test(value)) {
      return { ok: false, error: 'Currency must be 3 letters (e.g., USD, EUR).' };
    }
    return { ok: true, value };
  });

  const category = await askLoop(io, 'Category: ', (v) => {
    if (!v) return { ok: false, error: 'Category cannot be empty.' };
    return { ok: true, value: v };
  });

  const renewalDay = await askLoop(io, 'Renewal day (1-31): ', (v) => {
    if (!/^\d+$/.test(v)) {
      return { ok: false, error: 'Renewal day must be an integer between 1 and 31.' };
    }
    const n = parseInt(v, 10);
    if (n < 1 || n > 31) {
      return { ok: false, error: 'Renewal day must be an integer between 1 and 31.' };
    }
    return { ok: true, value: n };
  });

  const sub = {
    name,
    cost,
    currency,
    category,
    renewalDay,
    addedAt: new Date().toISOString(),
  };
  await store.save([...subs, sub]);
  io.stdout.write(`Added "${name}".\n`);
}
