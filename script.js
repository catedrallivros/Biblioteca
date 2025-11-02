// script.js - frontend logic
const VERCEL_BASE = 'https://api-knvy.vercel.app'; // seu backend Vercel
const livros = [
  { titulo:"Dom Casmurro", autor:"Machado de Assis", categoria:"romance", descricao:"Um dos maiores clássicos da literatura brasileira.", imagem:"https://m.media-amazon.com/images/I/71kxa1-0zfL.jpg", link:"https://www.dominiopublico.gov.br/download/texto/ua000005.pdf" },
  { titulo:"O Alienista", autor:"Machado de Assis", categoria:"contos", descricao:"Uma sátira sobre ciência e loucura em Itaguaí.", imagem:"https://m.media-amazon.com/images/I/81a4kCNuH+L.jpg", link:"https://www.dominiopublico.gov.br/download/texto/ua000004.pdf" },
  { titulo:"A Metamorfose", autor:"Franz Kafka", categoria:"literatura-estrangeira", descricao:"A transformação de um homem em inseto e suas consequências.", imagem:"https://m.media-amazon.com/images/I/71dFAGPqYpL.jpg", link:"https://www.dominiopublico.gov.br/download/texto/uf000001.pdf" },
  { titulo:"Assim Falou Zaratustra", autor:"Friedrich Nietzsche", categoria:"filosofia", descricao:"Obra-prima da filosofia moderna sobre a superação humana.", imagem:"https://m.media-amazon.com/images/I/81-6vVnM0BL.jpg", link:"https://www.dominiopublico.gov.br/download/texto/ph000001.pdf" }
];

const container = document.getElementById('livrosContainer');
const searchInput = document.getElementById('searchInput');
const categorySelect = document.getElementById('categorySelect');

let livroAtual = '';
let currentChargeId = null;
let pollingTimer = null;

function renderizarLivros(lista){
  container.innerHTML = '';
  lista.forEach(livro=>{
    const div = document.createElement('div');
    div.className = 'livro';
    div.innerHTML = `
      <img src="${livro.imagem}" alt="${livro.titulo}">
      <h3>${livro.titulo}</h3>
      <div class="meta">${livro.autor}</div>
      <p class="desc">${livro.descricao}</p>
      <button class="btn" onclick="iniciarCompra('${encodeURIComponent(livro.titulo)}')">💸 Comprar via Pix</button>
      <a class="btn" id="baixar-${livro.titulo}" href="${livro.link}" style="display:none;margin-left:8px;">⬇️ Baixar Livro</a>
    `;
    container.appendChild(div);
  });
}

async function iniciarCompra(tituloEnc){
  const titulo = decodeURIComponent(tituloEnc);
  livroAtual = titulo;
  try{
    const value = 2.00;
    const resp = await fetch(`${VERCEL_BASE}/api/create-charge`, {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title: titulo, value })
    });
    if(!resp.ok){ alert('Erro ao criar cobrança.'); return; }
    const data = await resp.json();
    currentChargeId = data.chargeId || (data.raw && (data.raw.id || data.raw.txid)) || null;
    const qr = data.qr_url || (data.raw && (data.raw.qr_code_url || data.raw.qr || data.raw.qrcode)) || null;

    // mostra modal
    const modal = document.getElementById('pixModal');
    const img = modal.querySelector('img.qr');
    img.src = qr || 'https://upload.wikimedia.org/wikipedia/commons/0/04/Pix_logo.svg';
    modal.style.display = 'flex';

    if(currentChargeId) startPollingStatus(currentChargeId);
  }catch(err){
    console.error('iniciarCompra', err);
    alert('Erro ao iniciar cobrança.');
  }
}

function fecharPix(){ document.getElementById('pixModal').style.display = 'none'; }

function startPollingStatus(chargeId){
  if(!chargeId) return;
  if(pollingTimer) clearInterval(pollingTimer);
  pollingTimer = setInterval(async ()=>{
    try{
      const r = await fetch(`${VERCEL_BASE}/api/check-status`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ chargeId })
      });
      if(!r.ok) return;
      const j = await r.json();
      if(j.paid){ clearInterval(pollingTimer); onPaymentConfirmed(); }
    }catch(e){ console.error('poll', e); }
  }, 3000);
}

function onPaymentConfirmed(){
  fecharPix();
  // som
  const audio = new Audio('https://cdn.pixabay.com/download/audio/2022/03/15/audio_9e5ad91b0b.mp3?filename=correct-2-46134.mp3');
  audio.volume = 0.5; audio.play().catch(()=>{});

  // mensagem + selo
  const mensagem = document.createElement('div');
  mensagem.innerHTML = `<div class="selo-confirmado">✅ Pagamento confirmado</div>
    <p class="mensagem-agradecimento">📚 O Bibliotecário agradece pela sua ajuda à manutenção! ❤️</p>`;

  const btn = document.getElementById('baixar-'+livroAtual);
  if(btn){
    btn.style.display = 'inline-block';
    btn.insertAdjacentElement('beforebegin', mensagem);
  }
}

// botão "Já paguei"
async function confirmarPagamento(){
  if(!currentChargeId){ alert('Nenhuma cobrança ativa.'); fecharPix(); return; }
  try{
    const r = await fetch(`${VERCEL_BASE}/api/check-status`, {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ chargeId: currentChargeId })
    });
    if(!r.ok){ alert('Erro ao verificar.'); return; }
    const j = await r.json();
    if(j.paid) onPaymentConfirmed();
    else alert('Pagamento ainda não confirmado. A verificação automática continuará.');
  }catch(e){ console.error('confirmarPagamento', e); alert('Erro ao verificar pagamento.'); }
}

// search + filter
function filtrarLivros(){
  const termo = (searchInput.value || '').toLowerCase();
  const cat = categorySelect.value;
  const filtrados = livros.filter(l=>{
    const okTerm = l.titulo.toLowerCase().includes(termo) || l.autor.toLowerCase().includes(termo);
    const okCat = cat === 'todos' || l.categoria === cat;
    return okTerm && okCat;
  });
  renderizarLivros(filtrados);
}
searchInput.addEventListener('input', filtrarLivros);
categorySelect.addEventListener('change', filtrarLivros);

// theme toggle
const themeToggle = document.getElementById('themeToggle');
function applyTheme(t){
  if(t === 'dark') document.documentElement.classList.add('dark'), document.body.classList.add('dark'), themeToggle.textContent='☀️';
  else document.documentElement.classList.remove('dark'), document.body.classList.remove('dark'), themeToggle.textContent='🌙';
  localStorage.setItem('theme',''+t);
}
themeToggle.addEventListener('click', ()=>{
  const now = localStorage.getItem('theme') === 'dark' ? 'light' : 'dark';
  applyTheme(now);
});
applyTheme(localStorage.getItem('theme') || 'light');

document.getElementById('closeModalBtn').addEventListener('click', fecharPix);
document.getElementById('confirmPaidBtn').addEventListener('click', confirmarPagamento);

renderizarLivros(livros);
