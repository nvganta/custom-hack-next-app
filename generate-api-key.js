async function createApiKey() {
  try {
    const { default: fetch } = await import('node-fetch');
    const response = await fetch('http://localhost:3000/api/contentpilot/api-keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Maya Central Agent Key' }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
    }

    const data = await response.json();
    console.log('Successfully created API key:');
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error creating API key:', error);
  }
}

createApiKey(); 