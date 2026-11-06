// main.jsx — наша веб-часть (renderer).
//
// Здесь живёт React-приложение, которое рисует Ketcher. Собирается Vite'ом
// в статичные файлы (renderer/dist), а Electron отдаёт их изнутри приложения —
// никакой dev-сервер для запуска больше не нужен.

import { createRoot } from 'react-dom/client';
import { Editor } from 'ketcher-react';
import { StandaloneStructServiceProvider } from 'ketcher-standalone';

// Стили Ketcher (тема, тулбары, диалоги). Vite вставит их прямо в бандл.
import 'ketcher-react/dist/index.css';

// «Struct service» — то, что выполняет химию: конвертации, layout, генерацию картинок.
// Standalone-провайдер делает это локально в WASM (Indigo), без сети и без сервера.
const structServiceProvider = new StandaloneStructServiceProvider();

function App() {
  return (
    <Editor
      // Откуда брать статические ресурсы (шаблоны и т.п.). У нас всё в бандле.
      staticResourcesUrl=""
      structServiceProvider={structServiceProvider}
      onInit={(ketcher) => {
        // Ketcher не имеет своего глобального объекта, поэтому кладём его в window:
        // так до него сможет дотянуться main-процесс (executeJavaScript) —
        // это понадобится для хоткея «копировать как SMILES».
        window.ketcher = ketcher;
      }}
    />
  );
}

createRoot(document.getElementById('root')).render(<App />);
