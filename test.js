const iframeContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { color: white; }
      </style>
    </head>
    <body>
      <div>Hi</div>
      
      <script>
        try {
          console.log('hello');
        } catch(e) {
          console.error("Error running interactive script:", e);
          document.body.innerHTML += '<div style="color:#f43f5e; margin-top:16px; font-size:12px; font-family:monospace;">Error in simulation logic: ' + e.message + '</div>';
        }
      </script>
    </body>
    </html>
  `;

  // Safely escape the entire HTML document for the srcdoc attribute
  const escapedSrcDoc = iframeContent
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

console.log(escapedSrcDoc.substring(0, 500));
