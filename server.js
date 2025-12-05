
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Create public folder if not exists
if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR);
    console.log('✅ Created public folder');
}

function parseMultipartFormData(body, boundary) {
    const parts = body.split(`--${boundary}`);
    const result = { files: [], fields: {} };

    for (const part of parts) {
        if (part.trim() === '' || part.trim() === '--') continue;

        const headersEnd = part.indexOf('\r\n\r\n');
        if (headersEnd === -1) continue;

        const headersText = part.substring(0, headersEnd);
        const bodyText = part.substring(headersEnd + 4);

        // Parse headers
        const headers = {};
        const headerLines = headersText.split('\r\n');
        for (const line of headerLines) {
            const colonIndex = line.indexOf(':');
            if (colonIndex > -1) {
                const key = line.substring(0, colonIndex).trim().toLowerCase();
                const value = line.substring(colonIndex + 1).trim();
                headers[key] = value;
            }
        }

        const contentDisposition = headers['content-disposition'];
        if (contentDisposition) {
            const nameMatch = contentDisposition.match(/name="([^"]+)"/);
            const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);

            if (filenameMatch) {
                // It's a file - FIX HERE: Handle binary data properly
                const rawData = bodyText;
                
                // Convert the binary string to Buffer properly
                let buffer;
                if (typeof rawData === 'string') {
                    // Create buffer from binary string
                    const length = rawData.length;
                    buffer = Buffer.alloc(length);
                    for (let i = 0; i < length; i++) {
                        buffer[i] = rawData.charCodeAt(i) & 0xFF;
                    }
                } else {
                    buffer = Buffer.from(rawData);
                }
                
                // Remove trailing \r\n if present
                let finalData = buffer;
                if (buffer.slice(-2).toString() === '\r\n') {
                    finalData = buffer.slice(0, -2);
                }
                
                result.files.push({
                    name: nameMatch ? nameMatch[1] : 'file',
                    filename: filenameMatch[1],
                    contentType: headers['content-type'] || 'application/octet-stream',
                    data: finalData
                });
            } else if (nameMatch) {
                // It's a field
                result.fields[nameMatch[1]] = bodyText.substring(0, bodyText.length - 2);
            }
        }
    }

    return result;
}

