import { defineConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    {
      name: 'log-llm-interaction',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {

          // ---- 动态资源列表 API ----
          if (req.url?.startsWith('/api/list-resources') && req.method === 'GET') {
            try {
              const url = new URL(req.url, 'http://localhost');
              const scenarioId = url.searchParams.get('scenarioId');
              if (!scenarioId) { res.writeHead(400); res.end('Missing scenarioId'); return; }
              const base = path.resolve(process.cwd(), 'public', 'resources', scenarioId);
              const readDir = (sub: string): string[] => {
                const dir = path.join(base, sub);
                if (!fs.existsSync(dir)) return [];
                return fs.readdirSync(dir).filter(f => /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(f));
              };
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ backgrounds: readDir('images'), characters: readDir('characters') }));
            } catch (e) { res.writeHead(500); res.end(String(e)); }
            return;
          }

          // ---- 日志写入 API ----
          if (req.url === '/api/save-log' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
              try {
                if (!body) {
                  res.writeHead(400);
                  res.end('Empty body');
                  return;
                }
                const data = JSON.parse(body);
                const now = new Date().toLocaleString('zh-CN', { hour12: false });
                const logPath = path.resolve(process.cwd(), 'llm_turn.log');

                // 1. 统一处理文件路径
                const targetPath = data.filename ? path.resolve(process.cwd(), data.filename) : logPath;

                // 2. 如果有 clear 标志，执行彻底清空
                if (data.clear) {
                  fs.writeFileSync(targetPath, '', 'utf-8');
                  // 如果是清空定制文件且没有后续内容，直接返回
                  if (!data.prompt && !data.response && !data.content) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                    return;
                  }
                }

                // 3. 处理自定义内容 (由 assistant_turn.log 等使用)
                if (data.content !== undefined) {
                  const updatedContent = `[Update Time: ${now}]\n${data.content}`;
                  if (data.append) {
                    fs.appendFileSync(targetPath, updatedContent, 'utf-8');
                  } else {
                    // 如果已经 clear 过（且不是 append），则覆盖写入
                    fs.writeFileSync(targetPath, updatedContent, 'utf-8');
                  }
                }

                // 4. 处理标准 llm_turn.log 的 prompt / response 逻辑
                if (data.prompt) {
                  const logContent = `============================================================\n[记录时间: ${now}]\n[发给大模型的Prompt]\n============================\n${data.prompt}\n\n`;
                  if (data.clear || !fs.existsSync(targetPath)) {
                    fs.writeFileSync(targetPath, logContent, 'utf-8');
                  } else {
                    const existing = fs.readFileSync(targetPath, 'utf-8');
                    fs.writeFileSync(targetPath, logContent + existing, 'utf-8');
                  }
                }

                if (data.response) {
                  const logContent = `\n============================\n[记录时间: ${now}]\n[大模型返回的原始结果]\n============================\n${data.response}\n\n`;
                  const existing = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf-8') : '';
                  fs.writeFileSync(targetPath, logContent + existing, 'utf-8');
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
              } catch (e) {
                console.error('[Log Error]', e);
                res.writeHead(500);
                res.end(String(e));
              }
            });
          } else if (req.url === '/api/save-scenario' && req.method === 'POST') {
            // ---- 保存剧本 API ----
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
              try {
                const data = JSON.parse(body);
                const { backgroundId, prologue, worldState, goal, deadline, playerOverrides } = data;
                if (!backgroundId) { res.writeHead(400); res.end('Missing backgroundId'); return; }

                // 生成剧本 ID（时间戳）
                const now = new Date();
                const scenarioId = `scenario_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

                const scenario = {
                  id: scenarioId,
                  backgroundId,
                  createdAt: now.toISOString(),
                  prologue: prologue || "",
                  goal: goal || "",
                  deadline: deadline || "",
                  playerOverrides: playerOverrides || {},
                  worldState: worldState || {},
                };

                // 确保目录存在
                const dir = path.resolve(process.cwd(), 'public', 'scenarios', backgroundId);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

                const filePath = path.join(dir, `${scenarioId}.json`);
                fs.writeFileSync(filePath, JSON.stringify(scenario, null, 2), 'utf-8');

                console.log(`[Save Scenario] ${filePath}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, scenarioId, filePath }));
              } catch (e) { res.writeHead(500); res.end(String(e)); }
            });
          } else {
            next();
          }
        });
      }
    }
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    proxy: {
      // DeepSeek API 代理
      '/proxy/deepseek': {
        target: 'https://api.deepseek.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/deepseek/, ''),
      },
      // MiniMax API 代理
      '/proxy/minimax': {
        target: 'https://api.minimax.chat',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/minimax/, ''),
      },
    }
  }
})
