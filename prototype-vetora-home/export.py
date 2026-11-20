"""Build the portable, self-contained HTML. No network or third-party packages."""
import argparse
import base64
import json
import mimetypes
from pathlib import Path

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=ROOT / 'Vetora_Prototype_Iteration_02.html')
args = parser.parse_args()
assets = {}
for path in sorted((ROOT / 'assets').iterdir()):
    if path.is_file():
        mime = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
        assets['assets/' + path.name] = 'data:' + mime + ';base64,' + base64.b64encode(path.read_bytes()).decode()
html = (ROOT / 'index.html').read_text()
css = (ROOT / 'styles.css').read_text()
html = html.replace('<link rel="stylesheet" href="styles.css">', '<style>' + css + '</style>')
html = html.replace('<script src="data.js" defer></script>', '<script>window.VETORA_EMBEDDED_ASSETS=' + json.dumps(assets) + ';\n' + (ROOT / 'data.js').read_text().replace('</script', '<\\/script') + '</script>')
# app.js needs the DOM; execute at the end of the body, after the dialog exists.
html = html.replace('<script src="app.js" defer></script>', '')
script = (ROOT / 'app.js').read_text()
# The supporting image is a literal inside a JS HTML template. Other images use asset().
script = script.replace('src="assets/auth-pets-generated.png"', 'src="${asset(\'assets/auth-pets-generated.png\')}"')
html = html.replace('</body>', '<script>' + script.replace('</script', '<\\/script') + '</script></body>')
html = html.replace('href="assets/original-0.png"', 'href="' + assets['assets/original-0.png'] + '"')
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(html)
print(f'{args.output} ({args.output.stat().st_size:,} bytes; {len(assets)} embedded images)')
