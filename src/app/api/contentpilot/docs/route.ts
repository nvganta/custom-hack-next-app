import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

// GET /api/contentpilot/docs - Serve OpenAPI specification
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    // Read the OpenAPI specification file
    const specPath = join(process.cwd(), 'public', 'api', 'openapi.yaml');
    const specContent = readFileSync(specPath, 'utf8');

    if (format === 'yaml') {
      return new NextResponse(specContent, {
        headers: {
          'Content-Type': 'application/x-yaml',
          'Content-Disposition': 'inline; filename="contentpilot-api.yaml"'
        }
      });
    } else {
      // Convert YAML to JSON
      const specJson = yaml.load(specContent);
      
      return NextResponse.json(specJson, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

  } catch {
    console.error('Error serving API documentation:', error);
    return NextResponse.json(
      { 
        error: 'Failed to load API documentation',
        message: 'OpenAPI specification could not be loaded'
      },
      { status: 500 }
    );
  }
}

// Serve Swagger UI HTML page
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    if (action === 'swagger-ui') {
      const swaggerHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ContentPilot Agent API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css" />
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *, *:before, *:after {
      box-sizing: inherit;
    }
    body {
      margin:0;
      background: #fafafa;
    }
    .swagger-ui .topbar {
      background-color: #2c3e50;
    }
    .swagger-ui .topbar .download-url-wrapper {
      display: none;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  
  <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: '/api/contentpilot/docs?format=json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        requestInterceptor: function(request) {
          // Add API key to requests if available
          const apiKey = localStorage.getItem('contentpilot_api_key');
          if (apiKey) {
            request.headers['x-api-key'] = apiKey;
          }
          return request;
        },
        onComplete: function() {
          // Add API key input
          const topbar = document.querySelector('.topbar');
          if (topbar) {
            const apiKeyInput = document.createElement('div');
            apiKeyInput.innerHTML = \`
              <div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: #34495e;">
                <label style="color: white; font-weight: bold;">API Key:</label>
                <input 
                  type="password" 
                  id="api-key-input" 
                  placeholder="Enter your API key" 
                  style="padding: 5px; border: none; border-radius: 3px; width: 300px;"
                  value="\${localStorage.getItem('contentpilot_api_key') || ''}"
                />
                <button 
                  onclick="setApiKey()" 
                  style="padding: 5px 10px; background: #3498db; color: white; border: none; border-radius: 3px; cursor: pointer;"
                >
                  Set Key
                </button>
                <button 
                  onclick="clearApiKey()" 
                  style="padding: 5px 10px; background: #e74c3c; color: white; border: none; border-radius: 3px; cursor: pointer;"
                >
                  Clear
                </button>
              </div>
            \`;
            topbar.appendChild(apiKeyInput);
          }
        }
      });

      // Global functions for API key management
      window.setApiKey = function() {
        const input = document.getElementById('api-key-input');
        const apiKey = input.value.trim();
        if (apiKey) {
          localStorage.setItem('contentpilot_api_key', apiKey);
          alert('API key saved! It will be included in all requests.');
        } else {
          alert('Please enter a valid API key.');
        }
      };

      window.clearApiKey = function() {
        localStorage.removeItem('contentpilot_api_key');
        document.getElementById('api-key-input').value = '';
        alert('API key cleared.');
      };
    };
  </script>
</body>
</html>`;

      return new NextResponse(swaggerHtml, {
        headers: {
          'Content-Type': 'text/html'
        }
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch {
    console.error('Error generating Swagger UI:', error);
    return NextResponse.json(
      { error: 'Failed to generate documentation UI' },
      { status: 500 }
    );
  }
} 
