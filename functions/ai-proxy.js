// Netlify Function — proxy per a l'API d'Anthropic
// La clau API viu com a variable d'entorn ANTHROPIC_API_KEY al servidor de Netlify
// El navegador mai veu la clau

exports.handler = async (event) => {
  // Només acceptem POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Verificar que la clau API està configurada al servidor
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: {
          message: 'ANTHROPIC_API_KEY no configurada al servidor de Netlify. Ves a Site settings → Environment variables i afegeix-la.'
        }
      })
    };
  }

  // Parsejar el cos de la petició
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: { message: 'Cos de la petició invàlid' } })
    };
  }

  // Cridar l'API d'Anthropic
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    const data = await response.text();

    return {
      statusCode: response.status,
      headers: { 'Content-Type': 'application/json' },
      body: data
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: { message: 'Error contactant amb Anthropic: ' + err.message }
      })
    };
  }
};
