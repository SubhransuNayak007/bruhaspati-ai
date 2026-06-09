

async function test() {
  const apiKey = 'REDACTED_API_KEY';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`;
  
  const body = {
    contents: [{ parts: [{ text: "Hello" }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  console.log('Status:', response.status);
  const text = await response.text();
  console.log('Response:', text);
}

test();