const server = http.createServer((req, res) => {
    // Parse URL
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const query = url.searchParams;

    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // API: Test endpoint
    if (pathname === '/api/test' && req.method === 'GET') {
        try {
            const files = fs.existsSync(PUBLIC_DIR) ? fs.readdirSync(PUBLIC_DIR) : [];
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: 'Server is working!',
                time: new Date().toISOString(),
                publicDir: PUBLIC_DIR,
                files: files,
                fileCount: files.length
            }));
        } catch (error) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: 'Server is working!',
                time: new Date().toISOString(),
                publicDir: PUBLIC_DIR,
                files: [],
                fileCount: 0,
                error: error.message
            }));
        }
        return;
    }

    // API: Get image
    if (pathname === '/api/getImage' && req.method === 'GET') {
        const name = query.get('name') || 'tom';
        const imageName = name.toLowerCase() + '.jpg';
        const imagePath = path.join(PUBLIC_DIR, imageName);

        console.log(`🔍 Searching for: ${imagePath}`);

        if (fs.existsSync(imagePath)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
res.end(JSON.stringify({
    success: true,
    image: `/images/${imageName}?t=${Date.now()}`,  
    name: name,
    debug: {  
        size: stats.size,
        header: header
    }
}));

            }));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: `No image found for "${name}"`,
                suggestion: 'Upload an image first'
            }));
        }
        return;
    }

    // API: Upload image
    if (pathname === '/api/upload' && req.method === 'POST') {
        const name = query.get('name');

        if (!name) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: 'Name parameter is required. Use ?name=xxx'
            }));
            return;
        }

        let body = [];
        req.on('data', chunk => {
            body.push(chunk);
        }).on('end', () => {
            body = Buffer.concat(body);

            const contentType = req.headers['content-type'];
            if (!contentType || !contentType.includes('multipart/form-data')) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: 'Content-Type must be multipart/form-data'
                }));
                return;
            }

            // Extract boundary
            const boundaryMatch = contentType.match(/boundary=(.+)/);
            if (!boundaryMatch) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: 'No boundary in Content-Type'
                }));
                return;
            }

            const boundary = boundaryMatch[1];

            try {
    // Parse the form data - FIX: Use 'latin1' encoding for binary
    const bodyString = body.toString('latin1');  // Changed from 'binary' to 'latin1'
    const formData = parseMultipartFormData(bodyString, boundary);

    if (formData.files.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'No file found in upload'
        }));
        return;
    }

    const file = formData.files[0];
    const fileName = name.toLowerCase() + '.jpg';
    const filePath = path.join(PUBLIC_DIR, fileName);

    console.log(`📁 File data size: ${file.data.length} bytes`);
    console.log(`📁 First 10 bytes (hex): ${file.data.slice(0, 10).toString('hex')}`);
    
    // Save the file with binary flag
    fs.writeFileSync(filePath, file.data, 'binary');  // Added 'binary' flag
               
                console.log(`✅ Image saved: ${fileName} (${file.data.length} bytes)`);

                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store'
                });
                res.end(JSON.stringify({
                    success: true,
                    message: `Image "${name}" uploaded successfully!`,
                    image: `/images/${fileName}`,
                    name: name
                }));

            } catch (error) {
                console.error('❌ Upload error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: 'Upload failed: ' + error.message
                }));
            }
        });

        req.on('error', (error) => {
            console.error('❌ Request error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: 'Request error: ' + error.message
            }));
        });

        return;
    }

    // API: List images
    if (pathname === '/api/images' && req.method === 'GET') {
        try {
            const files = fs.existsSync(PUBLIC_DIR) ? fs.readdirSync(PUBLIC_DIR) : [];
            const images = files
                .filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file))
                .map(file => {
                    const filePath = path.join(PUBLIC_DIR, file);
                    const stats = fs.statSync(filePath);
                    return {
                        name: file.replace(/\.[^/.]+$/, ''),
                        filename: file,
                        url: `/images/${file}`,
                        size: stats.size
                    };
                });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: images.length,
                images: images
            }));
        } catch (error) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: 0,
                images: [],
                error: error.message
            }));
        }
        return;
    }

    // Serve static images
    if (pathname.startsWith('/images/')) {
        const imageName = pathname.substring(8); // Remove '/images/'
        const imagePath = path.join(PUBLIC_DIR, imageName);

        if (fs.existsSync(imagePath)) {
            const ext = path.extname(imagePath).toLowerCase();
            const contentType = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif'
            }[ext] || 'application/octet-stream';

            res.writeHead(200, {
                'Content-Type': contentType,
                'Cache-Control': 'no-store'
            });
            res.end(fs.readFileSync(imagePath));
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Image not found');
        }
        return;
    }

    // Serve HTML page
    if (pathname === '/' || pathname === '/index.html') {
        const htmlPath = path.join(__dirname, 'index.html');
        if (fs.existsSync(htmlPath)) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(fs.readFileSync(htmlPath));
        } else {
            // Simple fallback HTML
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Image System</title>
                <style>
                    body { font-family: Arial; padding: 20px; }
                    .box { border: 2px solid #333; padding: 20px; margin: 20px 0; }
                    input, button { padding: 10px; margin: 5px; }
                </style>
            </head>
            <body>
                <h1>Image Management System</h1>
                <div class="box">
                    <h2>Search Image</h2>
                    <input type="text" id="name" value="tom">
                    <button onclick="search()">Search</button>
                    <br><br>
                    <img id="img" src="" style="max-width:300px; display:none;">
                    <div id="noimg">No image</div>
                    <p id="result"></p>
                </div>
                <div class="box">
                    <h2>Upload Image</h2>
                    <input type="file" id="file">
                    <button onclick="upload()">Upload</button>
                    <p id="uploadResult"></p>
                </div>
                <script>
                    const API = 'http://localhost:${PORT}';
                    async function search() {
                        const name = document.getElementById('name').value;
                        try {
                            const res = await fetch(API + '/api/getImage?name=' + name);
                            const data = await res.json();
                            if (data.success) {
                                document.getElementById('img').src = API + data.image;
                                document.getElementById('img').style.display = 'block';
                                document.getElementById('noimg').style.display = 'none';
                                document.getElementById('result').innerHTML = 'Found: ' + name;
                                document.getElementById('result').style.color = 'green';
                            } else {
                                document.getElementById('img').style.display = 'none';
                                document.getElementById('noimg').style.display = 'block';
                                document.getElementById('result').innerHTML = data.error;
                                document.getElementById('result').style.color = 'red';
                            }
                        } catch {
                            document.getElementById('result').innerHTML = 'Server error';
                            document.getElementById('result').style.color = 'red';
                        }
                    }
                    async function upload() {
                        const name = document.getElementById('name').value;
                        const file = document.getElementById('file').files[0];
                        if (!file) { alert('Select file'); return; }
                        const form = new FormData();
                        form.append('image', file);
                        try {
                            const res = await fetch(API + '/api/upload?name=' + name, {
                                method: 'POST',
                                body: form
                            });
                            const data = await res.json();
                            document.getElementById('uploadResult').innerHTML = 
                                data.success ? '✅ Uploaded!' : '❌ ' + data.error;
                            document.getElementById('uploadResult').style.color = 
                                data.success ? 'green' : 'red';
                            if (data.success) search();
                        } catch {
                            document.getElementById('uploadResult').innerHTML = 'Upload failed';
                            document.getElementById('uploadResult').style.color = 'red';
                        }
                    }
                    search();
                </script>
            </body>
            </html>
            `);
        }
        return;
    }

    // 404 Not Found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        success: false,
        error: 'Route not found: ' + pathname
    }));
});

server.listen(PORT, () => {
    console.log(`
   
    
    ✅ Running on: http://localhost:${PORT}
    📁 Public folder: ${PUBLIC_DIR}
    
   
    `);
});

// Handle server errors
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught error:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);

});


