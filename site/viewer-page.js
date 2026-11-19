// Standalone viewer: shows the manifest of ?url= or of a picked example.
import './lib/awp-viewer.mjs';

const viewer = document.getElementById('viewer');
const urlInput = document.getElementById('url');
const example = document.getElementById('example');

function show(url) {
  if (!url) return;
  viewer.setAttribute('src', url);
}

function fromQuery() {
  const url = new URL(location.href).searchParams.get('url');
  if (!url) return false;
  // Only https (or this origin) so that a crafted link cannot point the page at other schemes.
  const target = new URL(url, location.href);
  if (target.protocol !== 'https:' && target.origin !== location.origin) return false;
  urlInput.value = target.href;
  show(target.href);
  return true;
}

document.getElementById('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const url = urlInput.value.trim();
  if (!url) return;
  history.replaceState(null, '', `?url=${encodeURIComponent(url)}`);
  show(url);
});

example.addEventListener('change', () => {
  if (!example.value) return;
  const url = new URL(`examples/${example.value}`, location.href).href;
  urlInput.value = url;
  history.replaceState(null, '', `?url=${encodeURIComponent(url)}`);
  show(url);
});

(async () => {
  try {
    const { examples } = await (await fetch('examples/index.json')).json();
    for (const name of examples) example.append(new Option(name, name));
  } catch {
    example.disabled = true;
  }
  if (!fromQuery()) show(new URL('examples/vulnerability-fixer.workflow.yaml', location.href).href);
})();
