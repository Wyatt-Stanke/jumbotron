import os
from http.server import SimpleHTTPRequestHandler, HTTPServer
import urllib.request

# Last fetched: 9/24/2024

college_mode = True

class ProxyHTTPRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, local_folder=None, **kwargs):
        self.local_folder = local_folder or os.getcwd()
        super().__init__(*args, **kwargs, directory=self.local_folder)

    def do_GET(self):
        unjoined_path = (self.path + "index.html" if self.path.endswith('/') else self.path)
        print(unjoined_path)
        unjoined_path = unjoined_path.split('?', 1)[0]
        file_path = os.path.join(self.local_folder, unjoined_path.lstrip('/'))
            
        if os.path.isdir(file_path):
            file_path = os.path.join(file_path, 'index.html')
        
        if os.path.exists(file_path):
            self.path = os.path.join(self.path, 'index.html') if os.path.isdir(self.path) else self.path
            print(f'Local request: {self.path}')
            # Read the file from the filesystem
            with open(file_path, 'rb') as f:
                content = f.read()
                self.send_response(200)
                self.end_headers()
                self.wfile.write(content)
        else:
            print(f'Proxy request: {self.path}')
            self.fetch_from_url(file_path)

    def fetch_from_url(self, file_path):
        url_prefix_normal = 'https://806e2242-df99-4dcd-b6ac-2c20175159a8.poki-gdn.com/87546fb2-d628-4f5e-81b8-982f740fb40a'
        url_prefix_college = "https://72e5ba00-c3c7-45d5-b68b-abd8c280716d.poki-gdn.com/db71795e-0efa-4f47-927e-a141eea00e86"
        url_prefix = url_prefix_college if college_mode else url_prefix_normal
        target_url = url_prefix + self.path + ('index.html' if self.path.endswith('/') else '')
        headers = {
            'Referer': 'https://games.poki.com/'
        }
        req = urllib.request.Request(target_url, headers=headers)
        try:
            with urllib.request.urlopen(req) as response:
                content = response.read()
                self.send_response(response.status)
                self.send_header('Content-type', response.headers.get_content_type())
                self.end_headers()
                self.wfile.write(content)
                
                # Write the content to the filesystem
                os.makedirs(os.path.dirname(file_path), exist_ok=True)
                with open(file_path, 'wb') as f:
                    f.write(content)
        except urllib.error.URLError as e:
            print(f'Failed to fetch {target_url}: {e}')
            self.send_error(404, f'File not found: {url_prefix + self.path}')

def run(server_class=HTTPServer, handler_class=ProxyHTTPRequestHandler, port=8000, local_folder=None):
    def handler(*args, **kwargs):
        handler_class(*args, local_folder=local_folder, **kwargs)
    
    server_address = ('', port)
    httpd = server_class(server_address, handler)
    print(f'Starting httpd server on port {port}')
    httpd.serve_forever()

if __name__ == '__main__':
    run(port=8000, local_folder=('raw_co/' if college_mode else 'raw/'))