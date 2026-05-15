// Vercel Serverless Function — proxy per a Anthropic
// La clau API viu al servidor com a variable ANTHROPIC_API_KEY

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: { message: 'ANTHROPIC_API_KEY no configurada al servidor Vercel' }
    });
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });

    const responseText = await upstream.text();
    let parsed;
    try { parsed = JSON.parse(responseText); } catch (e) { parsed = { raw: responseText }; }

    return res.status(upstream.status).json(parsed);
  } catch (err) {
    return res.status(502).json({
      error: { message: 'Error: ' + (err && err.message ? err.message : String(err)) }
    });
  }
}
